/**
 * YouTube caption scheduling over the account pool.
 *
 * Every free Trancy account may generate only a handful of AI subtitles per day
 * (`x-quota-limit`, five by default) and the refusal is an HTTP 200 whose body
 * says `{"code":403,"message":"You've reached the daily limit..."}`. So the
 * gateway is not a round-robin proxy here; it is a quota allocator with three
 * rules, in order of importance:
 *
 *   1. **Never pay twice for the same video.** Results are cached by
 *      (video, target) and served from D1 without touching Trancy.
 *   2. **Never ask an account that just said no.** A refusal parks the account
 *      in `exhausted_until` until the next UTC day; the token itself is fine.
 *   3. **Spend the emptiest account first.** Our own daily counter leads, the
 *      last observed `x-quota-remaining` breaks ties, LRU finishes.
 *
 * If every account is exhausted the caller gets `503 no_caption_quota` with the
 * reset time instead of a fake success.
 */

import { fetchYoutubeCaptions } from "./api.js";
import {
    listTrancyAccounts,
    markCaptionExhausted,
    nextUtcMidnight,
    pickCaptionAccounts,
    readCaptionCache,
    recordCaptionUsage,
    recordTrancyUsage,
    refreshTrancyAccount,
    utcDay,
    writeCaptionCache
} from "./store.js";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const TARGET_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const MAX_ACCOUNTS_PER_REQUEST = 3;

export function normalizeCaptionRequest({ videoId, target } = {}) {
    const video = String(videoId ?? "").trim();
    const language = String(target ?? "en").trim() || "en";

    if (!video) {
        return { videoId: "", target: "", error: "缺少 videoId" };
    }
    if (!VIDEO_ID_PATTERN.test(video)) {
        return { videoId: "", target: "", error: "videoId 只能是 YouTube 的 11 位 ID（字母、数字、-、_）" };
    }
    if (!TARGET_PATTERN.test(language)) {
        return { videoId: "", target: "", error: "target 必须是语言代码，例如 en、zh-CN" };
    }
    return { videoId: video, target: language, error: null };
}

function cacheView(row, { videoId, target }) {
    let data = [];
    try {
        data = JSON.parse(String(row.payload || "[]"));
    } catch {
        data = [];
    }
    return {
        ok: true,
        cached: true,
        videoId,
        target,
        account: { id: String(row.account_id || ""), email: "" },
        quota: { limit: -1, remaining: -1 },
        sentenceCount: Number(row.sentence_count || data.length || 0),
        createdAt: String(row.created_at || ""),
        data
    };
}

export async function readCachedCaptions(env, { videoId, target }) {
    const row = await readCaptionCache(env, videoId, target);
    return row ? cacheView(row, { videoId, target }) : null;
}

/**
 * Serve a caption request, from cache when possible and from the pool otherwise.
 *
 * `tried` carries the accounts that were consulted so a failure explains itself
 * ("acc-a: daily_limit, acc-b: network") instead of returning a bare 503.
 */
export async function requestYoutubeCaptions(env, { videoId, target = "en", fetchImpl = fetch } = {}) {
    const cached = await readCachedCaptions(env, { videoId, target });
    if (cached) {
        return cached;
    }

    const accounts = await pickCaptionAccounts(env, { limit: MAX_ACCOUNTS_PER_REQUEST });
    if (!accounts.length) {
        // "The pool is empty" and "the pool is spent" are different answers for
        // the caller: the second one comes with a time to retry.
        const all = await listTrancyAccounts(env);
        const now = Date.now();
        const parked = all
            .map(account => account.exhaustedUntil)
            .filter(value => value && Date.parse(value) > now)
            .sort();
        if (parked.length) {
            return {
                ok: false,
                cached: false,
                reason: "no_caption_quota",
                message: "所有账号今天的 AI 字幕额度都用完了",
                resetAt: parked[0],
                tried: []
            };
        }
        return {
            ok: false,
            cached: false,
            reason: "no_account",
            message: "没有可用账号：账号池为空、token 过期或正在冷却",
            resetAt: nextUtcMidnight(),
            tried: []
        };
    }

    const tried = [];
    for (const account of accounts) {
        const result = await fetchYoutubeCaptions({
            token: account.token,
            videoId,
            target,
            fetchImpl
        });

        if (result.ok) {
            const usedToday = await recordCaptionUsage(env, account.id, {
                quotaLimit: result.quota.limit,
                quotaRemaining: result.quota.remaining
            });
            const sentenceCount = result.sentences.length;
            try {
                await writeCaptionCache(env, {
                    videoId,
                    target,
                    accountId: account.id,
                    payload: JSON.stringify(result.sentences),
                    sentenceCount
                });
            } catch (error) {
                // A cache miss that cannot be written is not worth failing the
                // request over: the caller already has the captions.
                console.error("trancy caption cache write failed:", error);
            }
            return {
                ok: true,
                cached: false,
                videoId,
                target,
                account: { id: account.id, email: account.email },
                quota: { limit: result.quota.limit, remaining: result.quota.remaining },
                usedToday,
                sentenceCount,
                data: result.sentences
            };
        }

        tried.push(`${account.email || account.id}: ${result.reason}`);

        if (result.reason === "daily_limit") {
            await markCaptionExhausted(env, account.id);
            continue;
        }

        if (result.reason === "rejected" && /token|unauthor|login/i.test(result.message)) {
            // A dead credential is worth one probe: the daily cron may simply
            // not have run yet, and a re-login revives it without a human.
            await refreshTrancyAccount(env, account.id).catch(() => null);
            continue;
        }

        // Network or upstream 5xx: back the account off briefly, keep its token.
        await recordTrancyUsage(env, account.id, { ok: false, cooldownMinutes: 2 }).catch(() => null);
    }

    const exhaustedAll = tried.every(entry => entry.endsWith("daily_limit"));
    return {
        ok: false,
        cached: false,
        reason: exhaustedAll ? "no_caption_quota" : "caption_failed",
        message: exhaustedAll
            ? "所有账号今天的 AI 字幕额度都用完了"
            : "所有可用账号都没能生成字幕",
        resetAt: nextUtcMidnight(),
        day: utcDay(),
        tried
    };
}
