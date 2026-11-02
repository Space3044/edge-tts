/**
 * Azure AI Speech — fast transcription.
 *
 * Synchronous REST call that takes the audio as a normal multipart upload and
 * returns word-level timings (plus phrases and optional speaker labels):
 *
 *   POST https://{region}.api.cognitive.microsoft.com
 *        /speechtotext/transcriptions:transcribe?api-version=2024-11-15
 *
 * Authentication is a bearer token minted from the stored Entra ID refresh
 * token, not an `Ocp-Apim-Subscription-Key`.
 */

export const MICROSOFT_API_VERSION = "2024-11-15";

export function buildMicrosoftEndpoint({ endpoint, region }) {
    const override = String(endpoint || "").trim();
    if (override) {
        let url;
        try {
            url = new URL(override);
        } catch {
            throw new Error("Microsoft endpoint 格式无效");
        }
        if (url.protocol !== "https:" && url.protocol !== "http:") {
            throw new Error("Microsoft endpoint 必须以 http:// 或 https:// 开头");
        }
        url.search = "";
        url.hash = "";
        url.pathname = url.pathname.replace(/\/+$/, "");
        return url.toString().replace(/\/$/, "");
    }

    const zone = String(region || "").trim();
    if (!zone) {
        throw new Error("请先在服务配置里填写 Azure 区域（region），例如 eastasia");
    }
    if (!/^[a-z0-9-]+$/i.test(zone)) {
        throw new Error("Azure 区域只能包含字母、数字和连字符");
    }
    return `https://${zone}.api.cognitive.microsoft.com`;
}

export function buildTranscriptionUrl(base) {
    return `${base}/speechtotext/transcriptions:transcribe?api-version=${MICROSOFT_API_VERSION}`;
}

function millisecondsToSeconds(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) / 1000 : null;
}

function duration(start, end) {
    if (start === null || end === null || end < start) {
        return null;
    }
    return Math.round((end - start) * 1000) / 1000;
}

function normalizeWords(phrases) {
    const words = [];
    for (const phrase of phrases) {
        for (const word of Array.isArray(phrase?.words) ? phrase.words : []) {
            const text = String(word?.text ?? "");
            if (!text) continue;
            const start = millisecondsToSeconds(word.offsetMilliseconds);
            const end = millisecondsToSeconds(
                Number(word.offsetMilliseconds) + Number(word.durationMilliseconds)
            );
            words.push({
                text,
                start,
                end,
                duration: duration(start, end),
                type: "word",
                ...(phrase?.speaker !== undefined ? { speaker: phrase.speaker } : {})
            });
        }
    }
    return words;
}

function normalizeSentences(phrases) {
    const sentences = [];
    for (const phrase of phrases) {
        const text = String(phrase?.text ?? "").trim();
        if (!text) continue;
        const start = millisecondsToSeconds(phrase.offsetMilliseconds);
        const end = millisecondsToSeconds(
            Number(phrase.offsetMilliseconds) + Number(phrase.durationMilliseconds)
        );
        sentences.push({
            text,
            start,
            end,
            duration: duration(start, end),
            ...(phrase?.speaker !== undefined ? { speaker: phrase.speaker } : {})
        });
    }
    return sentences;
}

export async function transcribeWithMicrosoft({
    accessToken,
    endpoint,
    data,
    filename,
    mimeType = "audio/mpeg",
    locale = "",
    diarization = true,
    signal
}) {
    if (!accessToken) {
        throw new Error("Microsoft 未登录：请先在服务配置里连接微软账号");
    }

    const definition = {
        profanityFilterMode: "None",
        ...(locale ? { locales: [locale] } : {}),
        ...(diarization ? { diarization: { enabled: true, maxSpeakers: 4 } } : {})
    };

    const body = new FormData();
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    body.append("audio", blob, filename || "audio");
    body.append("definition", JSON.stringify(definition));

    const response = await fetch(buildTranscriptionUrl(endpoint), {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json"
        },
        body,
        signal
    });

    const raw = await response.text().catch(() => "");
    if (!response.ok) {
        const detail = raw.slice(0, 300);
        if (response.status === 401 || response.status === 403) {
            throw new Error(`Microsoft 拒绝了访问令牌，请重新登录微软账号（${response.status}）：${detail}`);
        }
        throw new Error(`Microsoft 转录失败（${response.status}）：${detail}`);
    }

    let result;
    try {
        result = JSON.parse(raw);
    } catch {
        throw new Error("Microsoft 转录返回了非 JSON 响应");
    }

    const phrases = Array.isArray(result?.phrases) ? result.phrases : [];
    const words = normalizeWords(phrases);
    const sentences = normalizeSentences(phrases);
    const text = String(
        Array.isArray(result?.combinedPhrases)
            ? result.combinedPhrases.map(phrase => phrase?.text ?? "").join("\n").trim()
            : ""
    ).trim() || sentences.map(sentence => sentence.text).join("\n").trim()
        || words.map(word => word.text).join(" ").trim();

    if (!text) {
        throw new Error("Microsoft 转录没有返回可用文本");
    }

    return { text, sentences, words };
}
