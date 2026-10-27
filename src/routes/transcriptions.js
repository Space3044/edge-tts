import { errorResponse, jsonResponse } from "../utils/response.js";
import { transcribe as transcribeWithElevenLabs } from "../elevenlabs/stt.js";

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

function normalizeBaseUrl(value) {
    const endpoint = typeof value === "string" ? value.trim() : "";
    if (!endpoint) {
        throw new Error("请输入 Whisper ASR 服务地址");
    }

    let url;
    try {
        url = new URL(endpoint);
    } catch {
        throw new Error("Whisper ASR 服务地址格式无效");
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("Whisper ASR 服务地址必须以 http:// 或 https:// 开头");
    }

    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
}

function buildAsrUrl(baseUrl) {
    const url = new URL(`${baseUrl}/asr`);
    url.searchParams.set("output", "json");
    url.searchParams.set("task", "transcribe");
    url.searchParams.set("encode", "true");
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

function whisperError(status) {
    if (status === 413) {
        return "音频文件太大，请选择较小的文件";
    }
    if (status === 422) {
        return "Whisper ASR 无法处理该音频，请检查文件格式";
    }
    if (status === 503) {
        return "Whisper ASR 服务暂时不可用";
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

async function handleWhisperTranscription(formData) {
    const audioFile = formData.get("file");
    const sourceUrl = readSourceUrl(formData);
    const whisperBaseUrl = normalizeBaseUrl(formData.get("endpoint"));

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
    apiFormData.append("audio_file", audioBlob, audioName);

    const apiResponse = await fetch(buildAsrUrl(whisperBaseUrl), {
        method: "POST",
        body: apiFormData
    });

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error("Whisper ASR error:", apiResponse.status, errorText);
        return errorResponse(whisperError(apiResponse.status), {
            status: apiResponse.status,
            type: "api_error",
            code: "transcription_api_error"
        });
    }

    const result = await apiResponse.text();
    const text = extractText(result);

    if (!text) {
        return errorResponse("Whisper ASR 未返回可用转录文本", {
            status: 502,
            type: "api_error",
            code: "empty_transcription_result"
        });
    }

    return jsonResponse({ text });
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

async function handleElevenLabsTranscription(formData) {
    const audioFile = formData.get("file");
    const sourceUrl = readSourceUrl(formData);
    const languageCode = String(formData.get("language") || "auto").trim().toLowerCase() || "auto";
    const tagAudioEvents = formData.get("tagAudioEvents") === "true";

    if (!audioFile && !sourceUrl) return missingAudioResponse();

    try {
        if (!audioFile) {
            const checked = normalizeSourceUrl(sourceUrl);
            if (checked.error) return sourceUrlError(checked.error);
            const result = await transcribeWithElevenLabs({
                sourceUrl: checked.url,
                languageCode,
                tagAudioEvents
            });
            return elevenLabsResultResponse(result);
        }

        const invalid = validateAudioFile(audioFile);
        if (invalid) return invalid;

        const result = await transcribeWithElevenLabs({
            data: audioFile,
            filename: audioFile.name || "audio",
            languageCode,
            tagAudioEvents
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
        const engine = String(formData.get("engine") || "whisper").toLowerCase();

        if (engine === "elevenlabs") {
            return handleElevenLabsTranscription(formData);
        }
        return handleWhisperTranscription(formData);
    } catch (error) {
        console.error("语音转录处理失败:", error);
        return errorResponse(error.message || "语音转录处理失败", {
            status: 500,
            type: "api_error",
            code: "transcription_processing_error"
        });
    }
}
