/**
 * Trancy authentication, caption reads, generation submission and status queries.
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
    if (payload?.message === "ok" && payload?.data === null) {
        return { ok: false, reason: "token_invalid", error: null, token: "", profile: null };
    }
    if (!profile || typeof profile !== "object" || Array.isArray(profile)
        || !(profile._id || profile.id) || (payload.code && Number(payload.code) !== 200)) {
        return { ok: false, reason: "invalid_response", error: String(payload?.message || "Trancy profile 响应无效"), token: "", profile: null };
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

/** Quota headers are observations; native captions never update AI balance. */
function captionQuota(response, source) {
    const parse = value => value !== null && /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) ? Number(value) : -1;
    return source === "json3" ? { limit: -1, remaining: -1 } : {
        limit: parse(response.headers.get("x-quota-limit")),
        remaining: parse(response.headers.get("x-quota-remaining"))
    };
}

async function captionRequest(path, { token, source = "audio", body, fetchImpl = fetch }) {
    let response;
    let payload;
    try {
        response = await fetchImpl(`${TRANCY_API_ORIGIN}${path}`, {
            method: body ? "POST" : "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "x-locale": "en",
                Accept: "application/json",
                ...(body ? { "Content-Type": "application/json" } : {})
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: timeoutSignal()
        });
        payload = await readJson(response);
    } catch {
        // In particular, a failed POST response does not prove no job was created.
        return { ok: false, reason: "network", message: "Trancy 请求超时或网络异常", quota: { limit: -1, remaining: -1 } };
    }
    const quota = captionQuota(response, source);
    const message = String(payload?.message || "");
    const code = Number(payload?.code ?? response.status);
    const failure = reason => ({ ok: false, reason, message, quota });
    if ((response.ok || response.status === 409) && code === 409
        && /^AI caption not found[.!]?$/i.test(message.trim())) return failure("caption_not_found");
    if ((response.ok || response.status === 403 || response.status === 429)
        && /daily\s+limit|daily\s+(?:AI\s+subtitle\s+)?quota/i.test(message)) return failure("daily_limit");
    if (code === 401 || /token.*(?:invalid|expired)|unauthor|login required/i.test(message)) return failure("authentication_required");
    if (code === 403) return failure("permission_denied");
    if (!response.ok) return failure(`http_${response.status}`);
    if (payload?.code && code !== 200) return failure("rejected");
    return { ok: true, payload, quota };
}

/** Reads an existing transcript; a missing AI track needs a separate POST. */
export async function fetchYoutubeCaptions({ token, videoId, target = "en", source = TRANCY_DEFAULT_CAPTION_SOURCE, fetchImpl = fetch } = {}) {
    const path = `/${TRANCY_CAPTION_VERSION}/youtube/captions/${encodeURIComponent(videoId)}`
        + `?target=${encodeURIComponent(target)}&source=${encodeURIComponent(source)}`;
    const result = await captionRequest(path, { token, source, fetchImpl });
    if (!result.ok) return { ...result, sentences: null };
    if (Array.isArray(result.payload?.data) && result.payload.data.length > 0) {
        return { ok: true, reason: null, message: "ok", sentences: result.payload.data, quota: result.quota };
    }
    return { ok: false, reason: "invalid_response", message: "Trancy 没有返回有效字幕", sentences: null, quota: result.quota };
}

/** Official client: POST /2/youtube/captions -> { message: "ok", data: "pending" }. */
export async function submitYoutubeCaptions({ token, videoId, target = "en", fetchImpl = fetch } = {}) {
    const result = await captionRequest("/2/youtube/captions", {
        token, fetchImpl,
        body: { id: videoId, title: "", cover: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            duration: 0, target, language: target, ipaddress: "1.1.1.1" }
    });
    if (!result.ok) return result;
    if (result.payload?.message === "ok" && ["pending", "downloaded", "ok"].includes(result.payload?.data)) {
        return { ok: true, status: result.payload.data, quota: result.quota };
    }
    return { ok: false, reason: "invalid_response", message: "Trancy 未确认生成任务，请先查询状态", quota: result.quota };
}

/** Upstream owns the job. Polling never submits a replacement or spends local usage. */
export async function fetchYoutubeCaptionStatus({ token, videoId, target = "en", fetchImpl = fetch } = {}) {
    const result = await captionRequest(`/2/youtube/captions/${encodeURIComponent(videoId)}/status?target=${encodeURIComponent(target)}`, { token, fetchImpl });
    if (!result.ok) return result;
    const status = result.payload?.data?.status;
    if (result.payload?.message === "ok" && ["none", "pending", "downloaded", "ok", "error"].includes(status)) {
        return { ok: true, status, retry: result.payload.data.retry === true, quota: result.quota };
    }
    return { ok: false, reason: "invalid_response", message: "Trancy 返回了未知的生成状态", quota: result.quota };
}
