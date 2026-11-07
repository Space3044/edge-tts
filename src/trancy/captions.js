/**
 * YouTube caption scheduling over the account pool.
 *
 * Every free Trancy account may generate only a handful of AI subtitles per day
 * (`x-quota-limit`, five by default) and the refusal is an HTTP 200 whose body
 * says `{"code":403,"message":"You've reached the daily limit..."}`. So the
 * gateway is not a round-robin proxy here; it is a quota allocator:
 *
 *   1. **Never ask an account that just said no.** A refusal parks the account
 *      in `exhausted_until` until the next UTC day; the token itself is fine.
 *   2. **Spend the emptiest account first.** Our own daily counter leads, the
 *      last observed `x-quota-remaining` breaks ties, LRU finishes.
 *   3. **Report the outcome.** The caller gets the transcript plus which account
 *      paid for it and what is left today.
 *
 * Nothing is cached: the transcript comes back in the response and belongs to
 * the caller. Asking for the same video twice spends the quota twice (unless
 * Trancy happens to serve it from its own cache).
 *
 * If every account is exhausted the caller gets `503 no_caption_quota` with the
 * reset time instead of a fake success.
 */

import {
    fetchYoutubeCaptions,
    TRANCY_CAPTION_SOURCES,
    TRANCY_DEFAULT_CAPTION_SOURCE
} from "./api.js";
import {
    listTrancyAccounts,
    markCaptionExhausted,
    nextUtcMidnight,
    pickCaptionAccounts,
    recordCaptionUsage,
    recordTrancyUsage,
    refreshTrancyAccount,
    utcDay
} from "./store.js";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const TARGET_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const MAX_ACCOUNTS_PER_REQUEST = 3;

/**
 * What a free account gets per day, as documented by Trancy ("5 AI subtitles
 * for free users"). Used only for display and for the "how much room is left"
 * estimate before an account has answered once: the real numbers always come
 * from `x-quota-limit` / `x-quota-remaining`, and an actual refusal parks the
 * account regardless of what we think the limit is.
 */
export const TRANCY_DEFAULT_DAILY_LIMIT = 5;

/**
 * `target` and `source` are optional on purpose: downstream only has to know the
 * video id. `source` defaults to `audio` and is deliberately limited to the two
 * upstream modes supported by Trancy: `audio` and `json3`.
 */
export function normalizeCaptionRequest({ videoId, target, source } = {}) {
    const video = String(videoId ?? "").trim();
    const language = String(target ?? "en").trim() || "en";
    const captionSource = String(source ?? TRANCY_DEFAULT_CAPTION_SOURCE).trim();

    if (!video) {
        return { videoId: "", target: "", source: "", error: "缺少 videoId" };
    }
    if (!VIDEO_ID_PATTERN.test(video)) {
        return { videoId: "", target: "", source: "", error: "videoId 只能是 YouTube 的 11 位 ID（字母、数字、-、_）" };
    }
    if (!TARGET_PATTERN.test(language)) {
        return { videoId: "", target: "", source: "", error: "target 必须是语言代码，例如 en、zh-CN" };
    }
    if (!TRANCY_CAPTION_SOURCES.includes(captionSource)) {
        return { videoId: "", target: "", source: "", error: "source 只支持 audio 或 json3" };
    }
    return { videoId: video, target: language, source: captionSource, error: null };
}

async function exhaustedPoolReset(env, source) {
    if (source === "json3") return "";
    const accounts = (await listTrancyAccounts(env)).filter(account =>
        account.status === "ok" && !account.banned && !account.tokenError);
    const now = Date.now();
    if (!accounts.length || !accounts.every(account => Date.parse(account.exhaustedUntil) > now)) return "";
    return accounts.map(account => account.exhaustedUntil).sort()[0];
}

/**
 * Serve one caption request from the pool.
 *
 * `tried` carries the accounts that were consulted so a failure explains itself
 * ("a@example.com: daily_limit, b@example.com: network") instead of returning a
 * bare 503.
 */
export async function requestYoutubeCaptions(env, { videoId, target = "en", source = TRANCY_DEFAULT_CAPTION_SOURCE, fetchImpl = fetch } = {}) {
    const accounts = await pickCaptionAccounts(env, { limit: MAX_ACCOUNTS_PER_REQUEST, source });
    if (!accounts.length) {
        // "The pool is empty" and "the pool is spent" are different answers for
        // the caller: the second one comes with a time to retry.
        const resetAt = await exhaustedPoolReset(env, source);
        if (resetAt) {
            return {
                ok: false,
                reason: "no_caption_quota",
                message: "所有账号今天的 AI 字幕额度都用完了",
                resetAt,
                tried: []
            };
        }
        return {
            ok: false,
            reason: "no_account",
            message: "没有可用账号：账号池为空、登录不可用、正在冷却或额度耗尽",
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
            source,
            fetchImpl
        });

        if (result.ok) {
            const usedToday = await recordCaptionUsage(env, account.id, {
                quotaLimit: result.quota.limit,
                quotaRemaining: result.quota.remaining,
                source
            });
            return {
                ok: true,
                videoId,
                target,
                source,
                account: { id: account.id, email: account.email },
                quota: { limit: result.quota.limit, remaining: result.quota.remaining },
                usedToday,
                sentenceCount: result.sentences.length,
                data: result.sentences
            };
        }

        tried.push(`${account.email || account.id}: ${result.reason}`);

        if (result.reason === "daily_limit") {
            if (source !== "json3") {
                await markCaptionExhausted(env, account.id, nextUtcMidnight(), { quotaLimit: result.quota.limit });
            }
            continue;
        }

        if (result.reason === "rejected" && /token|unauthor|login/i.test(result.message)) {
            // A dead credential is worth one probe: the daily cron may simply
            // not have run yet, and a re-login revives it without a human.
            await refreshTrancyAccount(env, account.id, { fetchImpl }).catch(() => null);
            continue;
        }

        // Network or upstream 5xx: back the account off briefly, keep its token.
        await recordTrancyUsage(env, account.id, { ok: false, cooldownMinutes: 2 }).catch(() => null);
    }

    // Hitting the retry budget does not prove the rest of the pool is empty.
    const resetAt = tried.every(entry => entry.endsWith("daily_limit"))
        ? await exhaustedPoolReset(env, source) : "";
    const exhaustedAll = Boolean(resetAt);
    return {
        ok: false,
        reason: exhaustedAll ? "no_caption_quota" : "caption_failed",
        message: exhaustedAll
            ? "所有账号今天的 AI 字幕额度都用完了"
            : "本次尝试的账号未能生成字幕",
        resetAt: resetAt || nextUtcMidnight(),
        day: utcDay(),
        tried
    };
}
