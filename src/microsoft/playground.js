/**
 * Microsoft AI Playground transcription (free, cookie-authenticated).
 *
 * The playground only exposes an internal tRPC/SSE protocol, so the Worker
 * mirrors the call chain instead of using an API:
 *
 *   1. POST /api/trpc/conversations.create?batch=1
 *   2. POST /api/trpc/conversations.addAudioPromptAndInitResponse?batch=1
 *      (audio travels as base64 inside JSON — the only upload shape it accepts)
 *   3. POST /api/chat/stream  (SSE) -> a `rich_transcription` object
 *   4. POST /api/trpc/conversations.delete?batch=1  (best effort cleanup)
 *
 * Server-side limits: raw audio must be mp3/wav, <= 25 MiB, <= 3615 s.
 * Authentication is the `AppServiceAuthSession` cookie of a signed-in account.
 * That cookie is a server-side session: when it expires the Worker cannot
 * renew it on its own, because the silent SSO path needs the Microsoft
 * identity cookies that live on login.microsoftonline.com — a different
 * domain that a Worker-side request cannot reach with the playground cookie
 * string. Expiry therefore means "paste a fresh cookie".
 */

import { applySetCookies, cookieHeaderFor, hasDomain, parseCookieJar, serializeCookieJar, LOGIN_HOST, PLAYGROUND_HOST } from "./cookies.js";

export const PLAYGROUND_BASE = "https://playground.microsoft.ai";
export const PLAYGROUND_MODEL = "mai-transcribe-2";
export const PLAYGROUND_MAX_BYTES = 0x1900000; // 25 MiB, measured on the raw file
export const PLAYGROUND_MAX_SECONDS = 3615;
const PLAYGROUND_ALLOWED_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"];
const STREAM_TIMEOUT_MS = 600000;

/** Parse a pasted cookie header ("a=1; b=2") or a JSON cookie array. */
export function parseCookieString(input) {
    return parseCookieJar(input)
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join("; ");
}

/**
 * Renew the short-lived playground session from the Microsoft identity
 * cookies, following the same hops a browser makes:
 *
 *   1. GET  playground /.auth/login/aad?prompt=none     -> 302 to the IdP
 *   2. GET  login.microsoftonline.com/...                -> form_post with code+state
 *   3. POST playground /.auth/login/aad/callback         -> new AppServiceAuthSession
 *
 * Step 2 only succeeds while the identity cookies (ESTSAUTH /
 * ESTSAUTHPERSISTENT, ~90 day sliding) are still valid, which is why one paste
 * of both domains keeps working for weeks instead of hours.
 */
export async function renewPlaygroundSession(inputJar) {
    const jar = Array.isArray(inputJar) ? inputJar.map(cookie => ({ ...cookie })) : parseCookieJar(inputJar);
    if (!jar.length) {
        throw new Error("Playground 未配置 cookie");
    }
    if (!hasDomain(jar, LOGIN_HOST)) {
        throw new Error(
            "只能续期带微软身份 cookie 的 jar：请从浏览器同时导出 playground.microsoft.ai 和 login.microsoftonline.com 两个域的 cookie"
        );
    }

    const loginEntry = `${PLAYGROUND_BASE}/.auth/login/aad?prompt=none&post_login_redirect_uri=%2Fchat`;
    const hop1 = await fetch(loginEntry, {
        headers: { Cookie: cookieHeaderFor(jar, loginEntry) },
        redirect: "manual"
    });
    let currentJar = applySetCookies(jar, collectSetCookies(hop1), loginEntry);

    const authorizeUrl = hop1.headers.get("location");
    if (!authorizeUrl) {
        throw new Error("Easy Auth 没有返回微软授权地址，无法续期");
    }

    const hop2 = await fetch(authorizeUrl, {
        headers: { Cookie: cookieHeaderFor(currentJar, authorizeUrl) },
        redirect: "manual"
    });
    currentJar = applySetCookies(currentJar, collectSetCookies(hop2), authorizeUrl);

    const page = hop2.ok ? await readFormPost(hop2) : null;
    const form = page?.form || null;
    if (!form) {
        const next = hop2.headers.get("location");
        if (hop2.status >= 300 && hop2.status < 400 && next) {
            throw new Error("微软要求重新登录（prompt=none 被拒绝），需要重新粘贴 cookie");
        }
        // A 200 HTML page instead of the auto-posted form means the IdP decided
        // the user must interact: there is no persistent SSO cookie
        // (ESTSAUTHPERSISTENT / ESTSAUTH) for this account, which happens when
        // "Stay signed in?" was declined or the tenant disables KMSI.
        if (page?.text && /interaction_required|login_required|Sign in to your account/i.test(page.text)) {
            throw new Error(
                "微软拒绝了静默登录：cookie 里没有长期身份 cookie（ESTSAUTHPERSISTENT）。"
                + "请退出后重新登录，并在「是否保持登录状态?」选「是」；如果组织禁用了该选项，就只能过期后重新粘贴 cookie"
            );
        }
        throw new Error("微软没有返回回调表单，无法续期");
    }

    const callbackUrl = form.action || `${PLAYGROUND_BASE}/.auth/login/aad/callback`;
    const hop3 = await fetch(callbackUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: cookieHeaderFor(currentJar, callbackUrl)
        },
        body: new URLSearchParams(form.fields).toString(),
        redirect: "manual"
    });
    currentJar = applySetCookies(currentJar, collectSetCookies(hop3), callbackUrl);

    const probe = await fetch(`${PLAYGROUND_BASE}/.auth/me`, {
        headers: { Cookie: cookieHeaderFor(currentJar, `${PLAYGROUND_BASE}/.auth/me`), Accept: "application/json" },
        redirect: "manual"
    }).catch(() => null);

    if (!probe || probe.status !== 200) {
        throw new Error("续期后会话仍无效，需要重新粘贴 cookie");
    }

    return { jar: currentJar, serialized: serializeCookieJar(currentJar) };
}

function collectSetCookies(response) {
    if (!response) return [];
    if (typeof response.headers.getSetCookie === "function") {
        return response.headers.getSetCookie();
    }
    return [response.headers.get("set-cookie")].filter(Boolean);
}

/** Extract the auto-submitted form fields Easy Auth posts back to the app. */
async function readFormPost(response) {
    const text = await response.text().catch(() => "");
    const formTag = text.match(/<form[^>]*action=["']([^"']+)["'][^>]*>/i);
    const action = formTag ? formTag[1].replace(/&amp;/g, "&") : "";

    const fields = {};
    const inputPattern = /<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["'][^>]*>/gi;
    let match;
    while ((match = inputPattern.exec(text))) {
        fields[match[1]] = match[2].replace(/&amp;/g, "&");
    }

    const hasCode = Object.keys(fields).some(name => name.toLowerCase() === "code");
    if (!hasCode && !action) {
        return { form: null, text };
    }
    return { form: { action, fields }, text };
}

async function postJson(jar, path, body, { requestId, signal } = {}) {
    const url = `${PLAYGROUND_BASE}${path}`;
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: cookieHeaderFor(jar, url)
    };
    if (requestId) {
        headers["x-request-id"] = requestId;
    }

    return fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        redirect: "manual",
        signal
    });
}

function deepFind(value, predicate) {
    const stack = [value];
    while (stack.length) {
        const current = stack.shift();
        if (current && typeof current === "object") {
            if (predicate(current)) return current;
            for (const child of Object.values(current)) {
                stack.push(child);
            }
        }
    }
    return null;
}

function findConversationId(payload) {
    const hit = deepFind(payload, node =>
        (typeof node.id === "string" && (node.title !== undefined || node.name !== undefined))
        || typeof node.conversationId === "string");
    if (!hit) return "";
    return typeof hit.conversationId === "string" ? hit.conversationId : hit.id;
}

/** Pull the last `rich_transcription` object out of an SSE body. */
export function extractRichTranscription(sseText) {
    let found = null;
    for (const event of String(sseText || "").split(/\r?\n\r?\n/)) {
        for (const line of event.split(/\r?\n/)) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            let parsed;
            try {
                parsed = JSON.parse(payload);
            } catch {
                continue;
            }
            const rich = deepFind(parsed, node =>
                node && typeof node === "object" && node.rich_transcription && typeof node.rich_transcription === "object");
            if (rich) {
                found = rich.rich_transcription;
            }
        }
    }
    return found;
}

function seconds(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

/** Normalize `rich_transcription` into the shape the other engines return. */
export function normalizeRichTranscription(rich) {
    const utterances = Array.isArray(rich?.utterances) ? rich.utterances : [];
    const words = [];
    const sentences = [];

    for (const utterance of utterances) {
        const start = seconds(utterance?.start);
        const end = seconds(utterance?.end);
        const speaker = utterance?.speaker === undefined || utterance?.speaker === null
            ? undefined
            : utterance.speaker;
        const text = String(utterance?.text ?? "").trim();

        if (text && start !== null && end !== null) {
            sentences.push({
                text,
                start,
                end,
                duration: Math.round((end - start) * 1000) / 1000,
                ...(speaker !== undefined ? { speaker } : {})
            });
        }

        for (const word of Array.isArray(utterance?.words) ? utterance.words : []) {
            const wordText = String(word?.text ?? word?.word ?? "").trim();
            const wordStart = seconds(word?.start);
            const wordEnd = seconds(word?.end);
            if (!wordText || wordStart === null || wordEnd === null) continue;
            words.push({
                text: wordText,
                start: wordStart,
                end: wordEnd,
                duration: Math.round((wordEnd - wordStart) * 1000) / 1000,
                type: "word",
                ...(speaker !== undefined ? { speaker } : {})
            });
        }
    }

    const text = sentences.map(sentence => sentence.text).join("\n").trim()
        || words.map(word => word.text).join(" ").trim();

    return { text, sentences, words };
}

export function transcribeWithPlayground({
    cookies,
    data,
    filename,
    mimeType = "audio/mpeg",
    diarize = true,
    signal
}) {
    return runTranscription({ cookies, data, filename, mimeType, diarize, signal });
}

async function runTranscription({ cookies, data, filename, mimeType, diarize, signal }) {
    const jar = parseCookieJar(cookies);
    if (!jar.length || !cookieHeaderFor(jar, PLAYGROUND_BASE)) {
        throw new Error("Playground 未配置 cookie：请登录 playground.microsoft.ai 后复制 cookie");
    }

    const type = String(mimeType || "").toLowerCase();
    const name = String(filename || "audio");
    const looksAudio = PLAYGROUND_ALLOWED_TYPES.some(allowed => type.includes(allowed))
        || /\.(mp3|wav)$/i.test(name);
    if (!looksAudio) {
        throw new Error("Playground 只接受 mp3 / wav 音频");
    }

    const bytes = data instanceof Blob ? await data.arrayBuffer() : data;
    if (bytes.byteLength > PLAYGROUND_MAX_BYTES) {
        throw new Error("Playground 单次上传上限 25MB，请压缩或切片后再试");
    }

    const audioBase64 = bytesToBase64(new Uint8Array(bytes));

    const timeout = AbortSignal.timeout(STREAM_TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([timeout, signal]) : timeout;

    const createResponse = await postJson(jar, "/api/trpc/conversations.create?batch=1", {
        0: { title: name, modelId: PLAYGROUND_MODEL }
    }, { signal: combined });

    if (createResponse.status === 401 || createResponse.status === 403 || createResponse.status === 302) {
        throw new Error("Playground cookie 已失效，请重新复制");
    }
    if (!createResponse.ok) {
        throw new Error(`Playground 创建会话失败（${createResponse.status}）`);
    }

    let conversationId = "";
    try {
        conversationId = findConversationId(await createResponse.json());
    } catch {
        conversationId = "";
    }
    if (!conversationId) {
        throw new Error("Playground 没有返回会话 id");
    }

    const addResponse = await postJson(jar, "/api/trpc/conversations.addAudioPromptAndInitResponse?batch=1", {
        0: {
            conversationId,
            modelId: PLAYGROUND_MODEL,
            audioBase64,
            audioMimeType: type || "audio/mpeg",
            audioFileName: name,
            lastMessageId: null
        }
    }, { signal: combined });

    if (!addResponse.ok) {
        const detail = await addResponse.text().catch(() => "");
        if (addResponse.status === 451 || detail.includes("biometric-consent-required")) {
            throw new Error("Playground 要求先在网页上同意生物特征（音频）授权，请打开 playground.microsoft.ai 接受后重试");
        }
        if (addResponse.status === 401 || addResponse.status === 403) {
            throw new Error("Playground cookie 已失效，请重新复制");
        }
        throw new Error(`Playground 上传音频失败（${addResponse.status}）：${detail.slice(0, 200)}`);
    }

    let modelMessageId = "";
    try {
        const addBody = await addResponse.json();
        const hit = deepFind(addBody, node => node && node.userMessage && node.modelMessage);
        modelMessageId = hit?.modelMessage?.id || "";
    } catch {
        modelMessageId = "";
    }
    if (!modelMessageId) {
        throw new Error("Playground 没有返回待处理的模型消息 id");
    }

    const streamUrl = `${PLAYGROUND_BASE}/api/chat/stream`;
    const streamResponse = await fetch(streamUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            Cookie: cookieHeaderFor(jar, streamUrl),
            "x-request-id": crypto.randomUUID()
        },
        body: JSON.stringify({
            conversationId,
            modelId: PLAYGROUND_MODEL,
            pendingModelMessageId: modelMessageId,
            isFirstMessage: true,
            transcribeOptions: { diarize }
        }),
        signal: combined
    });

    if (streamResponse.status === 401 || streamResponse.status === 403) {
        throw new Error("Playground cookie 已失效，请重新复制");
    }
    if (!streamResponse.ok) {
        throw new Error(`Playground 转录失败（${streamResponse.status}）`);
    }

    const sseText = await streamResponse.text();
    const rich = extractRichTranscription(sseText);
    if (!rich) {
        throw new Error("Playground 没有返回转录结果（会话可能被中断）");
    }

    // Best effort: leave no conversation behind on the account.
    postJson(jar, "/api/trpc/conversations.delete?batch=1", { 0: { id: conversationId } })
        .catch(() => {});

    const result = normalizeRichTranscription(rich);
    if (!result.text) {
        throw new Error("Playground 返回了空转录");
    }
    return result;
}

function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
    }
    return btoa(binary);
}
