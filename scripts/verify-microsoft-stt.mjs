import assert from "node:assert/strict";
import { accessTokenAudienceProblem, accessTokenExpiry, isAccessTokenExpired, refreshAccessToken, decodeAccessToken } from "../src/microsoft/oauth.js";
import { buildMicrosoftEndpoint, transcribeWithMicrosoft } from "../src/microsoft/stt.js";
import { getMicrosoftAccount, listProviderStatus, saveMicrosoftTokens } from "../src/secrets/store.js";
import { handleAudioTranscription } from "../src/routes/transcriptions.js";
import { handleProviders } from "../src/routes/providers.js";
import { bytesToBase64 } from "../src/secrets/crypto.js";

function base64Url(value) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build an unsigned token with real-looking claims (signature is not checked). */
function fakeJwt({ exp, aud = "https://cognitiveservices.azure.com" }) {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ aud, iss: "https://sts.windows.net/tenant/", exp }));
  return `${header}.${payload}.signature`;
}

/** In-memory D1 covering the statements the store issues. */
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
          if (!statement.includes("FROM provider_config")) throw new Error(`unexpected SELECT: ${statement}`);
          return { results: Array.from(rows.values()).map(row => ({ ...row })) };
        },
        async run() {
          if (statement.includes("INSERT INTO provider_config")) {
            const [
              provider, endpoint, model, apiKeyCipher, updatedAt,
              region, refreshCipher, tokenUpdatedAt, accessCipher, accessExpiresAt
            ] = this._params;
            rows.set(provider, {
              provider,
              endpoint,
              model,
              api_key_cipher: apiKeyCipher,
              updated_at: updatedAt,
              region,
              refresh_token_cipher: refreshCipher,
              token_updated_at: tokenUpdatedAt,
              access_token_cipher: accessCipher,
              access_token_expires_at: accessExpiresAt
            });
            return { success: true };
          }
          if (statement.includes("UPDATE provider_config") && statement.includes("refresh_token_cipher = ''")) {
            const row = rows.get("microsoft");
            if (row) {
              rows.set("microsoft", {
                ...row,
                refresh_token_cipher: "",
                token_updated_at: "",
                access_token_cipher: "",
                access_token_expires_at: ""
              });
            }
            return { success: true };
          }
          throw new Error(`unexpected WRITE: ${statement}`);
        }
      };
    }
  };
}

const encryptionKey = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
const futureExp = Math.floor(Date.now() / 1000) + 3600;
const expiredExp = Math.floor(Date.now() / 1000) - 60;

// 1. JWT helpers: expiry, audience check.
{
  const valid = fakeJwt({ exp: futureExp });
  assert.equal(accessTokenExpiry(valid), futureExp);
  assert.equal(isAccessTokenExpired(valid), false);
  assert.equal(isAccessTokenExpired(fakeJwt({ exp: expiredExp })), true);
  assert.equal(decodeAccessToken("not-a-jwt"), null);
  assert.equal(accessTokenAudienceProblem(valid), null);
  assert.equal(accessTokenAudienceProblem(fakeJwt({ exp: futureExp, aud: "https://graph.microsoft.com" })), "这个 access token 的 audience 是 https://graph.microsoft.com，不是 https://cognitiveservices.azure.com");
}

// 2. Endpoint: region -> host, override wins, bad region is refused.
{
  assert.equal(buildMicrosoftEndpoint({ region: "eastasia" }), "https://eastasia.api.cognitive.microsoft.com");
  assert.throws(() => buildMicrosoftEndpoint({ region: "" }), /区域/);
  assert.throws(() => buildMicrosoftEndpoint({ region: "bad region!" }), /区域/);
}

// 3. Fast transcription request shape and ms -> s mapping.
{
  const originalFetch = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), headers: init.headers, body: init.body };
    return new Response(JSON.stringify({
      combinedPhrases: [{ text: "你好世界。" }],
      phrases: [{
        offsetMilliseconds: 100,
        durationMilliseconds: 900,
        text: "你好世界。",
        speaker: 1,
        words: [
          { text: "你好", offsetMilliseconds: 100, durationMilliseconds: 400 },
          { text: "世界", offsetMilliseconds: 500, durationMilliseconds: 400 }
        ]
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await transcribeWithMicrosoft({
      accessToken: "pasted-token",
      endpoint: "https://eastasia.api.cognitive.microsoft.com",
      data: new Blob(["audio"], { type: "audio/mpeg" }),
      filename: "sample.mp3",
      locale: "zh-CN"
    });

    assert.equal(seen.url, "https://eastasia.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15");
    assert.equal(seen.headers.Authorization, "Bearer pasted-token");
    assert.deepEqual(JSON.parse(seen.body.get("definition")).locales, ["zh-CN"]);
    assert.deepEqual(result.words.map(word => [word.text, word.start, word.end, word.speaker]), [
      ["你好", 0.1, 0.5, 1],
      ["世界", 0.5, 0.9, 1]
    ]);
    assert.deepEqual(
      result.sentences.map(sentence => [sentence.text, sentence.start, sentence.end, sentence.duration]),
      [["你好世界。", 0.1, 1, 0.9]]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 4. Route: a pasted access token is used directly, no refresh call.
{
  const env = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey, ADMIN_TOKEN: "admin-token" };
  await saveMicrosoftTokens(env, { accessToken: fakeJwt({ exp: futureExp }) });
  await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/microsoft", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer admin-token" },
      body: JSON.stringify({ region: "eastasia" })
    }),
    env
  );

  const account = await getMicrosoftAccount(env);
  assert.equal(account.accessTokenExpired, false);
  assert.ok(account.accessToken.startsWith("ey"), "the stored access token should decrypt back to the JWT");
  assert.ok(account.accessTokenExpiresAt, "expiry should be derived from the JWT exp claim");

  const status = (await listProviderStatus(env)).find(entry => entry.provider === "microsoft");
  assert.equal(status.connected, true);
  assert.ok(!JSON.stringify(status).includes("eyJ"), "the status payload must not leak the token");

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("api.cognitive.microsoft.com")) {
      return new Response(JSON.stringify({
        combinedPhrases: [{ text: "你好" }],
        phrases: [{ offsetMilliseconds: 0, durationMilliseconds: 500, text: "你好", words: [{ text: "你好", offsetMilliseconds: 0, durationMilliseconds: 500 }] }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const formData = new FormData();
    formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
    formData.append("engine", "microsoft");

    const response = await handleAudioTranscription(
      new Request("https://voicecraft.example.com/v1/audio/transcriptions", { method: "POST", body: formData }),
      env
    );
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.text, "你好");
    assert.ok(!calls.some(url => url.includes("login.microsoftonline.com")), "a valid access token must not trigger a refresh");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 5. Expired access token + refresh token + client id -> refresh and persist.
{
  const env = {
    DB: createFakeD1(),
    SECRETS_ENCRYPTION_KEY: encryptionKey,
    ADMIN_TOKEN: "admin-token",
    MICROSOFT_CLIENT_ID: "client-id-123",
    MICROSOFT_TENANT: "common"
  };
  await saveMicrosoftTokens(env, { accessToken: fakeJwt({ exp: expiredExp }), refreshToken: "refresh-old" });
  await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/microsoft", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer admin-token" },
      body: JSON.stringify({ region: "eastasia" })
    }),
    env
  );

  assert.equal((await getMicrosoftAccount(env)).accessTokenExpired, true);

  const originalFetch = globalThis.fetch;
  let tokenRequest;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("login.microsoftonline.com")) {
      tokenRequest = init.body;
      return new Response(JSON.stringify({
        access_token: fakeJwt({ exp: futureExp }),
        refresh_token: "refresh-rotated",
        expires_in: 3599
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (String(url).includes("api.cognitive.microsoft.com")) {
      return new Response(JSON.stringify({
        combinedPhrases: [{ text: "ok" }],
        phrases: [{ offsetMilliseconds: 0, durationMilliseconds: 100, text: "ok", words: [{ text: "ok", offsetMilliseconds: 0, durationMilliseconds: 100 }] }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const formData = new FormData();
    formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
    formData.append("engine", "microsoft");

    const response = await handleAudioTranscription(
      new Request("https://voicecraft.example.com/v1/audio/transcriptions", { method: "POST", body: formData }),
      env
    );
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(tokenRequest.get("grant_type"), "refresh_token");
    assert.equal(tokenRequest.get("refresh_token"), "refresh-old");
    assert.equal(tokenRequest.get("client_id"), "client-id-123");
  } finally {
    globalThis.fetch = originalFetch;
  }

  const account = await getMicrosoftAccount(env);
  assert.equal(account.refreshToken, "refresh-rotated", "the rotated refresh token must be persisted");
  assert.equal(account.accessTokenExpired, false, "the renewed access token must be stored");
}

// 6. Expired without a refresh token -> clear, actionable 401.
{
  const env = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey };
  await saveMicrosoftTokens(env, { accessToken: fakeJwt({ exp: expiredExp }) });

  const formData = new FormData();
  formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
  formData.append("engine", "microsoft");
  formData.append("region", "eastasia");

  const response = await handleAudioTranscription(
    new Request("https://voicecraft.example.com/v1/audio/transcriptions", { method: "POST", body: formData }),
    env
  );
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "microsoft_token_expired");
}

// 7. Wrong audience is rejected before hitting Azure.
{
  const env = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey };
  await saveMicrosoftTokens(env, { accessToken: fakeJwt({ exp: futureExp, aud: "https://graph.microsoft.com" }) });

  const formData = new FormData();
  formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
  formData.append("engine", "microsoft");
  formData.append("region", "eastasia");

  const response = await handleAudioTranscription(
    new Request("https://voicecraft.example.com/v1/audio/transcriptions", { method: "POST", body: formData }),
    env
  );
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "microsoft_token_wrong_audience");
}

// 8. No tokens at all -> microsoft_token_required.
{
  const formData = new FormData();
  formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
  formData.append("engine", "microsoft");

  const response = await handleAudioTranscription(
    new Request("https://voicecraft.example.com/v1/audio/transcriptions", { method: "POST", body: formData }),
    { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey }
  );
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "microsoft_token_required");
}

// 9. Paste + clear through the settings API; tokens never come back.
{
  // No ADMIN_TOKEN: the worker trusts Cloudflare Access, so writes are allowed.
  const env = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey, CF_ACCESS_TRUSTED: "1" };

  const pasted = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/microsoft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "",
        model: "",
        region: "westeurope",
        accessToken: fakeJwt({ exp: futureExp }),
        refreshToken: "refresh-pasted"
      })
    }),
    env
  );
  assert.equal(pasted.status, 200);
  const pastedBody = await pasted.json();
  assert.equal(pastedBody.provider.connected, true);
  assert.equal(pastedBody.provider.region, "westeurope");
  assert.ok(!JSON.stringify(pastedBody).includes("eyJ"), "the response must not echo the token");

  const account = await getMicrosoftAccount(env);
  assert.equal(account.refreshToken, "refresh-pasted");

  const cleared = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/microsoft/clear-tokens", { method: "POST" }),
    env
  );
  assert.equal(cleared.status, 200);
  assert.equal((await cleared.json()).provider.connected, false);
  assert.equal((await getMicrosoftAccount(env)).accessToken, "");
}

// 10. Refresh needs a client id; without one the route says so.
{
  const env = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey };
  await saveMicrosoftTokens(env, { accessToken: fakeJwt({ exp: expiredExp }), refreshToken: "refresh-x" });

  const formData = new FormData();
  formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
  formData.append("engine", "microsoft");
  formData.append("region", "eastasia");

  const response = await handleAudioTranscription(
    new Request("https://voicecraft.example.com/v1/audio/transcriptions", { method: "POST", body: formData }),
    env
  );
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "microsoft_token_expired");
  assert.match(body.error.message, /MICROSOFT_CLIENT_ID/);
}

// 11. A refresh failure is reported, not swallowed.
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: "invalid_grant",
    error_description: "AADSTS70008: refresh token expired"
  }), { status: 400, headers: { "Content-Type": "application/json" } });

  try {
    await assert.rejects(
      () => refreshAccessToken({ env: { MICROSOFT_CLIENT_ID: "client-id", MICROSOFT_TENANT: "common" }, refreshToken: "dead" }),
      /AADSTS70008/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 12. A subscription key is used directly (long-lived, no token needed).
{
  const env = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey, CF_ACCESS_TRUSTED: "1" };
  const saved = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/microsoft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: "eastasia", apiKey: "speech-key-1234" })
    }),
    env
  );
  assert.equal(saved.status, 200);

  const account = await getMicrosoftAccount(env);
  assert.equal(account.subscriptionKey, "speech-key-1234");

  const originalFetch = globalThis.fetch;
  let headers;
  globalThis.fetch = async (url, init) => {
    headers = init.headers;
    return new Response(JSON.stringify({
      combinedPhrases: [{ text: "ok" }],
      phrases: [{ offsetMilliseconds: 0, durationMilliseconds: 100, text: "ok", words: [{ text: "ok", offsetMilliseconds: 0, durationMilliseconds: 100 }] }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const formData = new FormData();
    formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
    formData.append("engine", "microsoft");

    const response = await handleAudioTranscription(
      new Request("https://voicecraft.example.com/v1/audio/transcriptions", { method: "POST", body: formData }),
      env
    );
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(headers["Ocp-Apim-Subscription-Key"], "speech-key-1234");
    assert.equal(headers.Authorization, undefined, "a key must not be sent as a bearer token");
  } finally {
    globalThis.fetch = originalFetch;
  }

  const status = (await listProviderStatus(env)).find(entry => entry.provider === "microsoft");
  assert.ok(!JSON.stringify(status).includes("speech-key-1234"), "status must only expose the masked tail");
}

console.log("Verified Microsoft pasted-token storage and Azure fast transcription flow.");
