import { HTML_PAGE } from "./frontend/page.js";
import { getFaviconBytes } from "./frontend/favicon.js";
import { handleSpeech } from "./routes/speech.js";
import { handleTextPolish } from "./routes/polish.js";
import { handleAudioTranscription } from "./routes/transcriptions.js";
import { handleOptions, makeCORSHeaders } from "./utils/cors.js";

async function handleRequest(request, env = {}) {
    if (request.method === "OPTIONS") {
        return handleOptions(request);
    }

    const requestUrl = new URL(request.url);
    const path = requestUrl.pathname;

    if (path === "/favicon.ico") {
        return new Response(getFaviconBytes(), {
            headers: {
                "Content-Type": "image/x-icon",
                "Cache-Control": "public, max-age=31536000, immutable",
                ...makeCORSHeaders()
            }
        });
    }

    if (path === "/" || path === "/index.html" || path === "/tts" || path === "/transcription") {
        return new Response(HTML_PAGE, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                ...makeCORSHeaders()
            }
        });
    }

    if (path === "/v1/audio/transcriptions") {
        return handleAudioTranscription(request, env);
    }

    if (path === "/v1/text/polish") {
        return handleTextPolish(request);
    }

    if (path === "/v1/audio/speech") {
        return handleSpeech(request);
    }

    return new Response("Not Found", { status: 404 });
}

export default {
    async fetch(request, env) {
        return handleRequest(request, env);
    }
};
