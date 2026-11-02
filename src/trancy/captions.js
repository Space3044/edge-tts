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

import { fetchYoutubeCaptions } from "./api.js";
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
 * `target` is optional on purpose: downstream only has to know the video id, and
 * the common case is English subtitles.
 */
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

/**
 * Serve one caption request from the pool.
 *
 * `tried` carries the accounts that were consulted so a failure explains itself
 * ("a@example.com: daily_limit, b@example.com: network") instead of returning a
 * bare 503.
 */
export async function requestYoutubeCaptions(env, { videoId, target = "en", fetchImpl = fetch } = {}) {
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
                reason: "no_caption_quota",
                message: "所有账号今天的 AI 字幕额度都用完了",
                resetAt: parked[0],
                tried: []
            };
        }
        return {
            ok: false,
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
            return {
                ok: true,
                videoId,
                target,
                account: { id: account.id, email: account.email },
                quota: { limit: result.quota.limit, remaining: result.quota.remaining },
                usedToday,
                sentenceCount: result.sentences.length,
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
        reason: exhaustedAll ? "no_caption_quota" : "caption_failed",
        message: exhaustedAll
            ? "所有账号今天的 AI 字幕额度都用完了"
            : "所有可用账号都没能生成字幕",
        resetAt: nextUtcMidnight(),
        day: utcDay(),
        tried
    };
}
