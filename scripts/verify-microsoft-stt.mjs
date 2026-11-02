import assert from "node:assert/strict";
import { buildAuthorizeUrl, createPkcePair, createState, exchangeCode, refreshAccessToken } from "../src/microsoft/oauth.js";
import { buildMicrosoftEndpoint, transcribeWithMicrosoft } from "../src/microsoft/stt.js";
import { getMicrosoftAccount, saveMicrosoftRefreshToken, listProviderStatus } from "../src/secrets/store.js";
import { handleAudioTranscription } from "../src/routes/transcriptions.js";
import { handleProviders } from "../src/routes/providers.js";
import { bytesToBase64 } from "../src/secrets/crypto.js";

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
            const [provider, endpoint, model, apiKeyCipher, updatedAt, region, refreshCipher, tokenUpdatedAt] = this._params;
            rows.set(provider, {
              provider,
              endpoint,
              model,
              api_key_cipher: apiKeyCipher,
              updated_at: updatedAt,
              region,
              refresh_token_cipher: refreshCipher,
              token_updated_at: tokenUpdatedAt
            });
            return { success: true };
          }
          if (statement.includes("UPDATE provider_config") && statement.includes("refresh_token_cipher = ''")) {
            const row = rows.get("microsoft");
            if (row) {
              rows.set("microsoft", { ...row, refresh_token_cipher: "", token_updated_at: "" });
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
const oauthEnv = {
  MICROSOFT_CLIENT_ID: "client-id-123",
  MICROSOFT_CLIENT_SECRET: "client-secret-456",
  MICROSOFT_TENANT: "contoso.onmicrosoft.com"
};

// 1. Authorize URL carries the Speech scope, PKCE and the callback.
{
  const state = createState();
  const { verifier, challenge } = await createPkcePair();
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(verifier, challenge);

  const url = new URL(buildAuthorizeUrl({
    env: oauthEnv,
    redirectUri: "https://voicecraft.example.com/api/microsoft/callback",
    state,
    codeChallenge: challenge
  }));

  assert.equal(url.host, "login.microsoftonline.com");
  assert.equal(url.pathname, "/contoso.onmicrosoft.com/oauth2/v2.0/authorize");
  assert.equal(url.searchParams.get("client_id"), "client-id-123");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("redirect_uri"), "https://voicecraft.example.com/api/microsoft/callback");
  assert.equal(url.searchParams.get("scope"), "https://cognitiveservices.azure.com/.default offline_access");
  assert.equal(url.searchParams.get("code_challenge"), challenge);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("state"), state);
  assert.ok(!url.toString().includes("client-secret-456"), "the client secret must never reach the browser");
}

// 2. Token endpoints: code exchange and refresh rotation.
{
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init.body });
    const grant = init.body.get("grant_type");
    return new Response(JSON.stringify({
      access_token: grant === "authorization_code" ? "access-1" : "access-2",
      refresh_token: grant === "authorization_code" ? "refresh-1" : "refresh-2",
      expires_in: 3599
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const code = await exchangeCode({
      env: oauthEnv,
      code: "auth-code",
      redirectUri: "https://voicecraft.example.com/api/microsoft/callback",
      codeVerifier: "verifier-value"
    });
    assert.deepEqual(code, { accessToken: "access-1", refreshToken: "refresh-1", expiresIn: 3599 });
    assert.equal(calls[0].body.get("grant_type"), "authorization_code");
    assert.equal(calls[0].body.get("code_verifier"), "verifier-value");
    assert.equal(calls[0].body.get("client_secret"), "client-secret-456");

    const refreshed = await refreshAccessToken({ env: oauthEnv, refreshToken: "refresh-1" });
    assert.deepEqual(refreshed, { accessToken: "access-2", refreshToken: "refresh-2", expiresIn: 3599 });
    assert.equal(calls[1].body.get("grant_type"), "refresh_token");
    assert.equal(calls[1].body.get("refresh_token"), "refresh-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 3. Endpoint: region -> host, override wins, bad region is refused.
{
  assert.equal(buildMicrosoftEndpoint({ region: "eastasia" }), "https://eastasia.api.cognitive.microsoft.com");
  assert.equal(
    buildMicrosoftEndpoint({ endpoint: "https://gateway.example.com/azure/" }),
    "https://gateway.example.com/azure"
  );
  assert.throws(() => buildMicrosoftEndpoint({ region: "" }), /区域/);
  assert.throws(() => buildMicrosoftEndpoint({ region: "bad region!" }), /区域/);
}

// 4. Fast transcription request shape and response mapping (ms -> seconds).
{
  const originalFetch = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), headers: init.headers, body: init.body };
    return new Response(JSON.stringify({
      durationMilliseconds: 2000,
      combinedPhrases: [{ text: "你好世界。" }],
      phrases: [
        {
          offsetMilliseconds: 100,
          durationMilliseconds: 900,
          text: "你好世界。",
          speaker: 1,
          words: [
            { text: "你好", offsetMilliseconds: 100, durationMilliseconds: 400 },
            { text: "世界", offsetMilliseconds: 500, durationMilliseconds: 400 }
          ]
        }
      ]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await transcribeWithMicrosoft({
      accessToken: "access-token",
      endpoint: "https://eastasia.api.cognitive.microsoft.com",
      data: new Blob(["audio"], { type: "audio/mpeg" }),
      filename: "sample.mp3",
      mimeType: "audio/mpeg",
      locale: "zh-CN"
    });

    assert.equal(seen.url, "https://eastasia.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15");
    assert.equal(seen.headers.Authorization, "Bearer access-token");
    assert.ok(!("Ocp-Apim-Subscription-Key" in seen.headers), "AAD auth must not send a subscription key");

    const audio = seen.body.get("audio");
    assert.equal(audio.name, "sample.mp3");
    const definition = JSON.parse(seen.body.get("definition"));
    assert.deepEqual(definition.locales, ["zh-CN"]);
    assert.deepEqual(definition.diarization, { enabled: true, maxSpeakers: 4 });

    assert.equal(result.text, "你好世界。");
    assert.deepEqual(result.words.map(word => [word.text, word.start, word.end, word.speaker]), [
      ["你好", 0.1, 0.5, 1],
      ["世界", 0.5, 0.9, 1]
    ]);
    assert.deepEqual(
      result.sentences.map(sentence => [sentence.text, sentence.start, sentence.end, sentence.duration, sentence.speaker]),
      [["你好世界。", 0.1, 1, 0.9, 1]]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 5. Route end to end: stored refresh token -> token refresh -> transcription,
//    with the rotated refresh token persisted.
{
  const env = {
    DB: createFakeD1(),
    SECRETS_ENCRYPTION_KEY: encryptionKey,
    ADMIN_TOKEN: "admin-token",
    ...oauthEnv
  };
  await saveMicrosoftRefreshToken(env, "refresh-old");

  const account = await getMicrosoftAccount(env);
  assert.equal(account.refreshToken, "refresh-old");
  assert.equal(account.tokenError, null);

  const status = (await listProviderStatus(env)).find(entry => entry.provider === "microsoft");
  assert.equal(status.connected, true);
  assert.equal(status.keySource, "oauth");
  assert.ok(!JSON.stringify(status).includes("refresh-old"));

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const href = String(url);
    calls.push(href);
    if (href.includes("login.microsoftonline.com")) {
      return new Response(JSON.stringify({
        access_token: "access-fresh",
        refresh_token: "refresh-rotated",
        expires_in: 3599
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (href.includes("eastasia.api.cognitive.microsoft.com")) {
      assert.equal(init.headers.Authorization, "Bearer access-fresh");
      return new Response(JSON.stringify({
        combinedPhrases: [{ text: "你好" }],
        phrases: [{ offsetMilliseconds: 0, durationMilliseconds: 500, text: "你好", words: [{ text: "你好", offsetMilliseconds: 0, durationMilliseconds: 500 }] }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`unexpected fetch: ${href}`);
  };

  try {
    const formData = new FormData();
    formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
    formData.append("engine", "microsoft");
    formData.append("region", "eastasia");

    const response = await handleAudioTranscription(
      new Request("https://voicecraft.example.com/v1/audio/transcriptions", { method: "POST", body: formData }),
      env
    );
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.text, "你好");
    assert.equal(body.words[0].text, "你好");
    assert.equal(body.sentences[0].duration, 0.5);
    assert.ok(calls.some(href => href.includes("login.microsoftonline.com")));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(
    (await getMicrosoftAccount(env)).refreshToken,
    "refresh-rotated",
    "the rotated refresh token must replace the old one"
  );
}

// 6. Region comes from the saved provider row when the request omits it.
{
  const env = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey, ...oauthEnv };
  await saveMicrosoftRefreshToken(env, "refresh-row");
  await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/microsoft", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer admin-token" },
      body: JSON.stringify({ region: "westeurope" })
    }),
    { ...env, ADMIN_TOKEN: "admin-token" }
  );
  assert.equal((await getMicrosoftAccount(env)).region, "westeurope");
}

// 7. Login/logout routes: admin-guarded, and login refuses without OAuth config.
{
  const env = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey, ADMIN_TOKEN: "admin-token", ...oauthEnv };
  await saveMicrosoftRefreshToken(env, "refresh-x");

  const anon = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/microsoft/login", { method: "POST" }),
    env
  );
  assert.equal(anon.status, 401);

  const login = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/microsoft/login", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" }
    }),
    env
  );
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  assert.ok(loginBody.authorizeUrl.startsWith("https://login.microsoftonline.com/"));
  const cookie = login.headers.get("set-cookie") || "";
  assert.match(cookie, /vc_ms_oauth=/);
  assert.match(cookie, /HttpOnly/);
  assert.ok(!cookie.includes("client-secret-456"));

  const unconfigured = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/microsoft/login", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" }
    }),
    { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey, ADMIN_TOKEN: "admin-token" }
  );
  assert.equal(unconfigured.status, 503);

  const logout = await handleProviders(
    new Request("https://voicecraft.example.com/api/providers/microsoft/logout", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" }
    }),
    env
  );
  assert.equal(logout.status, 200);
  const logoutBody = await logout.json();
  assert.equal(logoutBody.provider.connected, false);
  assert.equal((await getMicrosoftAccount(env)).refreshToken, "");
}

console.log("Verified Microsoft OAuth + Azure fast transcription flow.");
