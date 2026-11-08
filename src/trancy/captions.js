/**
 * Caption reads and asynchronous generation over the Trancy account pool.
 * Trancy owns the job and transcript. Callers keep a protected continuation
 * ticket and poll without rotating accounts or submitting the job again.
 */

import {
    fetchYoutubeCaptions,
    fetchYoutubeCaptionStatus,
    submitYoutubeCaptions,
    TRANCY_CAPTION_SOURCES,
    TRANCY_DEFAULT_CAPTION_SOURCE
} from "./api.js";
import {
    listTrancyAccounts,
    markCaptionExhausted,
    nextUtcMidnight,
    pickCaptionAccounts,
    recordCaptionUsage,
    readCaptionAccount,
    observeCaptionQuota,
    recordTrancyUsage,
    refreshTrancyAccount,
    utcDay
} from "./store.js";

import { createCaptionTicket, readCaptionTicket } from "./caption-ticket.js";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const TARGET_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const MAX_ACCOUNTS_PER_REQUEST = 3;

/**
 * What a free account gets per day, as documented by Trancy ("5 AI subtitles
 * for free users"). Used only for display and for the "how much room is left"
 * reference when the balance is unknown: the real numbers always come
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

function failure(reason, message, tried = [], retryable = false) {
    return { ok: false, reason, message, resetAt: "", tried, retryable };
}

function completed(input, account, result, usedToday) {
    return {
        ok: true, videoId: input.videoId, target: input.target, source: input.source || "audio",
        account: { id: account.id, email: account.email }, quota: result.quota,
        usedToday, sentenceCount: result.sentences.length, data: result.sentences
    };
}

function pending(input, account, ticket, status, usedToday = account.usedToday) {
    return {
        ok: true, pending: true, videoId: input.videoId, target: input.target, source: "audio",
        status, retryAfterMs: status === "downloaded" ? 10000 : 5000,
        statusUrl: `/api/trancy/captions/status?ticket=${encodeURIComponent(ticket)}`,
        account: { id: account.id, email: account.email }, usedToday
    };
}

async function beginGeneration(env, input, account, fetchImpl) {
    const args = { ...input, token: account.token, fetchImpl };
    const state = await fetchYoutubeCaptionStatus(args);
    if (!state.ok) return state;
    if (state.status === "error" && !state.retry) {
        return failure("generation_failed", "Trancy 字幕生成失败");
    }
    // Create the continuation before POST: a bad encryption configuration must
    // never submit a job that the caller cannot follow.
    const ticket = await createCaptionTicket(env, { ...input, accountId: account.id });
    if (["pending", "downloaded", "ok"].includes(state.status)) {
        return pending(input, account, ticket, state.status);
    }
    const submitted = await submitYoutubeCaptions(args);
    if (!submitted.ok) {
        // A timeout, 5xx or malformed acknowledgement may hide an accepted job.
        // Keep the same account and query status; never retry this POST blindly.
        if (["network", "invalid_response"].includes(submitted.reason) || /^http_5/.test(submitted.reason)) {
            return pending(input, account, ticket, "submission_unknown");
        }
        return submitted;
    }
    const usedToday = await recordCaptionUsage(env, account.id, {
        quotaLimit: submitted.quota.limit, quotaRemaining: submitted.quota.remaining
    });
    return pending(input, account, ticket, submitted.status, usedToday);
}

/** POST: read first; only a missing AI track can trigger generation. */
export async function requestYoutubeCaptions(env, { videoId, target = "en", source = TRANCY_DEFAULT_CAPTION_SOURCE, fetchImpl = fetch } = {}) {
    const input = { videoId, target, source };
    const accounts = await pickCaptionAccounts(env, { limit: MAX_ACCOUNTS_PER_REQUEST, source });
    if (!accounts.length) {
        const resetAt = await exhaustedPoolReset(env, source);
        return { ...failure(resetAt ? "no_caption_quota" : "no_account", resetAt
            ? "所有账号今天的 AI 字幕额度都用完了"
            : "没有可用账号：账号池为空、登录不可用、正在冷却或额度耗尽"), resetAt };
    }

    const tried = [];
    let lastFailure;
    for (const account of accounts) {
        let result = await fetchYoutubeCaptions({ ...input, token: account.token, fetchImpl });
        if (result.ok) {
            const usedToday = await recordCaptionUsage(env, account.id, {
                quotaLimit: result.quota.limit, quotaRemaining: result.quota.remaining, source
            });
            return completed(input, account, result, usedToday);
        }
        const missing = result.reason === "caption_not_found";
        if (missing && source === "audio") {
            result = await beginGeneration(env, input, account, fetchImpl);
            if (result.ok) return result;
        }
        tried.push(`${account.email || account.id}: ${result.reason}`);
        lastFailure = result;
        if (result.reason === "daily_limit") {
            if (source !== "json3") await markCaptionExhausted(env, account.id, nextUtcMidnight(), { quotaLimit: result.quota.limit });
            continue;
        }
        if (result.reason === "permission_denied") continue;
        if (result.reason === "authentication_required" || (result.reason === "rejected" && /token|unauthor|login/i.test(result.message))) {
            await refreshTrancyAccount(env, account.id, { fetchImpl }).catch(() => null);
            continue;
        }
        // Generation/video failures do not poison a healthy account or try to
        // create the same job under another account. JSON3 never triggers POST.
        if (missing) return failure(result.reason, result.message, tried, ["network", "invalid_response"].includes(result.reason));
        await recordTrancyUsage(env, account.id, { ok: false, cooldownMinutes: 2 }).catch(() => null);
    }

    const resetAt = tried.every(entry => entry.endsWith("daily_limit")) ? await exhaustedPoolReset(env, source) : "";
    if (resetAt) return { ...failure("no_caption_quota", "所有账号今天的 AI 字幕额度都用完了", tried), resetAt, day: utcDay() };
    if (lastFailure && ["permission_denied", "authentication_required"].includes(lastFailure.reason)) {
        return failure(lastFailure.reason, lastFailure.message, tried);
    }
    return { ...failure("caption_failed", "本次尝试的账号未能获取或生成字幕", tried), day: utcDay() };
}

/** GET: follow the original account even after quota exhaustion. Never POST. */
export async function pollYoutubeCaptions(env, ticket, { fetchImpl = fetch, now = Date.now() } = {}) {
    const job = await readCaptionTicket(env, ticket, now);
    if (!job) return failure("invalid_caption_ticket", "字幕查询凭据无效");
    if (job.expiresAt <= now) return failure("generation_timeout", "字幕任务查询已超过 90 分钟，请重新发起请求");
    const account = await readCaptionAccount(env, job.accountId);
    if (!account) return failure("caption_account_unavailable", "生成字幕的账号不可用，请恢复该账号后使用原地址重试", [], true);
    const args = { videoId: job.videoId, target: job.target, token: account.token, fetchImpl };
    const state = await fetchYoutubeCaptionStatus(args);
    if (!state.ok) return failure(state.reason, state.message, [], !["permission_denied", "authentication_required"].includes(state.reason));
    if (state.status === "error") return failure("generation_failed", "Trancy 字幕生成失败");
    if (state.status === "none") {
        if (now - job.startedAt < 30000) return pending(job, account, ticket, "submission_unknown");
        return failure("generation_not_found", "Trancy 未找到生成任务，请重新发起请求");
    }
    if (state.status !== "ok") return pending(job, account, ticket, state.status);
    const result = await fetchYoutubeCaptions(args);
    if (!result.ok) {
        if (result.reason === "caption_not_found") return pending(job, account, ticket, "pending");
        // Reading a completed job can itself be quota-gated upstream. Preserve
        // the failure and let callers keep the same ticket; no resubmission.
        if (result.reason === "daily_limit") await markCaptionExhausted(env, account.id, nextUtcMidnight(), { quotaLimit: result.quota.limit });
        return failure(result.reason, result.message, [], true);
    }
    await observeCaptionQuota(env, account.id, result.quota);
    return completed(job, account, result, account.usedToday);
}
