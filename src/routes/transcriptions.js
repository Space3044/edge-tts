import { errorResponse, jsonResponse } from "../utils/response.js";
import { transcribe as transcribeWithElevenLabs } from "../elevenlabs/stt.js";
import { transcribeWithGoogle } from "../google/stt.js";
import { getMicrosoftAccount, saveMicrosoftTokens, resolveProvider } from "../secrets/store.js";
import { accessTokenAudienceProblem, canRefreshMicrosoftToken, refreshAccessToken } from "../microsoft/oauth.js";
import { transcribeWithPlayground } from "../microsoft/playground.js";
import { buildMicrosoftEndpoint, transcribeWithMicrosoft } from "../microsoft/stt.js";

const MAX_AUDIO_FILE_SIZE = 50 * 1024 * 1024;
const MAX_SOURCE_REDIRECTS = 5;
const SOURCE_TIMEOUT_MS = 120000;
const SOURCE_URL_FIELDS = ["source_url", "url"];
const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|m4a|flac|aac|ogg|webm|amr|3gp)$/i;
const ALLOWED_AUDIO_TYPES = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/m4a",
    "audio/flac",
    "audio/aac",
    "audio/ogg",
    "audio/webm",
    "audio/amr",
    "audio/3gpp"
];

function isAudioFile(file) {
    const fileType = file.type || "";
    const fileName = file.name || "";
    return ALLOWED_AUDIO_TYPES.some(type => fileType.includes(type)) || AUDIO_EXTENSION_PATTERN.test(fileName);
}

function isPrivateIpv4(hostname) {
    const match = String(hostname || "").match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) {
        return false;
    }
    const octets = match.slice(1).map(Number);
    if (octets.some(value => value > 255)) {
        return true;
    }
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && (b === 0 || b === 168)) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
}

function isPrivateIpv6(host) {
    if (host === "::" || host === "::1") return true;
    if (host.startsWith("fc") || host.startsWith("fd")) return true;
    if (host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb")) {
        return true;
    }
    const mapped = host.match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/i);
    if (!mapped) return false;
    if (mapped[1]) return isPrivateIpv4(mapped[1]);
    const high = parseInt(mapped[2], 16);
    const low = parseInt(mapped[3], 16);
    return isPrivateIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
}

function isPrivateHostname(hostname) {
    const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
    if (!host) return true;
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
        return true;
    }
    if (host.includes(":")) return isPrivateIpv6(host);
    return isPrivateIpv4(host);
}

function normalizeSourceUrl(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return { url: "", error: null };

    let url;
    try {
        url = new URL(raw);
    } catch {
        return { url: "", error: "音频 URL 格式无效" };
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        return { url: "", error: "音频 URL 必须以 http:// 或 https:// 开头" };
    }
    if (url.username || url.password) {
        return { url: "", error: "音频 URL 不能包含用户名或密码" };
    }
    if (isPrivateHostname(url.hostname)) {
        return { url: "", error: "音频 URL 不能指向本机或内网地址" };
    }
    return { url: url.toString(), error: null };
}

function readSourceUrl(formData) {
    for (const field of SOURCE_URL_FIELDS) {
        const value = formData.get(field);
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
}

function missingAudioResponse() {
    return errorResponse("未找到音频文件或 URL", {
        status: 400,
        type: "invalid_request_error",
        param: "file",
        code: "missing_audio"
    });
}

function sourceUrlError(message) {
    return errorResponse(message, {
        status: 400,
        type: "invalid_request_error",
        param: "source_url",
        code: "invalid_source_url"
    });
}

function sourceFilename(url, contentType) {
    try {
        const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "").trim();
        if (name && AUDIO_EXTENSION_PATTERN.test(name)) {
            return name;
        }
    } catch {
        // Fall back to the content type below.
    }
    const type = String(contentType || "").toLowerCase();
    if (type.includes("wav")) return "audio.wav";
    if (type.includes("mp4") || type.includes("m4a")) return "audio.m4a";
    if (type.includes("ogg")) return "audio.ogg";
    if (type.includes("flac")) return "audio.flac";
    if (type.includes("aac")) return "audio.aac";
    if (type.includes("webm")) return "audio.webm";
    return "audio.mp3";
}

async function fetchSourceAudio(sourceUrl, maxBytes) {
    let current = sourceUrl;
    for (let redirect = 0; redirect <= MAX_SOURCE_REDIRECTS; redirect += 1) {
        const response = await fetch(current, {
            redirect: "manual",
            signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS)
        });
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location) {
                throw new Error("音频 URL 重定向缺少目标地址");
            }
            const next = new URL(location, current).toString();
            const checked = normalizeSourceUrl(next);
            if (checked.error) {
                throw new Error(checked.error);
            }
            current = checked.url;
            continue;
        }
        if (!response.ok) {
            throw new Error(`音频下载失败（${response.status}）`);
        }
        const declared = Number(response.headers.get("content-length") || 0);
        if (declared > maxBytes) {
            throw new Error("音频文件大小不能超过50MB");
        }
        const blob = await response.blob();
        if (blob.size > maxBytes) {
            throw new Error("音频文件大小不能超过50MB");
        }
        if (blob.size === 0) {
            throw new Error("音频 URL 返回了空文件");
        }
        return {
            blob,
            url: current,
            contentType: response.headers.get("content-type") || blob.type || ""
        };
    }
    throw new Error("音频 URL 重定向次数过多");
}

/**
 * OpenAI-compatible transcription endpoint.
 *
 * A base such as `https://api.openai.com/v1` or `https://asr.example.com/v1`
 * gets `/audio/transcriptions` appended; a fully qualified endpoint is kept as
 * is so self-hosted whisper services that already include the path work too.
 */
function buildTranscriptionUrl(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) {
        throw new Error("请输入 OpenAI 兼容的转录地址");
    }

    let url;
    try {
        url = new URL(raw);
    } catch {
        throw new Error("OpenAI 转录地址格式无效");
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("OpenAI 转录地址必须以 http:// 或 https:// 开头");
    }

    url.search = "";
    url.hash = "";

    const trimmedPath = url.pathname.replace(/\/+$/, "");
    url.pathname = /\/(audio\/transcriptions|asr)$/.test(trimmedPath)
        ? trimmedPath
        : `${trimmedPath}/audio/transcriptions`;

    return url;
}

function parseWhisperResult(rawResult) {
    if (typeof rawResult !== "string") {
        return rawResult;
    }

    const text = rawResult.trim();
    if (!text) {
        return "";
    }

    if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    return text;
}

function isUsableSegment(segment) {
    const text = String(segment?.text || segment?.transcript || "").trim();
    if (!text) {
        return false;
    }

    const compressionRatio = Number(segment?.compression_ratio || 0);
    if (compressionRatio >= 2.4) {
        return false;
    }

    const duration = Number(segment?.end) - Number(segment?.start);
    if (duration > 0 && duration < 0.5 && text.length > 20) {
        return false;
    }

    return true;
}

function extractText(rawResult) {
    const result = parseWhisperResult(rawResult);
    if (typeof result === "string") {
        return result.trim();
    }

    if (Array.isArray(result?.segments)) {
        const segmentText = result.segments
            .filter(isUsableSegment)
            .map(segment => segment.text || segment.transcript || "")
            .map(text => text.trim())
            .filter(Boolean)
            .join("\n");
        if (segmentText) {
            return segmentText;
        }
    }

    if (typeof result?.text === "string") {
        return result.text.trim();
    }

    if (typeof result?.transcript === "string") {
        return result.transcript.trim();
    }

    return "";
}

function extractElevenLabsText(result) {
    if (typeof result === "string") {
        return result.trim();
    }
    if (typeof result?.text === "string") {
        const text = result.text.trim();
        if (text) {
            return text;
        }
    }
    if (Array.isArray(result?.words)) {
        return result.words
            .map(item => String(item?.text || item?.word || ""))
            .join("")
            .trim();
    }
    return "";
}

const ELEVENLABS_SENTENCE_END_PATTERN = /[.!?。！？…]+["')\]}”’]*$/u;

function normalizeTimestamp(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function calculateDuration(start, end) {
    if (start === null || end === null || end < start) {
        return null;
    }
    return Math.round((end - start) * 1000) / 1000;
}

function normalizeElevenLabsWords(result) {
    if (!Array.isArray(result?.words)) {
        return [];
    }

    return result.words
        .map(item => {
            const start = normalizeTimestamp(item?.start);
            const end = normalizeTimestamp(item?.end);
            return {
                text: String(item?.text ?? item?.word ?? ""),
                start,
                end,
                duration: calculateDuration(start, end),
                type: String(item?.type || "word")
            };
        })
        .filter(item => item.text);
}

/**
 * Sentences for Gemini words.
 *
 * Gemini returns word annotations without the spacing entries ElevenLabs
 * includes, so concatenating them directly would produce "Helloworld". Keep the
 * word list untouched for the extension (it joins words itself) and add spaces
 * only for the sentence view.
 */
function buildGoogleSentences(words) {
    const spaced = [];
    for (const word of words) {
        const previous = spaced[spaced.length - 1];
        let text = word.text;
        if (
            previous &&
            text &&
            !text.startsWith(" ") &&
            !/^[.,!?;:%)}\]]/.test(text) &&
            !/[([{]\s*$/.test(previous.text)
        ) {
            text = ` ${text}`;
        }
        spaced.push({ ...word, text });
    }
    return buildElevenLabsSentences(spaced);
}

function buildElevenLabsSentences(words) {
    const sentences = [];
    let text = "";
    let start = null;
    let end = null;

    const pushSentence = () => {
        const normalizedText = text.trim();
        if (normalizedText) {
            sentences.push({ text: normalizedText, start, end, duration: calculateDuration(start, end) });
        }
        text = "";
        start = null;
        end = null;
    };

    for (const word of words) {
        text += word.text;
        if (word.start !== null && start === null) {
            start = word.start;
        }
        if (word.end !== null) {
            end = word.end;
        }
        if (ELEVENLABS_SENTENCE_END_PATTERN.test(text.trim())) {
            pushSentence();
        }
    }

    pushSentence();
    return sentences;
}

function openAiError(status) {
    if (status === 401 || status === 403) {
        return "OpenAI 转录服务拒绝了密钥，请检查 Provider 设置里的 API Key";
    }
    if (status === 404) {
        return "OpenAI 转录端点不存在，请确认 Endpoint 是否包含 /v1";
    }
    if (status === 413) {
        return "音频文件太大，请选择较小的文件";
    }
    if (status === 422) {
        return "转录服务无法处理该音频，请检查文件格式";
    }
    if (status === 503) {
        return "转录服务暂时不可用";
    }
    return "语音转录服务暂时不可用";
}

function validateAudioFile(file) {
    if (!file) {
        return errorResponse("未找到音频文件", {
            status: 400,
            type: "invalid_request_error",
            param: "file",
            code: "missing_file"
        });
    }
    if (file.size > MAX_AUDIO_FILE_SIZE) {
        return errorResponse("音频文件大小不能超过50MB", {
            status: 400,
            type: "invalid_request_error",
            param: "file",
            code: "file_too_large"
        });
    }
    if (!isAudioFile(file)) {
        return errorResponse("不支持的音频文件格式，请上传mp3、wav、m4a、flac、aac、ogg、webm、amr或3gp格式的文件", {
            status: 400,
            type: "invalid_request_error",
            param: "file",
            code: "invalid_file_type"
        });
    }
    return null;
}

async function handleOpenAiTranscription(formData, env) {
    let config;
    try {
        config = await resolveProvider(env, "openai");
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "读取 OpenAI 配置失败", {
            status: 500,
            type: "api_error",
            code: "openai_config_error"
        });
    }

    if (config.keyError) {
        return errorResponse(config.keyError, {
            status: 500,
            type: "api_error",
            code: "openai_key_unreadable"
        });
    }

    // Per-request overrides stay supported for API callers; provider settings
    // from D1 are the default source of truth.
    const endpointOverride = String(formData.get("endpoint") || "").trim();
    const modelOverride = String(formData.get("model") || "").trim();
    const apiKeyOverride = String(formData.get("apiKey") || "").trim();

    let transcriptionUrl;
    try {
        transcriptionUrl = buildTranscriptionUrl(endpointOverride || config.endpoint);
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "OpenAI 转录地址无效", {
            status: 400,
            type: "invalid_request_error",
            param: "endpoint",
            code: "invalid_endpoint"
        });
    }

    const model = modelOverride || config.model;
    const apiKey = apiKeyOverride || config.apiKey;

    const audioFile = formData.get("file");
    const sourceUrl = readSourceUrl(formData);

    let audioBlob = audioFile;
    let audioName = audioFile && audioFile.name ? audioFile.name : "audio";
    let audioType = audioFile && audioFile.type ? audioFile.type : "";
    if (!audioBlob && sourceUrl) {
        const checked = normalizeSourceUrl(sourceUrl);
        if (checked.error) return sourceUrlError(checked.error);
        try {
            const remote = await fetchSourceAudio(checked.url, MAX_AUDIO_FILE_SIZE);
            audioBlob = remote.blob;
            audioName = sourceFilename(remote.url, remote.contentType);
            audioType = remote.contentType || remote.blob.type || "application/octet-stream";
        } catch (error) {
            const message = error instanceof Error ? error.message : "音频下载失败";
            const tooLarge = message.includes("50MB");
            return errorResponse(message, {
                status: tooLarge ? 400 : 502,
                type: tooLarge ? "invalid_request_error" : "api_error",
                param: tooLarge ? "source_url" : null,
                code: tooLarge ? "source_too_large" : "source_download_failed"
            });
        }
    }
    if (!audioBlob) return missingAudioResponse();

    const invalid = validateAudioFile({ size: audioBlob.size, type: audioType, name: audioName });
    if (invalid) return invalid;

    const apiFormData = new FormData();
    apiFormData.append("file", audioBlob, audioName);
    apiFormData.append("model", model);
    apiFormData.append("response_format", "json");

    const headers = {};
    if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
    }

    const apiResponse = await fetch(transcriptionUrl, {
        method: "POST",
        headers,
        body: apiFormData
    });

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error("OpenAI transcription error:", apiResponse.status, errorText.slice(0, 500));
        return errorResponse(openAiError(apiResponse.status), {
            status: apiResponse.status,
            type: "api_error",
            code: "transcription_api_error"
        });
    }

    const result = await apiResponse.text();
    const text = extractText(result);

    if (!text) {
        return errorResponse("OpenAI 转录未返回可用转录文本", {
            status: 502,
            type: "api_error",
            code: "empty_transcription_result"
        });
    }

    return jsonResponse({ text });
}

async function handleGoogleTranscription(formData, env) {
    let config;
    try {
        config = await resolveProvider(env, "google");
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "读取 Google 配置失败", {
            status: 500,
            type: "api_error",
            code: "google_config_error"
        });
    }

    if (!config.apiKey) {
        return errorResponse(config.keyError || "Google 转录未配置：请在 Provider 设置里保存 API Key，或配置 GEMINI_API_KEY 环境变量", {
            status: 500,
            type: "api_error",
            code: "google_not_configured"
        });
    }

    const apiKey = config.apiKey;
    const model = String(formData.get("model") || "").trim() || config.model;
    // Same override contract as the OpenAI engine: the D1 value is the default,
    // a per-request `endpoint` wins for that call only.
    const endpoint = String(formData.get("endpoint") || "").trim() || config.endpoint;

    const audioFile = formData.get("file");
    const sourceUrl = readSourceUrl(formData);
    let data = audioFile;
    let filename = audioFile && audioFile.name ? audioFile.name : "audio";
    let mimeType = audioFile && audioFile.type ? audioFile.type : "audio/mpeg";

    if (!data && sourceUrl) {
        const checked = normalizeSourceUrl(sourceUrl);
        if (checked.error) return sourceUrlError(checked.error);
        try {
            const remote = await fetchSourceAudio(checked.url, MAX_AUDIO_FILE_SIZE);
            data = remote.blob;
            filename = sourceFilename(remote.url, remote.contentType);
            mimeType = remote.contentType || remote.blob.type || "audio/mpeg";
        } catch (error) {
            const message = error instanceof Error ? error.message : "音频下载失败";
            const tooLarge = message.includes("50MB");
            return errorResponse(message, {
                status: tooLarge ? 400 : 502,
                type: tooLarge ? "invalid_request_error" : "api_error",
                param: tooLarge ? "source_url" : null,
                code: tooLarge ? "source_too_large" : "source_download_failed"
            });
        }
    }
    if (!data) return missingAudioResponse();

    if (audioFile) {
        const invalid = validateAudioFile(audioFile);
        if (invalid) return invalid;
    }

    try {
        const result = await transcribeWithGoogle({ apiKey, data, filename, mimeType, model, endpoint });
        const words = normalizeElevenLabsWords(result);
        const text = extractElevenLabsText(result) || words.map(word => word.text).join("").trim();
        if (!text) {
            return errorResponse("Google Transcribe 未返回可用转录文本", {
                status: 502,
                type: "api_error",
                code: "empty_transcription_result"
            });
        }
        return jsonResponse({
            text,
            sentences: buildGoogleSentences(words),
            words
        });
    } catch (error) {
        console.error("Google STT error:", error);
        return errorResponse(error.message || "Google 转录失败", {
            status: 502,
            type: "api_error",
            code: "transcription_api_error"
        });
    }
}

function elevenLabsResultResponse(result) {
    const words = normalizeElevenLabsWords(result);
    const text = extractElevenLabsText(result) || words.map(word => word.text).join("").trim();
    if (!text) {
        return errorResponse("ElevenLabs 未返回可用转录文本", {
            status: 502,
            type: "api_error",
            code: "empty_transcription_result"
        });
    }
    return jsonResponse({
        text,
        sentences: buildElevenLabsSentences(words),
        words
    });
}

async function handleElevenLabsTranscription(formData, env) {
    const audioFile = formData.get("file");
    const sourceUrl = readSourceUrl(formData);
    const languageCode = String(formData.get("language") || "auto").trim().toLowerCase() || "auto";
    const tagAudioEvents = formData.get("tagAudioEvents") === "true";

    let config;
    try {
        config = await resolveProvider(env, "elevenlabs");
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "读取 ElevenLabs 配置失败", {
            status: 500,
            type: "api_error",
            code: "elevenlabs_config_error"
        });
    }

    if (config.keyError) {
        return errorResponse(config.keyError, {
            status: 500,
            type: "api_error",
            code: "elevenlabs_key_unreadable"
        });
    }

    // No key configured keeps the historical anonymous Scribe request.
    const apiKey = config.apiKey;
    const modelId = String(formData.get("model") || "").trim() || config.model;

    if (!audioFile && !sourceUrl) return missingAudioResponse();

    try {
        if (!audioFile) {
            const checked = normalizeSourceUrl(sourceUrl);
            if (checked.error) return sourceUrlError(checked.error);
            const result = await transcribeWithElevenLabs({
                sourceUrl: checked.url,
                languageCode,
                tagAudioEvents,
                apiKey,
                modelId
            });
            return elevenLabsResultResponse(result);
        }

        const invalid = validateAudioFile(audioFile);
        if (invalid) return invalid;

        const result = await transcribeWithElevenLabs({
            data: audioFile,
            filename: audioFile.name || "audio",
            languageCode,
            tagAudioEvents,
            apiKey,
            modelId
        });
        return elevenLabsResultResponse(result);
    } catch (error) {
        console.error("ElevenLabs STT error:", error);
        return errorResponse(error.message || "ElevenLabs 转录失败", {
            status: 502,
            type: "api_error",
            code: "transcription_api_error"
        });
    }
}

async function transcribeWithPlaygroundEngine(formData, { account, cookies, env }) {
    const audioFile = formData.get("file");
    const sourceUrl = readSourceUrl(formData);
    let data = audioFile;
    let filename = audioFile && audioFile.name ? audioFile.name : "audio";
    let mimeType = audioFile && audioFile.type ? audioFile.type : "audio/mpeg";

    if (!data && sourceUrl) {
        const checked = normalizeSourceUrl(sourceUrl);
        if (checked.error) return sourceUrlError(checked.error);
        try {
            const remote = await fetchSourceAudio(checked.url, MAX_AUDIO_FILE_SIZE);
            data = remote.blob;
            filename = sourceFilename(remote.url, remote.contentType);
            mimeType = remote.contentType || remote.blob.type || "audio/mpeg";
        } catch (error) {
            const message = error instanceof Error ? error.message : "音频下载失败";
            const tooLarge = message.includes("50MB");
            return errorResponse(message, {
                status: tooLarge ? 400 : 502,
                type: tooLarge ? "invalid_request_error" : "api_error",
                param: tooLarge ? "source_url" : null,
                code: tooLarge ? "source_too_large" : "source_download_failed"
            });
        }
    }
    if (!data) return missingAudioResponse();

    if (audioFile) {
        const invalid = validateAudioFile(audioFile);
        if (invalid) return invalid;
    }

    try {
        const result = await transcribeWithPlayground({ cookies, data, filename, mimeType });
        return jsonResponse(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Playground 转录失败";
        if (message.includes("cookie 已失效")) {
            return errorResponse("Playground cookie 已失效，请在服务配置里粘贴新的 cookie", {
                status: 401,
                type: "authentication_error",
                code: "microsoft_cookie_expired"
            });
        }
        console.error("Microsoft playground STT error:", error);
        return errorResponse(message, {
            status: 502,
            type: "api_error",
            code: "transcription_api_error"
        });
    }
}

async function handleMicrosoftTranscription(formData, env) {
    const account = await getMicrosoftAccount(env);

    if (account.tokenError) {
        return errorResponse(account.tokenError, {
            status: 500,
            type: "api_error",
            code: "microsoft_token_unreadable"
        });
    }

    // A pasted playground cookie jar takes precedence: it is the free path and
    // does not need an Azure subscription.
    const playgroundCookies = String(account.playgroundCookies || "").trim();
    if (playgroundCookies) {
        return transcribeWithPlaygroundEngine(formData, { account, cookies: playgroundCookies, env });
    }

    // A subscription key never expires, so it short-circuits the token dance.
    const subscriptionKey = String(account.subscriptionKey || "").trim();

    if (!subscriptionKey && !account.accessToken && !account.refreshToken) {
        return errorResponse("Microsoft 未配置凭据：请保存订阅密钥或 access token", {
            status: 401,
            type: "authentication_error",
            code: "microsoft_token_required"
        });
    }

    let accessToken = account.accessToken;
    let renewed = false;

    if (!subscriptionKey && (!accessToken || account.accessTokenExpired)) {
        if (!account.refreshToken) {
            return errorResponse("Microsoft access token 已过期，请在服务配置里粘贴新的 access token", {
                status: 401,
                type: "authentication_error",
                code: "microsoft_token_expired"
            });
        }
        if (!canRefreshMicrosoftToken(env)) {
            return errorResponse("Microsoft access token 已过期，且未配置 MICROSOFT_CLIENT_ID，无法自动续期，请粘贴新的 access token", {
                status: 401,
                type: "authentication_error",
                code: "microsoft_token_expired"
            });
        }

        try {
            const tokens = await refreshAccessToken({ env, refreshToken: account.refreshToken });
            accessToken = tokens.accessToken;
            renewed = true;
            // Entra ID rotates the refresh token; keep whichever value came back.
            await saveMicrosoftTokens(env, {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken || account.refreshToken
            });
        } catch (error) {
            console.error("Microsoft token refresh failed:", error);
            return errorResponse(
                "微软 refresh token 已失效，请在服务配置里粘贴新的 access token / refresh token",
                { status: 401, type: "authentication_error", code: "microsoft_token_expired" }
            );
        }
    }

    const audienceProblem = subscriptionKey ? null : accessTokenAudienceProblem(accessToken);
    if (audienceProblem) {
        return errorResponse(audienceProblem, {
            status: 400,
            type: "invalid_request_error",
            param: "accessToken",
            code: "microsoft_token_wrong_audience"
        });
    }

    let base;
    try {
        base = buildMicrosoftEndpoint({
            endpoint: String(formData.get("endpoint") || "").trim() || account.endpoint,
            region: String(formData.get("region") || "").trim() || account.region
        });
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "Microsoft endpoint 无效", {
            status: 400,
            type: "invalid_request_error",
            param: "region",
            code: "microsoft_region_required"
        });
    }

    const audioFile = formData.get("file");
    const sourceUrl = readSourceUrl(formData);
    let data = audioFile;
    let filename = audioFile && audioFile.name ? audioFile.name : "audio";
    let mimeType = audioFile && audioFile.type ? audioFile.type : "audio/mpeg";

    if (!data && sourceUrl) {
        const checked = normalizeSourceUrl(sourceUrl);
        if (checked.error) return sourceUrlError(checked.error);
        try {
            const remote = await fetchSourceAudio(checked.url, MAX_AUDIO_FILE_SIZE);
            data = remote.blob;
            filename = sourceFilename(remote.url, remote.contentType);
            mimeType = remote.contentType || remote.blob.type || "audio/mpeg";
        } catch (error) {
            const message = error instanceof Error ? error.message : "音频下载失败";
            const tooLarge = message.includes("50MB");
            return errorResponse(message, {
                status: tooLarge ? 400 : 502,
                type: tooLarge ? "invalid_request_error" : "api_error",
                param: tooLarge ? "source_url" : null,
                code: tooLarge ? "source_too_large" : "source_download_failed"
            });
        }
    }
    if (!data) return missingAudioResponse();

    if (audioFile) {
        const invalid = validateAudioFile(audioFile);
        if (invalid) return invalid;
    }

    const locale = String(formData.get("locale") || "").trim();

    try {
        const result = await transcribeWithMicrosoft({
            accessToken,
            subscriptionKey,
            endpoint: base,
            data,
            filename,
            mimeType,
            locale
        });
        if (renewed) {
            console.log("Microsoft access token renewed from the stored refresh token");
        }
        const words = normalizeElevenLabsWords(result);
        const sentences = Array.isArray(result.sentences) && result.sentences.length
            ? result.sentences
            : buildElevenLabsSentences(words);
        const text = String(result.text || "").trim() || words.map(word => word.text).join(" ").trim();
        if (!text) {
            return errorResponse("Microsoft 转录未返回可用文本", {
                status: 502,
                type: "api_error",
                code: "empty_transcription_result"
            });
        }
        return jsonResponse({ text, sentences, words });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Microsoft 转录失败";
        if (message.includes("access token") || message.includes("重新登录")) {
            return errorResponse(message, {
                status: 401,
                type: "authentication_error",
                code: "microsoft_login_required"
            });
        }
        console.error("Microsoft STT error:", error);
        return errorResponse(message, {
            status: 502,
            type: "api_error",
            code: "transcription_api_error"
        });
    }
}

export async function handleAudioTranscription(request, env) {
    try {
        if (request.method !== "POST") {
            return errorResponse("只支持POST方法", {
                status: 405,
                type: "invalid_request_error",
                param: "method",
                code: "method_not_allowed"
            });
        }

        const contentType = request.headers.get("content-type") || "";
        if (!contentType.includes("multipart/form-data")) {
            return errorResponse("请求必须使用multipart/form-data格式", {
                status: 400,
                type: "invalid_request_error",
                param: "content-type",
                code: "invalid_content_type"
            });
        }

        const formData = await request.formData();
        const requested = String(formData.get("engine") || "openai").toLowerCase();
        // `whisper` stays a supported alias so existing callers keep working
        // after the engine was renamed to `openai`.
        const engine = requested === "whisper" ? "openai" : requested;

        if (engine === "elevenlabs") {
            return handleElevenLabsTranscription(formData, env);
        }
        if (engine === "google") {
            return handleGoogleTranscription(formData, env);
        }
        if (engine === "microsoft") {
            return handleMicrosoftTranscription(formData, env);
        }
        return handleOpenAiTranscription(formData, env);
    } catch (error) {
        console.error("语音转录处理失败:", error);
        return errorResponse(error.message || "语音转录处理失败", {
            status: 500,
            type: "api_error",
            code: "transcription_processing_error"
        });
    }
}
