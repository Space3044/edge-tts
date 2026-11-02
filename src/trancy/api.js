/**
 * The only two things the gateway is allowed to say to Trancy.
 *
 * `fetchTrancyProfile` doubles as the renewal: the endpoint answers with a
 * freshly issued token whose `iat` is the current second, and an unrefreshed
 * token keeps working for a window we have not measured. Calling it daily from
 * the cron therefore keeps every account alive without a refresh token.
 *
 * Two behaviours differ from a normal REST API and both are load-bearing:
 *
 * - Authentication failure is NOT a 401. An invalid, expired or missing token
 *   gets `200 {"data":null,"message":"ok"}`, so callers must test `data`.
 * - `data` also comes back null for a bare `/1/user/profile` without a token,
 *   which is why "no auth at all" and "auth rejected" cannot be told apart.
 */

export const TRANCY_API_ORIGIN = "https://api.trancy.org";
export const TRANCY_PROFILE_PATH = "/1/user/profile";
export const TRANCY_LOGIN_PATH = "/1/login";
export const TRANCY_SIGNUP_PATH = "/1/signup";
export const TRANCY_CAPTION_VERSION = "3";
export const TRANCY_CAPTION_SOURCES = Object.freeze(["audio", "json3"]);
export const TRANCY_DEFAULT_CAPTION_SOURCE = "audio";
const REQUEST_TIMEOUT_MS = 15000;

function timeoutSignal() {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    }
    return undefined;
}

async function readJson(response) {
    const text = await response.text();
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/**
 * Email/password auth, shared by signup and login.
 *
 * Both endpoints answer `200 {"message":"ok","data":{...,"token":"eyJ..."}}` on
 * success and `200 {"code":409,"message":"Incorrect password"}` on failure - the
 * HTTP status is never the signal, so `message` is what decides. A successful
 * call is already a usable credential: no mailbox confirmation, no cookie, no
 * second round trip.
 */
async function postAuthCredentials(path, { email, password }, { fetchImpl = fetch } = {}) {
    const account = String(email || "").trim();
    const secret = String(password || "");
    if (!account || !secret) {
        return { ok: false, reason: "missing_credentials", message: "邮箱和密码都要填", token: "", profile: null };
    }

    let response;
    try {
        response = await fetchImpl(`${TRANCY_API_ORIGIN}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-locale": "en",
                Accept: "application/json"
            },
            body: JSON.stringify({ email: account, password: secret }),
            signal: timeoutSignal()
        });
    } catch (error) {
        return { ok: false, reason: "network", message: String(error?.message || error), token: "", profile: null };
    }

    const payload = await readJson(response);
    if (!response.ok) {
        return { ok: false, reason: `http_${response.status}`, message: payload?.message || "", token: "", profile: null };
    }
    if (payload?.message !== "ok" || !payload?.data?.token) {
        return {
            ok: false,
            reason: "rejected",
            message: String(payload?.message || "Trancy 拒绝了这次登录"),
            token: "",
            profile: null
        };
    }

    const data = payload.data;
    return {
        ok: true,
        reason: null,
        message: "ok",
        token: String(data.token),
        profile: {
            userId: String(data._id || data.id || ""),
            name: String(data.name || ""),
            email: String(data.email || account),
            premium: data.premium === true || Boolean(data.stripePremiumActive),
            banned: data.banned === true,
            aiEngine: data.AIEngineActive === true || data.stripeAIEngineActive === true
        }
    };
}

/** `POST /1/login` — also the one-click re-login path once a token dies. */
export async function loginTrancyCredentials(credentials, options = {}) {
    return postAuthCredentials(TRANCY_LOGIN_PATH, credentials, options);
}

/** `POST /1/signup` — creates the account and returns its first token. */
export async function signupTrancyCredentials(credentials, options = {}) {
    return postAuthCredentials(TRANCY_SIGNUP_PATH, credentials, options);
}

/**
 * `GET /1/user/profile`.
 *
 * Returns `{ ok, reason, token, profile }` where `reason` is one of
 * `token_invalid` (Trancy refused the credential), `http_<status>`, or
 * `network`. On success `token` is the renewed credential to persist.
 */
export async function fetchTrancyProfile(token, { fetchImpl = fetch } = {}) {
    let response;
    try {
        response = await fetchImpl(`${TRANCY_API_ORIGIN}${TRANCY_PROFILE_PATH}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "x-locale": "en",
                Accept: "application/json"
            },
            signal: timeoutSignal()
        });
    } catch (error) {
        return { ok: false, reason: "network", error: String(error?.message || error), token: "", profile: null };
    }

    if (!response.ok) {
        // 401/403 never happen in practice; treat any non-2xx as a soft failure
        // so a single bad request does not mark the account dead.
        await response.text().catch(() => "");
        return { ok: false, reason: `http_${response.status}`, error: null, token: "", profile: null };
    }

    const payload = await readJson(response);
    const profile = payload?.data;
    if (!profile || typeof profile !== "object") {
        return { ok: false, reason: "token_invalid", error: null, token: "", profile: null };
    }

    return {
        ok: true,
        reason: null,
        error: null,
        token: String(profile.token || token),
        profile: {
            userId: String(profile._id || profile.id || ""),
            name: String(profile.name || ""),
            email: String(profile.email || ""),
            premium: profile.premium === true || Boolean(profile.stripePremiumActive),
            banned: profile.banned === true,
            aiEngine: profile.AIEngineActive === true || profile.stripeAIEngineActive === true
        }
    };
}

/**
 * `GET /3/youtube/captions/{videoId}?target=en&source=audio|json3`
 *
 * Synchronous: the whole transcript (sentences plus word timings) comes back in
 * one response, no job id, no polling. What makes it interesting is that each
 * free account may only do a handful a day, and the refusal is shaped like
 * every other Trancy error - HTTP 200 with `{"code":403,"message":"You've
 * reached the daily limit of 5 AI subtitles for free users..."}`. The response
 * headers `x-quota-limit` / `x-quota-remaining` are the only structured signal,
 * so both are read and handed back for the scheduler to persist.
 */
export async function fetchYoutubeCaptions({ token, videoId, target = "en", source = TRANCY_DEFAULT_CAPTION_SOURCE, fetchImpl = fetch } = {}) {
    const url = `${TRANCY_API_ORIGIN}/${TRANCY_CAPTION_VERSION}/youtube/captions/${encodeURIComponent(videoId)}`
        + `?target=${encodeURIComponent(target)}&source=${encodeURIComponent(source)}`;

    let response;
    try {
        response = await fetchImpl(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "x-locale": "en",
                Accept: "application/json"
            },
            signal: timeoutSignal()
        });
    } catch (error) {
        return { ok: false, reason: "network", message: String(error?.message || error), sentences: null, quota: { limit: -1, remaining: -1 } };
    }

    const rawLimit = response.headers.get("x-quota-limit");
    const rawRemaining = response.headers.get("x-quota-remaining");
    const limit = rawLimit !== null && rawLimit !== "" && Number.isFinite(Number(rawLimit)) ? Number(rawLimit) : -1;
    const remaining = rawRemaining !== null && rawRemaining !== "" && Number.isFinite(Number(rawRemaining)) ? Number(rawRemaining) : -1;
    const quota = {
        limit,
        remaining
    };

    const payload = await readJson(response);

    if (!response.ok) {
        return { ok: false, reason: `http_${response.status}`, message: payload?.message || "", sentences: null, quota };
    }

    if (Array.isArray(payload?.data)) {
        return { ok: true, reason: null, message: "ok", sentences: payload.data, quota };
    }

    const message = String(payload?.message || "");
    if (payload?.code === 403 || /daily limit/i.test(message)) {
        return { ok: false, reason: "daily_limit", message, sentences: null, quota };
    }

    return { ok: false, reason: "rejected", message: message || "Trancy 没有返回字幕", sentences: null, quota };
}
