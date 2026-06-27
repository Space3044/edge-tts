import { getEndpoint } from "./endpoint.js";
import { getSsml } from "./ssml.js";
import { optimizedTextSplit } from "../utils/text.js";

const SHORT_TEXT_LIMIT = 1500;
const CHUNK_TEXT_LIMIT = 2000;
const MAX_CHUNK_COUNT = 40;
const DEFAULT_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const RETRY_DELAY_MS = 500;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
    return status === 429 || status >= 500;
}

function nonRetryableError(message) {
    const error = new Error(message);
    error.retryable = false;
    return error;
}

async function fetchTtsAudio({ body, outputFormat = DEFAULT_OUTPUT_FORMAT, label = "Edge TTS", maxRetries = 3 }) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const endpoint = await getEndpoint();
            const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": endpoint.t,
                    "Content-Type": "application/ssml+xml",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
                    "X-Microsoft-OutputFormat": outputFormat
                },
                body
            });

            if (response.ok) {
                return await response.blob();
            }

            const errorText = await response.text();
            if (isRetryableStatus(response.status) && attempt < maxRetries) {
                await delay(RETRY_DELAY_MS * (attempt + 1));
                continue;
            }

            throw nonRetryableError(`${label} API错误: ${response.status} ${errorText}`);
        } catch (error) {
            if (error.retryable === false) {
                throw error;
            }
            if (attempt === maxRetries) {
                throw new Error(`${label}音频生成失败（已重试${maxRetries}次）: ${error.message}`);
            }
            await delay(RETRY_DELAY_MS * (attempt + 1));
        }
    }

    throw new Error(`${label}音频生成失败`);
}

async function processBatchedAudioChunks(chunks, voiceName, rate, pitch, volume, style, outputFormat, batchSize = 3, delayMs = 1000) {
    const audioChunks = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchPromises = batch.map(async (chunk, index) => {
            if (index > 0) {
                await delay(index * 200);
            }
            return getAudioChunk(chunk, voiceName, rate, pitch, volume, style, outputFormat);
        });

        const batchResults = await Promise.all(batchPromises);
        audioChunks.push(...batchResults);

        if (i + batchSize < chunks.length) {
            await delay(delayMs);
        }
    }

    return audioChunks;
}

export async function getVoice(text, voiceName = "zh-CN-XiaoxiaoNeural", rate = "+0%", pitch = "+0Hz", volume = "+0%", style = "general", outputFormat = DEFAULT_OUTPUT_FORMAT) {
    const cleanText = String(text || "").trim();
    if (!cleanText) {
        throw new Error("文本内容为空");
    }

    if (cleanText.length <= SHORT_TEXT_LIMIT) {
        return getAudioChunk(cleanText, voiceName, rate, pitch, volume, style, outputFormat);
    }

    const chunks = optimizedTextSplit(cleanText, SHORT_TEXT_LIMIT);
    if (chunks.length > MAX_CHUNK_COUNT) {
        throw new Error(`文本过长，分块数量(${chunks.length})超过限制。请缩短文本或分批处理。`);
    }

    console.log(`文本已分为 ${chunks.length} 个块进行处理`);
    const audioChunks = await processBatchedAudioChunks(
        chunks,
        voiceName,
        rate,
        pitch,
        volume,
        style,
        outputFormat,
        3,
        800
    );

    return new Blob(audioChunks, { type: "audio/mpeg" });
}

export async function getAudioFromSsml(ssml, outputFormat = DEFAULT_OUTPUT_FORMAT) {
    const cleanSsml = String(ssml || "").trim();
    if (!cleanSsml) {
        throw new Error("SSML内容为空");
    }
    if (!/<speak[\s>]/i.test(cleanSsml)) {
        throw new Error("SSML必须包含<speak>根元素");
    }
    if (cleanSsml.length > 20000) {
        throw new Error("SSML内容过长，最大支持20000字符");
    }

    return fetchTtsAudio({
        body: cleanSsml,
        outputFormat,
        label: "Edge TTS SSML"
    });
}

async function getAudioChunk(text, voiceName, rate, pitch, volume, style, outputFormat = DEFAULT_OUTPUT_FORMAT) {
    const delayMatch = text.match(/\[(\d+)\]\s*?$/);
    let silence = 0;
    let cleanText = text;

    if (delayMatch && delayMatch.length === 2) {
        silence = parseInt(delayMatch[1]);
        cleanText = text.replace(delayMatch[0], "");
    }

    if (!cleanText.trim()) {
        throw new Error("文本块为空");
    }
    if (cleanText.length > CHUNK_TEXT_LIMIT) {
        throw new Error(`文本块过长: ${cleanText.length} 字符，最大支持2000字符`);
    }

    return fetchTtsAudio({
        body: getSsml(cleanText, voiceName, rate, pitch, volume, style, silence),
        outputFormat,
        label: "Edge TTS"
    });
}
