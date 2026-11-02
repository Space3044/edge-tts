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
 * Authentication is the browser cookie jar of a signed-in Microsoft account;
 * `/.auth/login/aad?prompt=none` can silently renew it from the persisted
 * identity cookies, which is why one paste can keep working for a long time.
 */

export const PLAYGROUND_BASE = "https://playground.microsoft.ai";
export const PLAYGROUND_MODEL = "mai-transcribe-2";
export const PLAYGROUND_MAX_BYTES = 0x1900000; // 25 MiB, measured on the raw file
export const PLAYGROUND_MAX_SECONDS = 3615;
const PLAYGROUND_ALLOWED_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"];
const STREAM_TIMEOUT_MS = 600000;

/** Parse a pasted cookie header ("a=1; b=2") or a JSON cookie array. */
export function parseCookieString(input) {
    const raw = String(input || "").trim();
    if (!raw) {
        return "";
    }

    if (raw.startsWith("[") || raw.startsWith("{")) {
        try {
            const parsed = JSON.parse(raw);
            const list = Array.isArray(parsed) ? parsed : parsed?.cookies;
            if (Array.isArray(list)) {
                return list
                    .filter(item => item && item.name)
                    .map(item => `${item.name}=${item.value ?? ""}`)
                    .join("; ");
            }
        } catch {
            // Fall through to header parsing.
        }
    }

    return raw
        .replace(/^cookie\s*:\s*/i, "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .join("; ");
}

function cookiePairs(cookies) {
    const pairs = new Map();
    for (const part of String(cookies || "").split(";")) {
        const index = part.indexOf("=");
        if (index <= 0) continue;
        const name = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        if (name) pairs.set(name, value);
    }
    return pairs;
}

function mergeSetCookies(cookies, setCookieHeaders) {
    const pairs = cookiePairs(cookies);
    for (const header of setCookieHeaders) {
        // Multiple cookies can arrive in one header, separated by commas that
        // are followed by another name=value pair.
        for (const chunk of String(header).split(/,(?=\s*[^;=,\s]+=)/)) {
            const pair = chunk.split(";")[0];
            const index = pair.indexOf("=");
            if (index <= 0) continue;
            const name = pair.slice(0, index).trim();
            const value = pair.slice(index + 1).trim();
            const expired = /max-age=0|expires=thu, 01 jan 1970/i.test(chunk);
            if (!name) continue;
            if (expired || value === "") {
                pairs.delete(name);
            } else {
                pairs.set(name, value);
            }
        }
    }
    return Array.from(pairs.entries()).map(([name, value]) => `${name}=${value}`).join("; ");
}

async function postJson(cookies, path, body, { requestId, signal } = {}) {
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: cookies
    };
    if (requestId) {
        headers["x-request-id"] = requestId;
    }

    return fetch(`${PLAYGROUND_BASE}${path}`, {
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

/**
 * `/.auth/me` answers 200 only for a live session. When the short-lived
 * session cookie has expired, the persisted Microsoft identity cookies can mint
 * a new one without user interaction.
 */
export async function refreshPlaygroundCookies(cookies) {
    const probe = await fetch(`${PLAYGROUND_BASE}/.auth/me`, {
        headers: { Cookie: cookies, Accept: "application/json" },
        redirect: "manual"
    }).catch(() => null);

    if (probe && probe.status === 200) {
        return { cookies, renewed: false };
    }

    const login = await fetch(
        `${PLAYGROUND_BASE}/.auth/login/aad?prompt=none&post_login_redirect_uri=%2Fchat`,
        { headers: { Cookie: cookies }, redirect: "manual" }
    ).catch(() => null);

    if (!login) {
        return { cookies, renewed: false };
    }

    const setCookies = typeof login.headers.getSetCookie === "function"
        ? login.headers.getSetCookie()
        : [login.headers.get("set-cookie")].filter(Boolean);
    const merged = setCookies.length ? mergeSetCookies(cookies, setCookies) : cookies;

    const after = await fetch(`${PLAYGROUND_BASE}/.auth/me`, {
        headers: { Cookie: merged, Accept: "application/json" },
        redirect: "manual"
    }).catch(() => null);

    if (after && after.status === 200) {
        return { cookies: merged, renewed: true };
    }
    return { cookies, renewed: false };
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
    const jar = parseCookieString(cookies);
    if (!jar) {
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

    const streamResponse = await fetch(`${PLAYGROUND_BASE}/api/chat/stream`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            Cookie: jar,
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
