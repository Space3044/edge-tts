/**
 * Provider configuration store.
 *
 * Resolution order for every provider: D1 row -> environment variable ->
 * built-in default. API keys are decrypted only inside the Worker; the public
 * status view returns `keyTail` (masked) instead of the secret.
 */

import { decryptSecret, encryptSecret, importEncryptionKey, maskSecret } from "./crypto.js";

export const PROVIDERS = ["openai", "elevenlabs", "google"];

export const PROVIDER_DEFAULTS = {
    openai: { endpoint: "https://api.openai.com/v1", model: "whisper-1" },
    elevenlabs: { endpoint: "https://api.elevenlabs.io", model: "scribe_v2" },
    google: { endpoint: "https://generativelanguage.googleapis.com", model: "gemini-3.5-transcribe" }
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

async function readRows(env) {
    if (!hasDatabase(env)) {
        return new Map();
    }
    const { results } = await env.DB
        .prepare("SELECT provider, endpoint, model, api_key_cipher, updated_at FROM provider_config")
        .all();
    const rows = new Map();
    for (const row of results || []) {
        rows.set(String(row.provider), row);
    }
    return rows;
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

    // D1 is the only place a provider key can live: the panel writes it, the
    // Worker reads it, and SECRETS_ENCRYPTION_KEY is the only secret the
    // deployment carries. There is deliberately no environment fallback, so
    // "which key is in use" has exactly one answer.
    const stored = await decryptRowKey(name, row, env);
    return {
        provider: name,
        endpoint,
        model,
        apiKey: stored.apiKey,
        keySource: stored.apiKey ? "db" : "none",
        keyError: stored.apiKey ? null : stored.keyError
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
        const source = stored.apiKey ? "db" : "none";
        const apiKey = stored.apiKey;


        statuses.push({
            provider,
            endpoint: String(row?.endpoint || "").trim() || defaults.endpoint,
            model: String(row?.model || "").trim() || defaults.model,
            defaults,
            configured: Boolean(apiKey),
            keySource: source,
            keyTail: apiKey ? maskSecret(apiKey) : "",
            updatedAt: row?.updated_at || null,
            keyError: stored.keyError
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

    const endpoint = String(input.endpoint ?? existing?.endpoint ?? "").trim() || defaults.endpoint;
    const model = String(input.model ?? existing?.model ?? "").trim() || defaults.model;

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
                 (provider, endpoint, model, api_key_cipher, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(provider) DO UPDATE SET
                 endpoint = excluded.endpoint,
                 model = excluded.model,
                 api_key_cipher = excluded.api_key_cipher,
                 updated_at = excluded.updated_at`
        )
        .bind(
            name,
            endpoint,
            model,
            apiKeyCipher,
            updatedAt
        )
        .run();

    const statuses = await listProviderStatus(env);
    return statuses.find(status => status.provider === name);
}
