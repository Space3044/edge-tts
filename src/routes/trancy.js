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
 * POST   /api/trancy/relay                — forward a request with a pooled token
 *
 * Writes and relays share the provider guard (`src/utils/admin.js`): the relay
 * spends the operator's Trancy quota and can leak data, so it is never open.
 */

import { relayTrancyRequest, TRANCY_API_ORIGIN, TRANCY_PROFILE_PATH } from "../trancy/api.js";
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
    pickTrancyAccount,
    recordTrancyUsage,
    refreshAllTrancyAccounts,
    refreshTrancyAccount,
    reloginTrancyAccount,
    normalizeIncomingToken
} from "../trancy/store.js";
import { requireAdmin, requireTrancyClient, writeMode } from "../utils/admin.js";
import { makeCORSHeaders } from "../utils/cors.js";
import { errorResponse, jsonResponse } from "../utils/response.js";

const MAX_TOKEN_LENGTH = 4000;
const MAX_EMAIL_LENGTH = 200;
const MAX_PASSWORD_LENGTH = 200;
const MAX_RELAY_ATTEMPTS = 2;
const RELAY_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
// Anything on api.trancy.org, but nothing that could be turned into a
// different host: `/1/...`, `/2/...`, `/3/...`, `/4/...` only.
const RELAY_PATH_PATTERN = /^\/[0-9]{1,2}\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*(\?[^\s#]*)?$/;

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
            const mode = writeMode(request, env);
            // Passwords are plaintext in D1 by design; they are only echoed to
            // callers that already hold write access, so a locked deployment
            // never leaks them through the read-only list.
            const includePasswords = !requireAdmin(request, env, "Trancy 账号");
            const accounts = await listTrancyAccounts(env, { includePasswords });
            return jsonResponse({
                accounts,
                writable: mode !== "locked",
                writeMode: mode,
                passwordsVisible: includePasswords,
                // The panel needs a denominator before the first caption call,
                // and it must be the same number the scheduler assumes.
                defaultDailyLimit: TRANCY_DEFAULT_DAILY_LIMIT
            });
        }

        if (request.method === "POST") {
            const denied = requireAdmin(request, env, "Trancy 账号");
            if (denied) {
                return denied;
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
        const denied = requireAdmin(request, env, "Trancy 账号");
        if (denied) {
            return denied;
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
        const denied = requireAdmin(request, env, "Trancy 账号");
        if (denied) {
            return denied;
        }
        const body = await readJsonBody(request);
        const minAgeMinutes = Number.isFinite(Number(body?.minAgeMinutes)) ? Math.max(0, Number(body.minAgeMinutes)) : 10;
        const result = await refreshAllTrancyAccounts(env, { minAgeMinutes });
        return jsonResponse({ result });
    }

    // /api/trancy/accounts/:id, /:id/refresh and /:id/login
    if (segments.length === 4 || (segments.length === 5 && (segments[4] === "refresh" || segments[4] === "login"))) {
        const id = String(segments[3] || "");
        const denied = requireAdmin(request, env, "Trancy 账号");
        if (denied) {
            return denied;
        }

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
 * `POST /api/trancy/captions {videoId, target}` spends quota, so it sits behind
 * the same guard as the relay. The cache read (`GET`) does not spend anything
 * and stays open, which is what makes retrying a finished video free.
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

    const denied = requireTrancyClient(request, env);
    if (denied) {
        return denied;
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

function relayTargetError(path) {
    if (!path) {
        return "缺少 path，例如 /2/dictionary?text=hello&target=zh-CN";
    }
    if (!RELAY_PATH_PATTERN.test(path)) {
        return "path 必须是 api.trancy.org 上的绝对路径，例如 /1/user/profile";
    }
    try {
        // Belt and braces: even a matched pattern must stay on the Trancy API
        // origin, so nothing here can be pointed at another host.
        const resolved = new URL(path, `${TRANCY_API_ORIGIN}/`);
        if (resolved.origin !== TRANCY_API_ORIGIN) {
            return "path 必须指向 api.trancy.org";
        }
    } catch {
        return "path 无法解析";
    }
    return null;
}

async function handleRelay(request, env) {
    if (request.method !== "POST") {
        return errorResponse("只支持 POST /api/trancy/relay", {
            status: 405,
            type: "invalid_request_error",
            param: "method",
            code: "method_not_allowed"
        });
    }

    const denied = requireTrancyClient(request, env);
    if (denied) {
        return denied;
    }

    const body = await readJsonBody(request);
    const path = String(body?.path || TRANCY_PROFILE_PATH);
    const targetError = relayTargetError(path);
    if (targetError) {
        return errorResponse(targetError, {
            status: 400,
            type: "invalid_request_error",
            param: "path",
            code: "invalid_relay_path"
        });
    }

    const method = String(body?.method || "GET").toUpperCase();
    if (!RELAY_METHODS.includes(method)) {
        return errorResponse(`不支持的 method：${method}`, {
            status: 400,
            type: "invalid_request_error",
            param: "method",
            code: "invalid_relay_method"
        });
    }

    const tried = [];
    for (let attempt = 0; attempt < MAX_RELAY_ATTEMPTS; attempt += 1) {
        const account = await pickTrancyAccount(env);
        if (!account) {
            return errorResponse(
                tried.length
                    ? `所有 Trancy 账号都不可用（${tried.join(", ")}）`
                    : "没有可用的 Trancy 账号：先在 Trancy 面板里添加一个 token",
                { status: 503, type: "api_error", code: "no_trancy_account" }
            );
        }
        tried.push(account.email || account.name || account.id);

        const result = await relayTrancyRequest({
            token: account.token,
            method,
            path,
            body: body?.body
        });

        if (result.tokenInvalid) {
            // Same failure mode as the profile probe: 200 + data:null means the
            // credential is gone. Classify it once, then try another account.
            await refreshTrancyAccount(env, account.id).catch(() => null);
            continue;
        }

        if (!result.ok) {
            await recordTrancyUsage(env, account.id, { ok: false, cooldownMinutes: 2 }).catch(() => null);
            const headers = {
                ...makeCORSHeaders(),
                "Access-Control-Expose-Headers": "X-Trancy-Account, X-Trancy-Email, X-Quota-Limit, X-Quota-Remaining"
            };
            return new Response(result.text || JSON.stringify({ error: { message: result.reason } }), {
                status: result.status || 502,
                headers: { "Content-Type": result.contentType, ...headers }
            });
        }

        await recordTrancyUsage(env, account.id, { ok: true }).catch(() => null);
        const headers = {
            ...makeCORSHeaders(),
            "Access-Control-Expose-Headers": "X-Trancy-Account, X-Trancy-Email, X-Quota-Limit, X-Quota-Remaining",
            "X-Trancy-Account": account.id,
            "X-Trancy-Email": encodeURIComponent(account.email || ""),
            "Content-Type": result.contentType || "application/json"
        };
        if (result.quota?.limit) {
            headers["X-Quota-Limit"] = result.quota.limit;
        }
        if (result.quota?.remaining) {
            headers["X-Quota-Remaining"] = result.quota.remaining;
        }
        return new Response(result.text, { status: 200, headers });
    }

    return errorResponse(`所有 Trancy 账号都拒绝了这次请求（${tried.join(", ")}），已标记为需要更新 token`, {
        status: 503,
        type: "api_error",
        code: "trancy_token_rejected"
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
        if (segments.length === 3 && segments[2] === "relay") {
            return await handleRelay(request, env);
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
