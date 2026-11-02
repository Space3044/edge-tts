/**
 * Entra ID (Microsoft identity platform) authorization-code flow.
 *
 * The Worker is a confidential client: it holds the client secret, exchanges
 * the code for tokens, and keeps only the refresh token (encrypted, in D1).
 * Access tokens are minted on demand and never written anywhere.
 *
 * Scope `https://cognitiveservices.azure.com/.default` yields a token whose
 * audience is the Cognitive Services resource, which is what Azure Speech
 * accepts as `Authorization: Bearer <token>`.
 */

const AUTHORIZE_HOST = "https://login.microsoftonline.com";
const SPEECH_SCOPE = "https://cognitiveservices.azure.com/.default";
const SCOPES = `${SPEECH_SCOPE} offline_access`;

export const DEFAULT_TENANT = "common";

export function microsoftOAuthConfig(env) {
    return {
        clientId: String(env?.MICROSOFT_CLIENT_ID || "").trim(),
        clientSecret: String(env?.MICROSOFT_CLIENT_SECRET || "").trim(),
        tenant: String(env?.MICROSOFT_TENANT || "").trim() || DEFAULT_TENANT
    };
}

export function isMicrosoftOAuthConfigured(env) {
    // A public client (registered as "Mobile and desktop applications") uses
    // PKCE without a secret, so the client id alone is enough.
    const { clientId } = microsoftOAuthConfig(env);
    return Boolean(clientId);
}

function base64UrlEncode(bytes) {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createState() {
    return base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
}

/** PKCE S256 pair: the verifier stays in an HttpOnly cookie, the challenge goes out. */
export async function createPkcePair() {
    const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return { verifier, challenge: base64UrlEncode(new Uint8Array(digest)) };
}

export function buildAuthorizeUrl({ env, redirectUri, state, codeChallenge }) {
    const { clientId, tenant } = microsoftOAuthConfig(env);
    if (!clientId) {
        throw new Error("MICROSOFT_CLIENT_ID 未配置");
    }

    const url = new URL(`${AUTHORIZE_HOST}/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("prompt", "select_account");
    return url.toString();
}

function tokenEndpoint(env) {
    const { tenant } = microsoftOAuthConfig(env);
    return `${AUTHORIZE_HOST}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
}

async function requestToken(env, body) {
    const { clientId, clientSecret } = microsoftOAuthConfig(env);
    if (!clientId) {
        throw new Error("MICROSOFT_CLIENT_ID 未配置");
    }

    const form = new URLSearchParams({ client_id: clientId, ...body });
    if (clientSecret) {
        form.set("client_secret", clientSecret);
    }

    const response = await fetch(tokenEndpoint(env), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form
    });

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

    return payload;
}

export async function exchangeCode({ env, code, redirectUri, codeVerifier }) {
    const payload = await requestToken(env, {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        scope: SCOPES
    });
    return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token || "",
        expiresIn: Number(payload.expires_in) || 3600
    };
}

/**
 * Rotate the refresh token. Entra ID may return a new refresh token; the
 * caller must persist it, otherwise the old one can age out.
 */
export async function refreshAccessToken({ env, refreshToken }) {
    const payload = await requestToken(env, {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: SCOPES
    });
    return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token || refreshToken,
        expiresIn: Number(payload.expires_in) || 3600
    };
}
