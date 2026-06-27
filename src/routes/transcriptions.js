import { errorResponse, jsonResponse } from "../utils/response.js";

const MAX_AUDIO_FILE_SIZE = 10 * 1024 * 1024;
const SILICONFLOW_TRANSCRIPTION_URL = "https://api.siliconflow.cn/v1/audio/transcriptions";
const SILICONFLOW_TRANSCRIPTION_MODEL = "FunAudioLLM/SenseVoiceSmall";
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

function resolveToken(customToken, env = {}) {
    const formToken = typeof customToken === "string" ? customToken.trim() : "";
    const envToken = typeof env.SILICONFLOW_API_KEY === "string" ? env.SILICONFLOW_API_KEY.trim() : "";
    return formToken || envToken;
}

function transcriptionApiError(status) {
    if (status === 401) {
        return "API Token无效，请检查您的配置";
    }
    if (status === 429) {
        return "请求过于频繁，请稍后再试";
    }
    if (status === 413) {
        return "音频文件太大，请选择较小的文件";
    }
    return "语音转录服务暂时不可用";
}

export async function handleAudioTranscription(request, env = {}) {
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
        const token = resolveToken(formData.get("token"), env);

        if (!audioFile) {
            return errorResponse("未找到音频文件", {
                status: 400,
                type: "invalid_request_error",
                param: "file",
                code: "missing_file"
            });
        }

        if (audioFile.size > MAX_AUDIO_FILE_SIZE) {
            return errorResponse("音频文件大小不能超过10MB", {
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

        if (!token) {
            return errorResponse("未配置语音转文字 API Token，请在 Cloudflare 环境变量 SILICONFLOW_API_KEY 中配置，或在页面中输入自定义 Token", {
                status: 500,
                type: "api_error",
                param: "token",
                code: "missing_api_token"
            });
        }

        const apiFormData = new FormData();
        apiFormData.append("file", audioFile);
        apiFormData.append("model", SILICONFLOW_TRANSCRIPTION_MODEL);

        const apiResponse = await fetch(SILICONFLOW_TRANSCRIPTION_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            body: apiFormData
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error("硅基流动API错误:", apiResponse.status, errorText);
            return errorResponse(transcriptionApiError(apiResponse.status), {
                status: apiResponse.status,
                type: "api_error",
                code: "transcription_api_error"
            });
        }

        return jsonResponse(await apiResponse.json());
    } catch (error) {
        console.error("语音转录处理失败:", error);
        return errorResponse("语音转录处理失败", {
            status: 500,
            type: "api_error",
            code: "transcription_processing_error"
        });
    }
}
