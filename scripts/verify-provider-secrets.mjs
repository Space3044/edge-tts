import assert from "node:assert/strict";
import { bytesToBase64, decryptSecret, encryptSecret, importEncryptionKey, maskSecret } from "../src/secrets/crypto.js";
import { PROVIDER_DEFAULTS, listProviderStatus, resolveProvider, saveProviderConfig } from "../src/secrets/store.js";
import { handleProviders } from "../src/routes/providers.js";

/** Minimal in-memory stand-in for the two D1 statements the store issues. */
function createFakeD1() {
  const rows = new Map();

  return {
    rows,
    prepare(sql) {
      const statement = String(sql);
      return {
        _params: [],
        bind(...params) {
          this._params = params;
          return this;
        },
        async all() {
          if (!statement.includes("FROM provider_config")) {
            throw new Error(`unexpected SELECT: ${statement}`);
          }
          return { results: Array.from(rows.values()).map(row => ({ ...row })) };
        },
        async run() {
          if (!statement.includes("INSERT INTO provider_config")) {
            throw new Error(`unexpected WRITE: ${statement}`);
          }
          if (this._params.length !== 5) {
            throw new Error(`Wrong number of parameter bindings: got ${this._params.length}`);
          }
          const [provider, endpoint, model, apiKeyCipher, updatedAt] = this._params;
          rows.set(provider, { provider, endpoint, model, api_key_cipher: apiKeyCipher, updated_at: updatedAt });
          return { success: true };
        }
      };
    }
  };
}

const encryptionKey = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
const env = {
  DB: createFakeD1(),
  SECRETS_ENCRYPTION_KEY: encryptionKey,
  ADMIN_TOKEN: "admin-secret-token"
};

// 1. Envelope round trip, AAD binding, and masking.
{
  const key = await importEncryptionKey(encryptionKey);
  const envelope = await encryptSecret("sk-live-abcdef1234", { key, aad: "openai" });

  assert.match(envelope, /^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/, "envelope should be versioned base64");
  assert.ok(!envelope.includes("sk-live"), "ciphertext must not contain the plaintext key");

  assert.equal(await decryptSecret(envelope, { key, aad: "openai" }), "sk-live-abcdef1234");
  await assert.rejects(
    () => decryptSecret(envelope, { key, aad: "google" }),
    /无法解密/,
    "a ciphertext bound to one provider must not decrypt for another"
  );

  const otherKey = await importEncryptionKey(bytesToBase64(crypto.getRandomValues(new Uint8Array(32))));
  await assert.rejects(
    () => decryptSecret(envelope, { key: otherKey, aad: "openai" }),
    /无法解密/,
    "a different encryption key must not decrypt the envelope"
  );

  assert.equal(maskSecret("sk-live-abcdef1234"), "••••1234");
  assert.equal(maskSecret(""), "");

  await assert.rejects(() => importEncryptionKey(""), /SECRETS_ENCRYPTION_KEY/);
  await assert.rejects(() => importEncryptionKey(bytesToBase64(new Uint8Array(16))), /32 字节/);
}

// 2. Writing stores ciphertext only; status view is masked.
{
  const status = await saveProviderConfig(env, "openai", {
    endpoint: "https://asr.example.com/v1",
    model: "whisper-1",
    apiKey: "sk-live-abcdef1234"
  });

  const row = env.DB.rows.get("openai");
  assert.match(row.api_key_cipher, /^v1\./, "api key should be stored as an envelope");
  assert.ok(!JSON.stringify(row).includes("sk-live"), "D1 row must not contain the plaintext key");

  assert.equal(status.provider, "openai");
  assert.equal(status.endpoint, "https://asr.example.com/v1");
  assert.equal(status.model, "whisper-1");
  assert.equal(status.configured, true);
  assert.equal(status.keySource, "db");
  assert.equal(status.keyTail, "••••1234");
  assert.ok(!JSON.stringify(status).includes("sk-live"), "status payload must not leak the key");

  const resolved = await resolveProvider(env, "openai");
  assert.equal(resolved.apiKey, "sk-live-abcdef1234");
  assert.equal(resolved.keySource, "db");
  assert.equal(resolved.keyError, null);
}

// 3. Empty apiKey keeps the stored secret; clearApiKey removes it.
{
  await saveProviderConfig(env, "openai", { endpoint: "https://asr.example.com/v1", model: "whisper-1", apiKey: "" });
  assert.equal((await resolveProvider(env, "openai")).apiKey, "sk-live-abcdef1234", "blank key keeps the saved one");

  const cleared = await saveProviderConfig(env, "openai", { clearApiKey: true });
  assert.equal(cleared.configured, false);
  assert.equal(cleared.keySource, "none");
  assert.equal(env.DB.rows.get("openai").api_key_cipher, "");
}

// 3b. The OpenAI default must stay the official OpenAI API.
{
  assert.equal(
    PROVIDER_DEFAULTS.openai.endpoint,
    "https://api.openai.com/v1",
    "the OpenAI provider should default to the official api.openai.com endpoint"
  );
  assert.equal(PROVIDER_DEFAULTS.openai.model, "whisper-1");

  const fresh = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey };
  const openai = await resolveProvider(fresh, "openai");
  assert.equal(openai.endpoint, "https://api.openai.com/v1", "an empty row should fall back to the official endpoint");
  assert.equal(openai.keySource, "none");
}

// 4. Environment fallback and DB precedence.
{
  const envOnly = {
    DB: createFakeD1(),
    SECRETS_ENCRYPTION_KEY: encryptionKey,
    GEMINI_API_KEY: "env-google-key",
    OPENAI_API_KEY: "env-openai-key"
  };

  const google = await resolveProvider(envOnly, "google");
  assert.equal(google.apiKey, "env-google-key");
  assert.equal(google.keySource, "env");
  assert.equal(google.model, "gemini-3.5-transcribe", "default model should apply");

  await saveProviderConfig(envOnly, "openai", { apiKey: "db-openai-key" });
  const openai = await resolveProvider(envOnly, "openai");
  assert.equal(openai.apiKey, "db-openai-key", "the D1 key should win over the env key");
  assert.equal(openai.keySource, "db");
}

// 5. A missing encryption key blocks writes and never silently stores plaintext.
{
  const noKeyEnv = { DB: createFakeD1(), ADMIN_TOKEN: "admin-secret-token" };
  await assert.rejects(
    () => saveProviderConfig(noKeyEnv, "openai", { apiKey: "sk-live-abcdef1234" }),
    /SECRETS_ENCRYPTION_KEY/,
    "writing a key without SECRETS_ENCRYPTION_KEY must fail"
  );
  assert.equal(noKeyEnv.DB.rows.size, 0);
}

// 6. An unreadable ciphertext surfaces as keyError instead of crashing.
{
  const broken = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey };
  broken.DB.rows.set("openai", {
    provider: "openai",
    endpoint: "",
    model: "",
    api_key_cipher: "v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA",
    updated_at: new Date().toISOString()
  });

  const statuses = await listProviderStatus(broken);
  const openai = statuses.find(entry => entry.provider === "openai");
  assert.equal(openai.configured, false);
  assert.match(openai.keyError, /无法解密/);
  assert.ok(!JSON.stringify(statuses).includes("v1.AAAA"), "status must not echo the ciphertext");
}

// 7. Route guard: reads are public, writes need the bearer token.
{
  const routeEnv = {
    DB: createFakeD1(),
    SECRETS_ENCRYPTION_KEY: encryptionKey,
    ADMIN_TOKEN: "admin-secret-token"
  };

  const publicRead = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers", { method: "GET" }),
    routeEnv
  );
  assert.equal(publicRead.status, 200);
  const readBody = await publicRead.json();
  assert.equal(readBody.writable, true);
  assert.equal(readBody.providers.length, 3);
  assert.deepEqual(readBody.providers.map(entry => entry.provider), ["openai", "elevenlabs", "google"]);

  // ADMIN_TOKEN configured -> bearer required, on any host.
  const anonymousWrite = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/openai", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "sk-live-abcdef1234" })
    }),
    routeEnv
  );
  assert.equal(anonymousWrite.status, 401);

  const wrongToken = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/openai", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer nope" },
      body: JSON.stringify({ apiKey: "sk-live-abcdef1234" })
    }),
    routeEnv
  );
  assert.equal(wrongToken.status, 401);
  assert.equal(routeEnv.DB.rows.size, 0, "rejected writes must not touch D1");

  // No token, not local, no Access opt-in -> locked with a clear code.
  const lockedEnv = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey };
  const locked = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/openai", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "sk-live-abcdef1234" })
    }),
    lockedEnv
  );
  assert.equal(locked.status, 403);
  assert.equal((await locked.json()).error.code, "write_not_configured");
  assert.equal(lockedEnv.DB.rows.size, 0);

  // Local development is open so `wrangler dev` needs no configuration.
  const localEnv = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey };
  const localWrite = await handleProviders(
    new Request("http://127.0.0.1:8787/api/providers/openai", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "sk-local" })
    }),
    localEnv
  );
  assert.equal(localWrite.status, 200);
  assert.equal((await localWrite.json()).provider.configured, true);

  const localRead = await handleProviders(
    new Request("http://localhost:8787/api/providers", { method: "GET" }),
    localEnv
  );
  const localReadBody = await localRead.json();
  assert.equal(localReadBody.writeMode, "local-dev");
  assert.equal(localReadBody.writable, true);

  // Production behind Cloudflare Access: opt in once with CF_ACCESS_TRUSTED=1.
  const accessEnv = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey, CF_ACCESS_TRUSTED: "1" };
  const accessWrite = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/openai", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "sk-access" })
    }),
    accessEnv
  );
  assert.equal(accessWrite.status, 200);

  const authorized = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/openai", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer admin-secret-token" },
      body: JSON.stringify({
        endpoint: "https://asr.example.com/v1",
        model: "whisper-1",
        apiKey: "sk-live-abcdef1234"
      })
    }),
    routeEnv
  );
  assert.equal(authorized.status, 200);
  const writeBody = await authorized.json();
  assert.equal(writeBody.provider.keyTail, "••••1234");
  assert.ok(!JSON.stringify(writeBody).includes("sk-live"), "write response must not echo the key");

  const readBack = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers", { method: "GET" }),
    routeEnv
  );
  const readBackBody = await readBack.json();
  assert.ok(!JSON.stringify(readBackBody).includes("sk-live"), "GET must never return the plaintext key");
  assert.equal(readBackBody.providers.find(entry => entry.provider === "openai").configured, true);

  const badEndpoint = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/google", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer admin-secret-token" },
      body: JSON.stringify({ endpoint: "file:///etc/passwd" })
    }),
    routeEnv
  );
  assert.equal(badEndpoint.status, 400);

  const unknownProvider = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/nope", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer admin-secret-token" },
      body: JSON.stringify({})
    }),
    routeEnv
  );
  assert.equal(unknownProvider.status, 404);
}

console.log("Verified encrypted provider secret storage and settings API.");
