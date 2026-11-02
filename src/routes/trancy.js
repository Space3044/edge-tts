/**
 * Trancy multi-account gateway API.
 *
 * GET    /api/trancy/accounts              — browser-safe account list
 * POST   /api/trancy/accounts              — add (or re-token) an account
 * DELETE /api/trancy/accounts/:id          — forget an account
 * POST   /api/trancy/accounts/refresh      — probe every account now
 * POST   /api/trancy/accounts/:id/refresh  — probe one account
 * POST   /api/trancy/captions             — generate YouTube AI subtitles within the daily quota
 * GET    /api/trancy/captions/:videoId    — cached subtitles only, never spends quota
 *
 * Authentication is Cloudflare Access' job: the whole `/api/*` surface is meant
 * to sit behind an Access application, so the Worker checks no token of its own.
 * That is only acceptable because of what sits behind it (see README):
 * `POST /captions` spends real quota and `GET /accounts` returns the passwords.
 */

import {
    normalizeCaptionRequest,
    readCachedCaptions,
    requestYoutubeCaptions,
    PENDING_RETRY_MS,
    TRANCY_DEFAULT_DAILY_LIMIT
} from "../trancy/captions.js";
import {
    accountView,
    addTrancyAccount,
    deleteTrancyAccount,
    listTrancyAccounts,
    loginTrancyAccount,
    refreshAllTrancyAccounts,
    refreshTrancyAccount,
    reloginTrancyAccount,
    normalizeIncomingToken
} from "../trancy/store.js";
import { errorResponse, jsonResponse } from "../utils/response.js";

const MAX_TOKEN_LENGTH = 4000;
const MAX_EMAIL_LENGTH = 200;
const MAX_PASSWORD_LENGTH = 200;

function segmentsOf(request) {
    return new URL(request.url).pathname.split("/").filter(Boolean);
}

async function readJsonBody(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

async function handleAccounts(request, env, segments) {
    // /api/trancy/accounts
    if (segments.length === 3) {
        if (request.method === "GET") {
            const accounts = await listTrancyAccounts(env, { includePasswords: true });
            return jsonResponse({
                accounts,
                // The panel needs a denominator before the first caption call,
                // and it must be the same number the scheduler assumes.
                defaultDailyLimit: TRANCY_DEFAULT_DAILY_LIMIT
            });
        }

        if (request.method === "POST") {

            const body = await readJsonBody(request);
            if (!body) {
                return errorResponse("请求体必须是 JSON", {
                    status: 400,
                    type: "invalid_request_error",
                    param: "body",
                    code: "invalid_json"
                });
            }

            const token = normalizeIncomingToken(body.token);
            if (!token) {
                return errorResponse("没有识别出 Trancy token，请粘贴 token 或 trancy=... cookie", {
                    status: 400,
                    type: "invalid_request_error",
                    param: "token",
                    code: "invalid_token"
                });
            }
            if (token.length > MAX_TOKEN_LENGTH) {
                return errorResponse("token 太长", {
                    status: 400,
                    type: "invalid_request_error",
                    param: "token",
                    code: "invalid_token"
                });
            }

            try {
                const row = await addTrancyAccount(env, { token });
                const list = await listTrancyAccounts(env);
                const account = list.find(item => item.id === row?.id) || accountView(row);
                return jsonResponse({ account }, { status: 201 });
            } catch (error) {
                return errorResponse(error instanceof Error ? error.message : "保存账号失败", {
                    status: 400,
                    type: "invalid_request_error",
                    param: "token",
                    code: "trancy_account_save_failed"
                });
            }
        }

        return errorResponse("只支持 GET /api/trancy/accounts 和 POST /api/trancy/accounts", {
            status: 405,
            type: "invalid_request_error",
            param: "method",
            code: "method_not_allowed"
        });
    }

    // /api/trancy/accounts/login  and  /api/trancy/accounts/signup
    if (segments.length === 4 && (segments[3] === "login" || segments[3] === "signup")) {
        if (request.method !== "POST") {
            return errorResponse(`只支持 POST /api/trancy/accounts/${segments[3]}`, {
                status: 405,
                type: "invalid_request_error",
                param: "method",
                code: "method_not_allowed"
            });
        }

        const body = await readJsonBody(request);
        if (!body) {
            return errorResponse("请求体必须是 JSON", {
                status: 400,
                type: "invalid_request_error",
                param: "body",
                code: "invalid_json"
            });
        }

        const email = String(body.email || "").trim();
        const password = String(body.password || "");
        if (!email || !password) {
            return errorResponse("邮箱和密码都要填", {
                status: 400,
                type: "invalid_request_error",
                param: email ? "password" : "email",
                code: "missing_credentials"
            });
        }
        if (email.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
            return errorResponse("邮箱或密码太长", {
                status: 400,
                type: "invalid_request_error",
                param: "email",
                code: "credentials_too_long"
            });
        }

        const result = await loginTrancyAccount(env, {
            email,
            password,
            mode: segments[3] === "signup" ? "signup" : "login"
        });

        if (!result.ok) {
            // Trancy's own message is the useful one ("Incorrect password",
            // "email: Invalid email; password: String must contain at least 6 ...").
            const status = result.reason === "network" ? 502 : 400;
            return errorResponse(result.message || "Trancy 登录失败", {
                status,
                type: "invalid_request_error",
                param: "credentials",
                code: `trancy_${segments[3]}_failed`
            });
        }

        return jsonResponse({ account: result.account }, { status: 201 });
    }

    // /api/trancy/accounts/refresh
    if (segments.length === 4 && segments[3] === "refresh") {
        if (request.method !== "POST") {
            return errorResponse("只支持 POST /api/trancy/accounts/refresh", {
                status: 405,
                type: "invalid_request_error",
                param: "method",
                code: "method_not_allowed"
            });
        }
        const body = await readJsonBody(request);
        const minAgeMinutes = Number.isFinite(Number(body?.minAgeMinutes)) ? Math.max(0, Number(body.minAgeMinutes)) : 10;
        const result = await refreshAllTrancyAccounts(env, { minAgeMinutes });
        return jsonResponse({ result });
    }

    // /api/trancy/accounts/:id, /:id/refresh and /:id/login
    if (segments.length === 4 || (segments.length === 5 && (segments[4] === "refresh" || segments[4] === "login"))) {
        const id = String(segments[3] || "");

        if (segments.length === 5 && segments[4] === "login") {
            if (request.method !== "POST") {
                return errorResponse("只支持 POST /api/trancy/accounts/:id/login", {
                    status: 405,
                    type: "invalid_request_error",
                    param: "method",
                    code: "method_not_allowed"
                });
            }
            const result = await reloginTrancyAccount(env, id);
            if (!result.ok) {
                const status = result.reason === "not_found" ? 404
                    : result.reason === "no_credentials" ? 409
                        : result.reason === "network" ? 502 : 400;
                return errorResponse(result.message || "重新登录失败", {
                    status,
                    type: "invalid_request_error",
                    param: "credentials",
                    code: result.reason === "no_credentials" ? "trancy_no_credentials" : "trancy_relogin_failed"
                });
            }
            return jsonResponse({ account: result.account });
        }

        if (segments.length === 5) {
            if (request.method !== "POST") {
                return errorResponse("只支持 POST /api/trancy/accounts/:id/refresh", {
                    status: 405,
                    type: "invalid_request_error",
                    param: "method",
                    code: "method_not_allowed"
                });
            }
            const result = await refreshTrancyAccount(env, id);
            if (!result.account) {
                return errorResponse("账号不存在", {
                    status: 404,
                    type: "invalid_request_error",
                    param: "id",
                    code: "trancy_account_not_found"
                });
            }
            return jsonResponse({ result });
        }

        if (request.method === "DELETE") {
            const removed = await deleteTrancyAccount(env, id);
            if (!removed) {
                return errorResponse("账号不存在", {
                    status: 404,
                    type: "invalid_request_error",
                    param: "id",
                    code: "trancy_account_not_found"
                });
            }
            return jsonResponse({ deleted: id });
        }

        return errorResponse("只支持 DELETE /api/trancy/accounts/:id 和 POST /api/trancy/accounts/:id/login", {
            status: 405,
            type: "invalid_request_error",
            param: "method",
            code: "method_not_allowed"
        });
    }

    return errorResponse("未知的 Trancy 账号接口", {
        status: 404,
        type: "invalid_request_error",
        param: "path",
        code: "not_found"
    });
}

/**
 * `POST /api/trancy/captions {videoId?}` spends quota. `GET /captions/:videoId`
 * only reads the cache, so retrying a finished video costs nothing.
 *
 * `target` is optional and defaults to `en`: downstream only has to know the
 * video id.
 */
async function handleCaptions(request, env, segments) {
    if (request.method === "GET") {
        const videoId = String(segments[3] || "");
        const target = new URL(request.url).searchParams.get("target") || "en";
        const normalized = normalizeCaptionRequest({ videoId, target });
        if (normalized.error) {
            return errorResponse(normalized.error, {
                status: 400,
                type: "invalid_request_error",
                param: "videoId",
                code: "invalid_caption_request"
            });
        }
        const cached = await readCachedCaptions(env, normalized);
        if (cached && cached.pending) {
            return jsonResponse(cached, {
                status: 202,
                headers: { "Retry-After": String(Math.ceil(PENDING_RETRY_MS / 1000)) }
            });
        }
        if (!cached) {
            return errorResponse("这个视频还没有缓存，需要先 POST 生成", {
                status: 404,
                type: "invalid_request_error",
                param: "videoId",
                code: "caption_not_cached"
            });
        }
        return jsonResponse(cached);
    }

    if (request.method !== "POST") {
        return errorResponse("只支持 POST /api/trancy/captions 和 GET /api/trancy/captions/:videoId", {
            status: 405,
            type: "invalid_request_error",
            param: "method",
            code: "method_not_allowed"
        });
    }


    const body = await readJsonBody(request);
    if (!body) {
        return errorResponse("请求体必须是 JSON", {
            status: 400,
            type: "invalid_request_error",
            param: "body",
            code: "invalid_json"
        });
    }

    const normalized = normalizeCaptionRequest({ videoId: body.videoId, target: body.target });
    if (normalized.error) {
        return errorResponse(normalized.error, {
            status: 400,
            type: "invalid_request_error",
            param: "videoId",
            code: "invalid_caption_request"
        });
    }

    const result = await requestYoutubeCaptions(env, normalized);
    if (result.pending) {
        return jsonResponse(result, {
            status: 202,
            headers: { "Retry-After": String(Math.ceil(PENDING_RETRY_MS / 1000)) }
        });
    }
    if (!result.ok) {
        const status = result.reason === "no_account" || result.reason === "no_caption_quota" ? 503 : 502;
        return jsonResponse({
            error: {
                message: result.message,
                type: "api_error",
                param: "videoId",
                code: result.reason
            },
            resetAt: result.resetAt,
            tried: result.tried
        }, { status });
    }

    return jsonResponse(result, {
        headers: {
            "X-Trancy-Account": result.account.id,
            "X-Trancy-Cached": result.cached ? "1" : "0",
            "X-Quota-Limit": String(result.quota.limit),
            "X-Quota-Remaining": String(result.quota.remaining),
            "Access-Control-Expose-Headers": "X-Trancy-Account, X-Trancy-Cached, X-Quota-Limit, X-Quota-Remaining"
        }
    });
}

export async function handleTrancy(request, env = {}) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204 });
    }

    const segments = segmentsOf(request);

    try {
        if (segments.length >= 3 && segments[2] === "accounts") {
            return await handleAccounts(request, env, segments);
        }
        if (segments[2] === "captions" && segments.length >= 3 && segments.length <= 4) {
            return await handleCaptions(request, env, segments);
        }
        return errorResponse("未知的 Trancy 接口", {
            status: 404,
            type: "invalid_request_error",
            param: "path",
            code: "not_found"
        });
    } catch (error) {
        console.error("Trancy 网关错误:", error);
        return errorResponse(error instanceof Error ? error.message : "Trancy 网关内部错误", {
            status: 500,
            code: "trancy_gateway_failed"
        });
    }
}
