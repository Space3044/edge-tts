/**
 * Trancy credential parsing.
 *
 * A Trancy credential is a bare HS256 JWT with the payload `{ name, id, iat }`:
 * no `exp`, no scopes, no refresh token. The web app keeps it in the
 * non-httpOnly cookie `trancy=...` on `.trancy.org` and sends it to
 * `api.trancy.org` as `Authorization: Bearer <token>`; the extension does the
 * same. Operators therefore paste it in whichever of those two shapes they
 * happen to have, so normalization accepts both (and a `Cookie:` header line
 * copied out of devtools).
 *
 * The signature is never verified here: the secret is Trancy's, and the only
 * thing that can validate the token is `GET /1/user/profile`.
 */

const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MASK_PREFIX = "••••";

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

/**
 * Accept a bare token, `Bearer <token>`, `trancy=<token>`, or a full
 * `Cookie: a=1; trancy=<token>; b=2` line and return the bare token.
 */
export function normalizeTrancyToken(raw) {
    let value = String(raw ?? "").trim();
    if (!value) {
        return "";
    }
    if (JWT_PATTERN.test(value)) {
        return value;
    }

    const bearer = value.match(/^Bearer\s+(\S+)$/i);
    if (bearer && JWT_PATTERN.test(bearer[1])) {
        return bearer[1];
    }

    const cookie = value.match(/(?:^|[;\s])(?:Cookie:\s*)?trancy=([^;\s"']+)/i);
    if (cookie && JWT_PATTERN.test(cookie[1])) {
        return cookie[1];
    }

    // Last resort: a JWT sitting somewhere inside the pasted blob.
    const embedded = value.match(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/);
    return embedded ? embedded[0] : "";
}

/**
 * Decode the payload without verifying anything.
 *
 * `issuedAt` is the only freshness signal the token carries: every call to
 * `/1/user/profile` returns a token with `iat` bumped to the current second.
 */
export function parseTrancyToken(token) {
    const value = normalizeTrancyToken(token);
    if (!value) {
        return { valid: false, token: "", userId: "", name: "", issuedAt: "", error: "没有找到 Trancy token" };
    }

    const parts = value.split(".");
    if (parts.length !== 3) {
        return { valid: false, token: value, userId: "", name: "", issuedAt: "", error: "token 不是 JWT 格式" };
    }

    let payload;
    try {
        payload = JSON.parse(decodeBase64Url(parts[1]));
    } catch {
        return { valid: false, token: value, userId: "", name: "", issuedAt: "", error: "token 载荷无法解析" };
    }

    const issuedAt = Number(payload?.iat);
    return {
        valid: true,
        token: value,
        userId: String(payload?.id ?? ""),
        name: String(payload?.name ?? ""),
        issuedAt: Number.isFinite(issuedAt) ? new Date(issuedAt * 1000).toISOString() : "",
        error: null
    };
}

/** Never send a stored token back to the browser: show only a tail. */
export function maskTrancyToken(token) {
    const value = String(token ?? "");
    return value ? `${MASK_PREFIX}${value.slice(-6)}` : "";
}
