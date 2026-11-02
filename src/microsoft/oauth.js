/**
 * Microsoft token helpers.
 *
 * The user pastes an access token (and optionally a refresh token) into the
 * settings panel; there is no redirect flow. The access token is a JWT whose
 * `exp` and `aud` claims we read to decide whether it is still usable and
 * whether it was minted for Cognitive Services at all.
 *
 * Refreshing still needs the client id of the app that issued the token, so it
 * only runs when `MICROSOFT_CLIENT_ID` is configured; otherwise the panel
 * simply asks for a new access token when the old one expires.
 */

const AUTHORIZE_HOST = "https://login.microsoftonline.com";
const SPEECH_SCOPE = "https://cognitiveservices.azure.com/.default";
export const SPEECH_AUDIENCE = "https://cognitiveservices.azure.com";
export const DEFAULT_TENANT = "common";

export function microsoftTokenConfig(env) {
    return {
        clientId: String(env?.MICROSOFT_CLIENT_ID || "").trim(),
        clientSecret: String(env?.MICROSOFT_CLIENT_SECRET || "").trim(),
        tenant: String(env?.MICROSOFT_TENANT || "").trim() || DEFAULT_TENANT
    };
}

export function canRefreshMicrosoftToken(env) {
    return Boolean(microsoftTokenConfig(env).clientId);
}

function decodeBase64Url(value) {
    const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
}

/** Returns the JWT payload, or null when the value is not a JWT. */
export function decodeAccessToken(token) {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) {
        return null;
    }
    try {
        return JSON.parse(decodeBase64Url(parts[1]));
    } catch {
        return null;
    }
}

/** Epoch seconds from `exp`, or null when the token has no readable expiry. */
export function accessTokenExpiry(token) {
    const payload = decodeAccessToken(token);
    const exp = Number(payload?.exp);
    return Number.isFinite(exp) && exp > 0 ? exp : null;
}

/**
 * Reject a token that was issued for another resource (Graph, Outlook, ...)
 * before it reaches Azure and comes back as a confusing 401.
 */
export function accessTokenAudienceProblem(token) {
    const payload = decodeAccessToken(token);
    if (!payload) {
        return null;
    }
    const audience = payload.aud;
    const values = Array.isArray(audience) ? audience : [audience];
    const usable = values.some(value => String(value || "").replace(/\/$/, "") === SPEECH_AUDIENCE);
    return usable ? null : `这个 access token 的 audience 是 ${values.join(", ") || "(空)"}，不是 ${SPEECH_AUDIENCE}`;
}

export function isAccessTokenExpired(token, nowSeconds = Math.floor(Date.now() / 1000), skewSeconds = 60) {
    const exp = accessTokenExpiry(token);
    if (exp === null) {
        return false;
    }
    return exp - skewSeconds <= nowSeconds;
}

export function accessTokenExpiresAt(token) {
    const exp = accessTokenExpiry(token);
    return exp === null ? "" : new Date(exp * 1000).toISOString();
}

async function requestToken(env, body) {
    const { clientId, clientSecret, tenant } = microsoftTokenConfig(env);
    if (!clientId) {
        throw new Error("未配置 MICROSOFT_CLIENT_ID，无法刷新 Microsoft access token");
    }

    const form = new URLSearchParams({ client_id: clientId, ...body });
    if (clientSecret) {
        form.set("client_secret", clientSecret);
    }

    const response = await fetch(
        `${AUTHORIZE_HOST}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form
        }
    );

    const raw = await response.text();
    let payload;
    try {
        payload = JSON.parse(raw);
    } catch {
        throw new Error(`微软令牌接口返回了非 JSON 响应（${response.status}）`);
    }

    if (!response.ok || payload?.error) {
        const detail = String(payload?.error_description || payload?.error || raw).slice(0, 300);
        throw new Error(`微软令牌接口拒绝请求（${response.status}）：${detail}`);
    }
    if (!payload.access_token) {
        throw new Error("微软令牌接口没有返回 access_token");
    }

    return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token || "",
        expiresIn: Number(payload.expires_in) || 3600
    };
}

/**
 * Rotate the refresh token. Entra ID may return a new refresh token; the caller
 * must persist it, otherwise the old one can age out.
 */
export async function refreshAccessToken({ env, refreshToken }) {
    return requestToken(env, {
        grant_type: "refresh_token",
        refresh_token: String(refreshToken || ""),
        scope: `${SPEECH_SCOPE} offline_access`
    });
}
