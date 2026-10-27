/**
 * Google Gemini Transcribe.
 *
 * The Gemini API does not accept a public audio URL: the file is uploaded to
 * the Files API first, then the returned `file.uri` is passed to
 * `gemini-3.5-transcribe`. The Worker holds the API key as a secret and does
 * the upload server-side.
 */

export const GOOGLE_TRANSCRIBE_MODEL = "gemini-3.5-transcribe";
const FILES_ENDPOINT = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

function timeoutSignal(ms, signal) {
    const timeout = AbortSignal.timeout(ms);
    return signal ? AbortSignal.any([timeout, signal]) : timeout;
}

function parseOffset(value) {
    const number = parseFloat(String(value ?? "").replace(/s$/, ""));
    return Number.isFinite(number) ? number : null;
}

/** Upload one blob with the Files API resumable protocol and return its URI. */
async function uploadFile({ apiKey, data, filename, mimeType, signal }) {
    const size = data.size;
    const start = await fetch(FILES_ENDPOINT, {
        method: "POST",
        headers: {
            "x-goog-api-key": apiKey,
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": String(size),
            "X-Goog-Upload-Header-Content-Type": mimeType,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ file: { display_name: filename || "audio" } }),
        signal
    });

    if (!start.ok) {
        const detail = await start.text().catch(() => "");
        throw new Error(`Google Files API rejected the upload (${start.status}): ${detail.slice(0, 300)}`);
    }

    const uploadUrl = start.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
        throw new Error("Google Files API did not return an upload URL.");
    }

    const uploaded = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            "X-Goog-Upload-Offset": "0",
            "X-Goog-Upload-Command": "upload, finalize"
        },
        body: data,
        signal
    });

    if (!uploaded.ok) {
        const detail = await uploaded.text().catch(() => "");
        throw new Error(`Google Files API could not store the audio (${uploaded.status}): ${detail.slice(0, 300)}`);
    }

    const info = await uploaded.json();
    const file = info?.file;
    if (!file?.uri) {
        throw new Error("Google Files API did not return a file URI.");
    }
    return file;
}

function joinWordTexts(words) {
    let text = "";
    for (const word of words) {
        const part = String(word.text ?? "").trim();
        if (!part) continue;
        const needsSpace =
            text.length > 0 && !/^[.,!?;:%)}\]]/.test(part) && !/[([{]\s*$/.test(text);
        text += needsSpace ? ` ${part}` : part;
    }
    return text;
}

function readWords(result) {
    const words = [];
    const steps = Array.isArray(result?.steps)
        ? result.steps
        : Array.isArray(result?.outputs)
          ? result.outputs
          : [];
    for (const step of steps) {
        const contents = Array.isArray(step?.content) ? step.content : [step?.content];
        for (const content of contents) {
            const annotations = Array.isArray(content?.annotations) ? content.annotations : [];
            for (const annotation of annotations) {
                if (annotation?.type !== "word_info") continue;
                const text = String(annotation.text ?? "");
                if (!text) continue;
                words.push({
                    text,
                    start: parseOffset(annotation.start_offset),
                    end: parseOffset(annotation.end_offset),
                    // Gemini calls the annotation `word_info`, but the rest of
                    // the proxy and the extension expect Scribe's `type: word`.
                    // A speaker label must not overwrite that type: the
                    // extension drops every word whose type is not `word`.
                    type: "word",
                    ...(annotation.speaker ? { speaker: annotation.speaker } : {})
                });
            }
        }
    }
    return words;
}

/**
 * Transcribe one audio file with Gemini 3.5 Transcribe.
 *
 * Returns seconds-based word timings, matching the shape the other routes use.
 */
export async function transcribeWithGoogle({
    apiKey,
    data,
    filename,
    mimeType = "audio/mpeg",
    model = GOOGLE_TRANSCRIBE_MODEL,
    timeoutMs = 1800000,
    signal
}) {
    if (!apiKey) {
        throw new Error("Google transcription is not configured: set GEMINI_API_KEY on the Worker.");
    }

    const combined = timeoutSignal(timeoutMs, signal);
    const file = await uploadFile({ apiKey, data, filename, mimeType, signal: combined });

    const response = await fetch(INTERACTIONS_ENDPOINT, {
        method: "POST",
        headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            input: [{ type: "audio", uri: file.uri, mime_type: file.mimeType || mimeType }],
            generation_config: {
                transcription_config: {
                    mode: { type: "verbatim", timestamp_granularities: ["word"] }
                }
            }
        }),
        signal: combined
    });

    const raw = await response.text().catch(() => "");
    if (!response.ok) {
        throw new Error(`Google Transcribe rejected the request (${response.status}): ${raw.slice(0, 300)}`);
    }

    let result;
    try {
        result = JSON.parse(raw);
    } catch {
        throw new Error("Google Transcribe did not answer with JSON.");
    }

    const words = readWords(result);
    const text = String(result?.output_text ?? "").trim() || joinWordTexts(words);
    if (!text) {
        throw new Error("Google Transcribe returned no usable text.");
    }
    return { text, words };
}
