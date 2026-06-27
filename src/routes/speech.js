import { getAudioFromSsml, getVoice } from "../edge/synthesize.js";
import { audioResponse, errorResponse } from "../utils/response.js";

const DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural";
const DEFAULT_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const MAX_TEXT_FILE_SIZE = 500 * 1024;
const MAX_TEXT_LENGTH = 10000;

function signedPercent(value) {
    return value >= 0 ? `+${value}%` : `${value}%`;
}

function signedPitch(value) {
    return value >= 0 ? `+${value}Hz` : `${value}Hz`;
}

function formatSpeechOptions({ voice = DEFAULT_VOICE, speed = "1.0", volume = "0", pitch = "0", style = "general" } = {}) {
    const rate = parseInt(String((parseFloat(speed) - 1.0) * 100));
    const normalizedVolume = parseInt(String(parseFloat(volume) * 100));
    const normalizedPitch = parseInt(pitch);

    return {
        voice,
        rate: signedPercent(rate),
        pitch: signedPitch(normalizedPitch),
        volume: signedPercent(normalizedVolume),
        style,
        outputFormat: DEFAULT_OUTPUT_FORMAT
    };
}

async function synthesizeText(input, options) {
    const speechOptions = formatSpeechOptions(options);
    const audioBlob = await getVoice(
        input,
        speechOptions.voice,
        speechOptions.rate,
        speechOptions.pitch,
        speechOptions.volume,
        speechOptions.style,
        speechOptions.outputFormat
    );

    return audioResponse(audioBlob, { filename: "speech.mp3" });
}

export async function handleSpeech(request) {
    try {
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
            return await handleFileUpload(request);
        }

        const requestBody = await request.json();
        if (requestBody.inputType === "ssml") {
            const audioBlob = await getAudioFromSsml(requestBody.input, DEFAULT_OUTPUT_FORMAT);
            return audioResponse(audioBlob, { filename: "speech.mp3" });
        }

        return await synthesizeText(requestBody.input, requestBody);
    } catch (error) {
        console.error("语音生成失败:", error);
        return errorResponse(error.message || String(error), {
            status: 500,
            type: "api_error",
            code: "edge_tts_error"
        });
    }
}

async function handleFileUpload(request) {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
        return errorResponse("未找到上传的文件", {
            status: 400,
            type: "invalid_request_error",
            param: "file",
            code: "missing_file"
        });
    }

    if (!file.type.includes("text/") && !file.name.toLowerCase().endsWith(".txt")) {
        return errorResponse("不支持的文件类型，请上传txt文件", {
            status: 400,
            type: "invalid_request_error",
            param: "file",
            code: "invalid_file_type"
        });
    }

    if (file.size > MAX_TEXT_FILE_SIZE) {
        return errorResponse("文件大小超过限制（最大500KB）", {
            status: 400,
            type: "invalid_request_error",
            param: "file",
            code: "file_too_large"
        });
    }

    const text = await file.text();
    if (!text.trim()) {
        return errorResponse("文件内容为空", {
            status: 400,
            type: "invalid_request_error",
            param: "file",
            code: "empty_file"
        });
    }

    if (text.length > MAX_TEXT_LENGTH) {
        return errorResponse("文本内容过长（最大10000字符）", {
            status: 400,
            type: "invalid_request_error",
            param: "file",
            code: "text_too_long"
        });
    }

    return synthesizeText(text, {
        voice: formData.get("voice") || DEFAULT_VOICE,
        speed: formData.get("speed") || "1.0",
        volume: formData.get("volume") || "0",
        pitch: formData.get("pitch") || "0",
        style: formData.get("style") || "general"
    });
}
