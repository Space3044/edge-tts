/**
 * Microsoft OAuth routes.
 *
 * POST /api/providers/microsoft/login   (Bearer ADMIN_TOKEN) -> authorize URL
 * GET  /api/microsoft/callback          (public, state + PKCE cookie) -> stores
 *                                       the refresh token and bounces back
 *
 * The login step is an API call rather than a plain link so the admin token can
 * be checked before the flow starts; only then does the browser follow the
 * returned URL to login.microsoftonline.com.
 */

import { buildAuthorizeUrl, createPkcePair, createState, exchangeCode, isMicrosoftOAuthConfigured } from "../microsoft/oauth.js";
import { saveMicrosoftRefreshToken } from "../secrets/store.js";
import { errorResponse, jsonResponse } from "../utils/response.js";

const STATE_COOKIE = "vc_ms_oauth";
const STATE_TTL_SECONDS = 600;
const RETURN_PATH = "/transcription";

function callbackUrl(request) {
    const url = new URL(request.url);
    return `${url.origin}/api/microsoft/callback`;
}

function readStateCookie(request) {
    const header = request.headers.get("cookie") || "";
    for (const part of header.split(";")) {
        const [name, ...rest] = part.trim().split("=");
        if (name === STATE_COOKIE) {
            return decodeURIComponent(rest.join("="));
        }
    }
    return "";
}

function stateCookie(value, maxAge) {
    return `${STATE_COOKIE}=${encodeURIComponent(value)}; Path=/api/microsoft; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function handleMicrosoftLogin(request, env) {
    if (!isMicrosoftOAuthConfigured(env)) {
        return errorResponse("未配置 MICROSOFT_CLIENT_ID", {
            status: 503,
            type: "api_error",
            code: "microsoft_oauth_not_configured"
        });
    }

    const state = createState();
    const { verifier, challenge } = await createPkcePair();
    const authorizeUrl = buildAuthorizeUrl({
        env,
        redirectUri: callbackUrl(request),
        state,
        codeChallenge: challenge
    });

    return jsonResponse(
        { authorizeUrl },
        { headers: { "Set-Cookie": stateCookie(`${state}.${verifier}`, STATE_TTL_SECONDS) } }
    );
}

export async function handleMicrosoftCallback(request, env) {
    const url = new URL(request.url);
    const fail = (reason) => new Response(null, {
        status: 302,
        headers: {
            Location: `${url.origin}${RETURN_PATH}?microsoft=error&reason=${encodeURIComponent(reason)}`,
            "Set-Cookie": stateCookie("", 0)
        }
    });

    const oauthError = url.searchParams.get("error");
    if (oauthError) {
        return fail(String(url.searchParams.get("error_description") || oauthError).slice(0, 160));
    }

    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const cookie = readStateCookie(request);
    const [savedState, verifier] = cookie.split(".");

    if (!code || !state || !savedState || !verifier || state !== savedState) {
        return fail("state_mismatch");
    }

    try {
        const tokens = await exchangeCode({
            env,
            code,
            redirectUri: callbackUrl(request),
            codeVerifier: verifier
        });
        if (!tokens.refreshToken) {
            return fail("no_refresh_token");
        }
        await saveMicrosoftRefreshToken(env, tokens.refreshToken);
    } catch (error) {
        console.error("Microsoft OAuth callback failed:", error);
        return fail(error instanceof Error ? error.message.slice(0, 160) : "token_exchange_failed");
    }

    return new Response(null, {
        status: 302,
        headers: {
            Location: `${url.origin}${RETURN_PATH}?microsoft=connected`,
            "Set-Cookie": stateCookie("", 0)
        }
    });
}
