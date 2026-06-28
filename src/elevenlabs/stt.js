export const ELEVENLABS_STT_API_URL = "https://api.elevenlabs.io/v1/speech-to-text";
export const DEFAULT_STT_MODEL_ID = "scribe_v2";

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
];

const ACCEPT_LANGUAGES = [
    "zh-CN,zh;q=0.9,en;q=0.8",
    "en-US,en;q=0.9,es;q=0.8",
    "en-GB,en;q=0.9",
    "ja-JP,ja;q=0.9,en;q=0.8",
    "ko-KR,ko;q=0.9,en;q=0.8",
    "de-DE,de;q=0.9,en;q=0.8",
    "fr-FR,fr;q=0.9,en;q=0.8",
    "en-US,en;q=0.5"
];

const BASE_HEADERS = {
    accept: "*/*",
    "accept-encoding": "gzip, deflate, br, zstd",
    origin: "https://elevenlabs.io",
    referer: "https://elevenlabs.io/",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site"
};

const AUDIO_EXT_TO_MIME = {
    mp3: "audio/mp3",
    m4a: "audio/mp4",
    wav: "audio/wav",
    flac: "audio/flac",
    ogg: "audio/ogg",
    aac: "audio/aac",
    mp4: "video/mp4",
    mov: "video/quicktime"
};

function isPrivateOrReservedIPv4(a, b) {
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && (b === 0 || b === 168)) return true;
    if (a >= 224) return true;
    return false;
}

function randomIPv4() {
    const bytes = new Uint8Array(4);
    let a;
    let b;
    do {
        crypto.getRandomValues(bytes);
        a = bytes[0];
        b = bytes[1];
    } while (isPrivateOrReservedIPv4(a, b));
    return `${a}.${b}.${bytes[2]}.${bytes[3]}`;
}

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

export function buildHeaders() {
    const fakeIp = randomIPv4();
    return {
        ...BASE_HEADERS,
        "user-agent": pickRandom(USER_AGENTS),
        "accept-language": pickRandom(ACCEPT_LANGUAGES),
        Forwarded: `for=${fakeIp}`,
        "X-Forwarded-For": fakeIp,
        "X-Real-IP": fakeIp,
        "CF-Connecting-IP": fakeIp,
        "True-Client-IP": fakeIp
    };
}

function inferMimeType(filename, existingType) {
    if (existingType) return existingType;
    const ext = (filename?.split(".").pop() || "").toLowerCase();
    return AUDIO_EXT_TO_MIME[ext] || "application/octet-stream";
}

function combineSignals(timeoutMs, externalSignal) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    return externalSignal ? AbortSignal.any([timeoutSignal, externalSignal]) : timeoutSignal;
}

export async function transcribe({
    data,
    filename,
    languageCode = "auto",
    tagAudioEvents = true,
    timeoutMs = 1800000,
    signal
}) {
    const formData = new FormData();
    formData.append("model_id", DEFAULT_STT_MODEL_ID);
    formData.append("diarize", "true");
    formData.append("tag_audio_events", String(tagAudioEvents).toLowerCase());

    const existingType = data && typeof data === "object" && "type" in data ? data.type : undefined;
    const mimeType = inferMimeType(filename, existingType);
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    formData.append("file", blob, filename || "audio");

    if (languageCode && languageCode.toLowerCase() !== "auto") {
        formData.append("language_code", languageCode);
    }

    const url = new URL(ELEVENLABS_STT_API_URL);
    url.searchParams.set("allow_unauthenticated", "1");

    const response = await fetch(url, {
        method: "POST",
        headers: buildHeaders(),
        body: formData,
        signal: combineSignals(timeoutMs, signal)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`ElevenLabs STT 请求失败: ${response.status} ${errorText.slice(0, 200)}`);
    }

    return response.json();
}
