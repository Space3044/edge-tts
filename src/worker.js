import { HTML_PAGE } from "./frontend/page.js";
import { getFaviconBytes } from "./frontend/favicon.js";
import { handleSpeech } from "./routes/speech.js";
import { handleTextPolish } from "./routes/polish.js";
import { handleAudioTranscription } from "./routes/transcriptions.js";
import { handleProviders } from "./routes/providers.js";
import { handleTrancy } from "./routes/trancy.js";
import { refreshAllTrancyAccounts } from "./trancy/store.js";
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

    // Every path that serves the single-page shell; `/trancy` exists so the
    // gateway tab is linkable and the client picks the tab from the path.
    if (path === "/" || path === "/index.html" || path === "/tts" || path === "/transcription" || path === "/trancy") {
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

    if (path === "/api/providers" || path.startsWith("/api/providers/")) {
        return handleProviders(request, env);
    }

    if (path === "/api/trancy" || path.startsWith("/api/trancy/")) {
        return handleTrancy(request, env);
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
    },

    /**
     * Daily Trancy renewal (`crons` in wrangler.toml).
     *
     * The token has no `exp`; it is kept alive by `/1/user/profile`, which
     * answers with a re-issued token. One probe a day is enough to never let an
     * account idle out, and it also refreshes premium/banned flags. Failure of
     * one account never fails the run - each row records its own status.
     */
    async scheduled(event, env, ctx) {
        const task = refreshAllTrancyAccounts(env, { minAgeMinutes: 0 })
            .then(result => {
                console.log(`trancy cron: checked=${result.checked} ok=${result.ok} dead=${result.dead} failed=${result.failed} skipped=${result.skipped}`);
                return result;
            })
            .catch(error => {
                console.error("trancy cron failed:", error);
            });

        if (ctx && typeof ctx.waitUntil === "function") {
            ctx.waitUntil(task);
            return undefined;
        }
        return task;
    }
};
