/**
 * Provider configuration API.
 *
 * GET  /api/providers            — browser-safe status (no plaintext keys)
 * PUT  /api/providers/:provider  — write endpoint/model/key, guarded by ADMIN_TOKEN
 *
 * The guard is a bearer token held in the Worker secret `ADMIN_TOKEN`: the UI
 * asks for it once and keeps it in sessionStorage. When the secret is missing,
 * writes are refused instead of silently falling back to "anyone can write".
 */

import { PROVIDER_DEFAULTS, isSupportedProvider, listProviderStatus, normalizeProviderName, saveProviderConfig } from "../secrets/store.js";
import { errorResponse, jsonResponse } from "../utils/response.js";

const MAX_ENDPOINT_LENGTH = 300;
const MAX_MODEL_LENGTH = 120;
const MAX_API_KEY_LENGTH = 500;

function constantTimeEqual(left, right) {
    const a = String(left ?? "");
    const b = String(right ?? "");
    if (a.length !== b.length) {
        return false;
    }
    let mismatch = 0;
    for (let index = 0; index < a.length; index += 1) {
        mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }
    return mismatch === 0;
}

function adminTokenFrom(request) {
    const header = request.headers.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
}

function requireAdmin(request, env) {
    const expected = String(env?.ADMIN_TOKEN || "").trim();
    if (!expected) {
        return errorResponse("未配置 ADMIN_TOKEN，无法修改 Provider 配置", {
            status: 403,
            type: "permission_error",
            code: "admin_not_configured"
        });
    }

    const provided = adminTokenFrom(request);
    if (!provided || !constantTimeEqual(provided, expected)) {
        return errorResponse("ADMIN_TOKEN 无效", {
            status: 401,
            type: "authentication_error",
            code: "invalid_admin_token"
        });
    }

    return null;
}

function validateEndpoint(value) {
    const endpoint = String(value ?? "").trim();
    if (!endpoint) {
        return { endpoint: "", error: null };
    }
    if (endpoint.length > MAX_ENDPOINT_LENGTH) {
        return { endpoint: "", error: "Endpoint 太长" };
    }

    let url;
    try {
        url = new URL(endpoint);
    } catch {
        return { endpoint: "", error: "Endpoint 格式无效" };
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        return { endpoint: "", error: "Endpoint 必须以 http:// 或 https:// 开头" };
    }
    if (url.username || url.password) {
        return { endpoint: "", error: "Endpoint 不能包含用户名或密码" };
    }
    return { endpoint: endpoint.replace(/\/+$/, ""), error: null };
}

function validateModel(value) {
    const model = String(value ?? "").trim();
    if (model.length > MAX_MODEL_LENGTH) {
        return { model: "", error: "模型名称太长" };
    }
    return { model, error: null };
}

export async function handleProviders(request, env = {}) {
    const requestUrl = new URL(request.url);
    const segments = requestUrl.pathname.split("/").filter(Boolean);
    const provider = normalizeProviderName(segments[2] || "");

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204 });
    }

    if (request.method === "GET" && segments.length === 2) {
        try {
            const providers = await listProviderStatus(env);
            return jsonResponse({
                providers,
                defaults: PROVIDER_DEFAULTS,
                writable: Boolean(String(env?.ADMIN_TOKEN || "").trim()),
                encryptionReady: true
            });
        } catch (error) {
            console.error("读取 Provider 配置失败:", error);
            return errorResponse(error instanceof Error ? error.message : "读取 Provider 配置失败", {
                status: 500,
                code: "provider_read_failed"
            });
        }
    }

    if (request.method === "PUT" && segments.length === 3) {
        if (!isSupportedProvider(provider)) {
            return errorResponse("不支持的 Provider", {
                status: 404,
                type: "invalid_request_error",
                param: "provider",
                code: "unknown_provider"
            });
        }

        const denied = requireAdmin(request, env);
        if (denied) {
            return denied;
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return errorResponse("请求体必须是 JSON", {
                status: 400,
                type: "invalid_request_error",
                param: "body",
                code: "invalid_json"
            });
        }

        const endpoint = validateEndpoint(body?.endpoint);
        if (endpoint.error) {
            return errorResponse(endpoint.error, {
                status: 400,
                type: "invalid_request_error",
                param: "endpoint",
                code: "invalid_endpoint"
            });
        }

        const model = validateModel(body?.model);
        if (model.error) {
            return errorResponse(model.error, {
                status: 400,
                type: "invalid_request_error",
                param: "model",
                code: "invalid_model"
            });
        }

        const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
        if (apiKey.length > MAX_API_KEY_LENGTH) {
            return errorResponse("API Key 太长", {
                status: 400,
                type: "invalid_request_error",
                param: "apiKey",
                code: "invalid_api_key"
            });
        }

        try {
            const updated = await saveProviderConfig(env, provider, {
                endpoint: endpoint.endpoint,
                model: model.model,
                apiKey,
                clearApiKey: body?.clearApiKey === true
            });
            return jsonResponse({ provider: updated });
        } catch (error) {
            console.error("保存 Provider 配置失败:", error);
            return errorResponse(error instanceof Error ? error.message : "保存 Provider 配置失败", {
                status: 500,
                code: "provider_save_failed"
            });
        }
    }

    return errorResponse("只支持 GET /api/providers 和 PUT /api/providers/:provider", {
        status: 405,
        type: "invalid_request_error",
        param: "method",
        code: "method_not_allowed"
    });
}
