/**
 * Who may write operator-managed state (provider secrets, Trancy accounts).
 *
 * - `ADMIN_TOKEN` set: the bearer token is required (works everywhere).
 * - `CF_ACCESS_TRUSTED=1`: trust Cloudflare Access in front of `/api/*`;
 *   that is the production setup, so no application-level password.
 * - local dev hosts: open, so `wrangler dev` needs no configuration.
 *
 * Anything else is refused instead of falling back to "anyone can write".
 */

import { errorResponse } from "./response.js";

export function constantTimeEqual(left, right) {
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

export function adminTokenFrom(request) {
    const header = request.headers.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
}

export function isLocalDevHost(request) {
    try {
        const host = new URL(request.url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
        return host === "localhost" || host === "::1" || host === "127.0.0.1"
            || host.endsWith(".localhost") || host.endsWith(".local")
            || host.startsWith("127.");
    } catch {
        return false;
    }
}

export function writeMode(request, env) {
    if (String(env?.ADMIN_TOKEN || "").trim()) {
        return "admin-token";
    }
    if (String(env?.CF_ACCESS_TRUSTED || "").trim() === "1") {
        return "cloudflare-access";
    }
    if (isLocalDevHost(request)) {
        return "local-dev";
    }
    return "locked";
}

/**
 * `subject` only shapes the refusal message, so providers keep saying
 * "Provider 配置" and the Trancy tab says "Trancy 账号".
 */
export function requireAdmin(request, env, subject = "配置") {
    const mode = writeMode(request, env);

    if (mode === "admin-token") {
        const expected = String(env.ADMIN_TOKEN || "").trim();
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

    if (mode === "cloudflare-access" || mode === "local-dev") {
        return null;
    }

    return errorResponse(
        `该环境不允许修改 ${subject}：设置 ADMIN_TOKEN，或确认 /api/* 已由 Cloudflare Access 保护后设置 CF_ACCESS_TRUSTED=1`,
        {
            status: 403,
            type: "permission_error",
            code: "write_not_configured"
        }
    );
}
