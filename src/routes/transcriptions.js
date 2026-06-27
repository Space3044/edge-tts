import { errorResponse, jsonResponse } from "../utils/response.js";

const MAX_AUDIO_FILE_SIZE = 50 * 1024 * 1024;
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

export async function handleAudioTranscription(request) {
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
        const audioFile = formData.get("file");
        const whisperBaseUrl = normalizeBaseUrl(formData.get("endpoint"));

        if (!audioFile) {
            return errorResponse("未找到音频文件", {
                status: 400,
                type: "invalid_request_error",
                param: "file",
                code: "missing_file"
            });
        }

        if (audioFile.size > MAX_AUDIO_FILE_SIZE) {
            return errorResponse("音频文件大小不能超过50MB", {
                status: 400,
                type: "invalid_request_error",
                param: "file",
                code: "file_too_large"
            });
        }

        if (!isAudioFile(audioFile)) {
            return errorResponse("不支持的音频文件格式，请上传mp3、wav、m4a、flac、aac、ogg、webm、amr或3gp格式的文件", {
                status: 400,
                type: "invalid_request_error",
                param: "file",
                code: "invalid_file_type"
            });
        }

        const apiFormData = new FormData();
        apiFormData.append("audio_file", audioFile, audioFile.name || "audio");

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
    } catch (error) {
        console.error("语音转录处理失败:", error);
        return errorResponse(error.message || "语音转录处理失败", {
            status: 500,
            type: "api_error",
            code: "transcription_processing_error"
        });
    }
}
