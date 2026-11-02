/**
 * Provider configuration store.
 *
 * Resolution order for every provider: D1 row -> environment variable ->
 * built-in default. API keys are decrypted only inside the Worker; the public
 * status view returns `keyTail` (masked) instead of the secret.
 */

import { decryptSecret, encryptSecret, importEncryptionKey, maskSecret } from "./crypto.js";
import { accessTokenExpiresAt, isAccessTokenExpired } from "../microsoft/oauth.js";

export const PROVIDERS = ["openai", "elevenlabs", "google", "microsoft"];

export const PROVIDER_DEFAULTS = {
    openai: { endpoint: "https://api.openai.com/v1", model: "whisper-1" },
    elevenlabs: { endpoint: "https://api.elevenlabs.io", model: "scribe_v2" },
    google: { endpoint: "https://generativelanguage.googleapis.com", model: "gemini-3.5-transcribe" },
    // Microsoft uses OAuth + a region-derived host, so it has no model or key.
    microsoft: { endpoint: "", model: "" }
};

export const PROVIDER_ENV_KEYS = {
    openai: ["OPENAI_API_KEY"],
    elevenlabs: ["ELEVENLABS_API_KEY"],
    google: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    microsoft: []
};

export function isSupportedProvider(provider) {
    return PROVIDERS.includes(String(provider || "").toLowerCase());
}

export function normalizeProviderName(provider) {
    return String(provider || "").trim().toLowerCase();
}

function hasDatabase(env) {
    return Boolean(env && env.DB && typeof env.DB.prepare === "function");
}

function requireDatabase(env) {
    if (!hasDatabase(env)) {
        throw new Error("D1 binding DB 未配置，无法读写 Provider 配置");
    }
    return env.DB;
}

function envApiKey(provider, env) {
    for (const name of PROVIDER_ENV_KEYS[provider] || []) {
        const value = String(env?.[name] || "").trim();
        if (value) {
            return { apiKey: value, envName: name };
        }
    }
    return { apiKey: "", envName: "" };
}

async function readRows(env) {
    if (!hasDatabase(env)) {
        return new Map();
    }
    const { results } = await env.DB
        .prepare("SELECT provider, endpoint, model, api_key_cipher, updated_at, region, refresh_token_cipher, token_updated_at, access_token_cipher, access_token_expires_at, cookie_cipher FROM provider_config")
        .all();
    const rows = new Map();
    for (const row of results || []) {
        rows.set(String(row.provider), row);
    }
    return rows;
}

const REFRESH_TOKEN_AAD = "microsoft:refresh_token";

async function decryptCookieJar(row, env) {
    const cipher = String(row?.cookie_cipher || "");
    if (!cipher) {
        return { cookies: "", tokenError: null };
    }
    try {
        const key = await importEncryptionKey(env?.SECRETS_ENCRYPTION_KEY);
        return {
            cookies: await decryptSecret(cipher, { key, aad: REFRESH_TOKEN_AAD }),
            tokenError: null
        };
    } catch (error) {
        return { cookies: "", tokenError: error instanceof Error ? error.message : String(error) };
    }
}

async function decryptAccessToken(row, env) {
    const cipher = String(row?.access_token_cipher || "");
    if (!cipher) {
        return { accessToken: "", tokenError: null };
    }
    try {
        const key = await importEncryptionKey(env?.SECRETS_ENCRYPTION_KEY);
        return {
            accessToken: await decryptSecret(cipher, { key, aad: REFRESH_TOKEN_AAD }),
            tokenError: null
        };
    } catch (error) {
        return { accessToken: "", tokenError: error instanceof Error ? error.message : String(error) };
    }
}

async function decryptRefreshToken(row, env) {
    const cipher = String(row?.refresh_token_cipher || "");
    if (!cipher) {
        return { refreshToken: "", tokenError: null };
    }
    try {
        const key = await importEncryptionKey(env?.SECRETS_ENCRYPTION_KEY);
        return {
            refreshToken: await decryptSecret(cipher, { key, aad: REFRESH_TOKEN_AAD }),
            tokenError: null
        };
    } catch (error) {
        return { refreshToken: "", tokenError: error instanceof Error ? error.message : String(error) };
    }
}

async function decryptRowKey(provider, row, env) {
    const cipher = String(row?.api_key_cipher || "");
    if (!cipher) {
        return { apiKey: "", keyError: null };
    }
    try {
        const key = await importEncryptionKey(env?.SECRETS_ENCRYPTION_KEY);
        return { apiKey: await decryptSecret(cipher, { key, aad: provider }), keyError: null };
    } catch (error) {
        return { apiKey: "", keyError: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Resolve the effective configuration used by the transcription route.
 *
 * Returns the API key in plaintext for internal callers; never hand this object
 * to a route that serializes to the browser.
 */
export async function resolveProvider(env, provider) {
    const name = normalizeProviderName(provider);
    if (!isSupportedProvider(name)) {
        throw new Error(`不支持的 Provider: ${name}`);
    }

    const defaults = PROVIDER_DEFAULTS[name];
    const row = (await readRows(env)).get(name);
    const endpoint = String(row?.endpoint || "").trim() || defaults.endpoint;
    const model = String(row?.model || "").trim() || defaults.model;

    const stored = await decryptRowKey(name, row, env);
    if (stored.apiKey) {
        return { provider: name, endpoint, model, apiKey: stored.apiKey, keySource: "db", keyError: null };
    }

    const fromEnv = envApiKey(name, env);
    if (fromEnv.apiKey) {
        return { provider: name, endpoint, model, apiKey: fromEnv.apiKey, keySource: "env", keyError: null };
    }

    return {
        provider: name,
        endpoint,
        model,
        apiKey: "",
        keySource: "none",
        keyError: stored.keyError
    };
}

/**
 * Browser-safe view: endpoint, model, whether a key exists, and its masked tail.
 */
export async function listProviderStatus(env) {
    const rows = await readRows(env);
    const statuses = [];

    for (const provider of PROVIDERS) {
        const row = rows.get(provider);
        const defaults = PROVIDER_DEFAULTS[provider];
        const stored = await decryptRowKey(provider, row, env);
        const fromEnv = envApiKey(provider, env);
        const source = stored.apiKey ? "db" : fromEnv.apiKey ? "env" : "none";
        const apiKey = stored.apiKey || fromEnv.apiKey;

        const region = String(row?.region || "").trim();
        const connected = Boolean(
            String(row?.refresh_token_cipher || "")
            || String(row?.access_token_cipher || "")
            || String(row?.api_key_cipher || "")
            || String(row?.cookie_cipher || "")
        );

        statuses.push({
            provider,
            endpoint: String(row?.endpoint || "").trim() || defaults.endpoint,
            model: String(row?.model || "").trim() || defaults.model,
            defaults,
            configured: provider === "microsoft" ? connected : Boolean(apiKey),
            keySource: provider === "microsoft" ? (connected ? "oauth" : "none") : source,
            keyTail: provider === "microsoft" ? "" : apiKey ? maskSecret(apiKey) : "",
            region,
            connected,
            tokenUpdatedAt: row?.token_updated_at || null,
            accessTokenExpiresAt: row?.access_token_expires_at || "",
            mode: row?.cookie_cipher
                ? "playground"
                : row?.api_key_cipher
                    ? "azure-key"
                    : row?.access_token_cipher || row?.refresh_token_cipher
                        ? "azure-token"
                        : "none",
            updatedAt: row?.updated_at || null,
            keyError: provider === "microsoft" ? null : stored.keyError
        });
    }

    return statuses;
}

export async function saveProviderConfig(env, provider, input = {}) {
    const name = normalizeProviderName(provider);
    if (!isSupportedProvider(name)) {
        throw new Error(`不支持的 Provider: ${name}`);
    }

    const db = requireDatabase(env);
    const rows = await readRows(env);
    const existing = rows.get(name);
    const defaults = PROVIDER_DEFAULTS[name];

    const endpointInput = input.endpoint ?? existing?.endpoint ?? "";
    const endpoint = String(endpointInput).trim() || defaults.endpoint;
    const model = String(input.model ?? existing?.model ?? "").trim() || defaults.model;
    const region = String(input.region ?? existing?.region ?? "").trim();

    let apiKeyCipher = String(existing?.api_key_cipher || "");
    const nextApiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
    if (input.clearApiKey === true) {
        apiKeyCipher = "";
    } else if (nextApiKey) {
        const key = await importEncryptionKey(env?.SECRETS_ENCRYPTION_KEY);
        apiKeyCipher = await encryptSecret(nextApiKey, { key, aad: name });
    }

    const updatedAt = new Date().toISOString();
    await db
        .prepare(
            `INSERT INTO provider_config
                 (provider, endpoint, model, api_key_cipher, updated_at, region, refresh_token_cipher, token_updated_at, access_token_cipher, access_token_expires_at, cookie_cipher)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(provider) DO UPDATE SET
                 endpoint = excluded.endpoint,
                 model = excluded.model,
                 api_key_cipher = excluded.api_key_cipher,
                 updated_at = excluded.updated_at,
                 region = excluded.region,
                 refresh_token_cipher = excluded.refresh_token_cipher,
                 token_updated_at = excluded.token_updated_at,
                 access_token_cipher = excluded.access_token_cipher,
                 access_token_expires_at = excluded.access_token_expires_at,
                 cookie_cipher = excluded.cookie_cipher`
        )
        .bind(
            name,
            endpoint,
            model,
            apiKeyCipher,
            updatedAt,
            region,
            String(existing?.refresh_token_cipher || ""),
            String(existing?.token_updated_at || ""),
            String(existing?.access_token_cipher || ""),
            String(existing?.access_token_expires_at || ""),
            String(existing?.cookie_cipher || "")
        )
        .run();

    const statuses = await listProviderStatus(env);
    return statuses.find(status => status.provider === name);
}

/**
 * Microsoft account state.
 *
 * Tokens are pasted by the operator, so both may exist independently: an
 * access token alone works until it expires, a refresh token enables renewal.
 */
export async function getMicrosoftAccount(env) {
    const row = (await readRows(env)).get("microsoft");
    const stored = await decryptRowKey("microsoft", row, env);
    const access = await decryptAccessToken(row, env);
    const cookieJar = await decryptCookieJar(row, env);
    const refresh = await decryptRefreshToken(row, env);
    const tokenError = access.tokenError || refresh.tokenError || cookieJar.tokenError;
    const expiresAt = String(row?.access_token_expires_at || "");

    return {
        playgroundCookies: cookieJar.cookies,
        subscriptionKey: stored.apiKey,
        accessToken: access.accessToken,
        accessTokenExpiresAt: expiresAt,
        accessTokenExpired: access.accessToken
            ? isAccessTokenExpired(access.accessToken)
            : Boolean(expiresAt) && Date.parse(expiresAt) <= Date.now() + 60000,
        refreshToken: refresh.refreshToken,
        tokenError,
        region: String(row?.region || "").trim(),
        endpoint: String(row?.endpoint || "").trim(),
        tokenUpdatedAt: row?.token_updated_at || null
    };
}

/**
 * Persist whichever tokens the operator pasted. `undefined` keeps the stored
 * value, an empty string clears it.
 */
export async function saveMicrosoftTokens(env, { accessToken, refreshToken, cookies } = {}) {
    const db = requireDatabase(env);
    const rows = await readRows(env);
    const existing = rows.get("microsoft");

    let accessCipher = String(existing?.access_token_cipher || "");
    let expiresAt = String(existing?.access_token_expires_at || "");
    if (typeof accessToken === "string") {
        const value = accessToken.trim();
        if (value) {
            const key = await importEncryptionKey(env?.SECRETS_ENCRYPTION_KEY);
            accessCipher = await encryptSecret(value, { key, aad: REFRESH_TOKEN_AAD });
            expiresAt = accessTokenExpiresAt(value);
        } else {
            accessCipher = "";
            expiresAt = "";
        }
    }

    let refreshCipher = String(existing?.refresh_token_cipher || "");
    if (typeof refreshToken === "string") {
        const value = refreshToken.trim();
        if (value) {
            const key = await importEncryptionKey(env?.SECRETS_ENCRYPTION_KEY);
            refreshCipher = await encryptSecret(value, { key, aad: REFRESH_TOKEN_AAD });
        } else {
            refreshCipher = "";
        }
    }

    let cookieCipher = String(existing?.cookie_cipher || "");
    if (typeof cookies === "string") {
        const value = cookies.trim();
        if (value) {
            const key = await importEncryptionKey(env?.SECRETS_ENCRYPTION_KEY);
            cookieCipher = await encryptSecret(value, { key, aad: REFRESH_TOKEN_AAD });
        } else {
            cookieCipher = "";
        }
    }

    const now = new Date().toISOString();
    const tokensChanged = accessCipher !== String(existing?.access_token_cipher || "")
        || refreshCipher !== String(existing?.refresh_token_cipher || "")
        || cookieCipher !== String(existing?.cookie_cipher || "");
    const tokenUpdatedAt = tokensChanged ? now : String(existing?.token_updated_at || "");

    await db
        .prepare(
            `INSERT INTO provider_config
                 (provider, endpoint, model, api_key_cipher, updated_at, region, refresh_token_cipher, token_updated_at, access_token_cipher, access_token_expires_at, cookie_cipher)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(provider) DO UPDATE SET
                 refresh_token_cipher = excluded.refresh_token_cipher,
                 token_updated_at = excluded.token_updated_at,
                 access_token_cipher = excluded.access_token_cipher,
                 access_token_expires_at = excluded.access_token_expires_at,
                 cookie_cipher = excluded.cookie_cipher`
        )
        .bind(
            "microsoft",
            String(existing?.endpoint || ""),
            String(existing?.model || ""),
            String(existing?.api_key_cipher || ""),
            String(existing?.updated_at || now),
            String(existing?.region || ""),
            refreshCipher,
            tokenUpdatedAt,
            accessCipher,
            expiresAt,
            cookieCipher
        )
        .run();

    return { tokenUpdatedAt };
}

export async function clearMicrosoftTokens(env) {
    const db = requireDatabase(env);
    await db
        .prepare(
            `UPDATE provider_config
             SET refresh_token_cipher = '', token_updated_at = '',
                 access_token_cipher = '', access_token_expires_at = '',
                 cookie_cipher = ''
             WHERE provider = 'microsoft'`
        )
        .run();
}
