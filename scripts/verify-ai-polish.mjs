import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleTextPolish } from "../src/routes/polish.js";

function read(path) {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

const pageSource = read("../src/frontend/page.js");
const clientSource = read("../src/frontend/client.js");
const workerSource = read("../src/worker.js");
const polishSource = read("../src/routes/polish.js");

assert.match(workerSource, /handleTextPolish/);
assert.match(workerSource, /path === "\/v1\/text\/polish"/);
assert.match(pageSource, /id=\\?"polishConfig\\?"/);
assert.match(pageSource, /id=\\?"polishBtn\\?"/);
assert.match(pageSource, /id=\\?"openAiBaseUrl\\?"/);
assert.match(pageSource, /id=\\?"openAiApiKey\\?"/);
assert.match(pageSource, /id=\\?"openAiModel\\?"/);
assert.match(pageSource, /id=\\?"polishInstruction\\?"/);
assert.match(clientSource, /\/v1\/text\/polish/);
assert.match(clientSource, /POLISH_STORAGE_KEYS/);
assert.match(clientSource, /voicecraft-polish-base-url/);
assert.match(clientSource, /voicecraft-polish-api-key/);
assert.match(clientSource, /voicecraft-polish-model/);
assert.match(clientSource, /voicecraft-polish-instruction/);
assert.match(clientSource, /loadTextPolishSettings/);
assert.match(clientSource, /saveTextPolishSetting/);
assert.doesNotMatch(`${pageSource}\n${clientSource}\n${polishSource}`, /sk-[A-Za-z0-9_-]{8,}/);

let forwardedUrl = "";
let forwardedBody = null;
let forwardedHeaders = null;
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, options) => {
    forwardedUrl = String(url);
    forwardedHeaders = options.headers;
    forwardedBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
        choices: [
            {
                message: {
                    content: "这是一段更自然、清晰、适合朗读的文本。"
                }
            }
        ]
    }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
};

try {
    const response = await handleTextPolish(new Request("https://voicecraft.example.com/v1/text/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            baseUrl: "https://api.example.com/v1/",
            apiKey: "sk-test",
            model: "gpt-4o-mini",
            input: "这是一段需要润色的文字。",
            instruction: "请润色文本，只返回正文。"
        })
    }));

    assert.equal(response.status, 200);
    assert.equal(forwardedUrl, "https://api.example.com/v1/chat/completions");
    assert.equal(forwardedHeaders.Authorization, "Bearer sk-test");
    assert.equal(forwardedHeaders["Content-Type"], "application/json");
    assert.equal(forwardedBody.model, "gpt-4o-mini");
    assert.ok(Array.isArray(forwardedBody.messages));
    assert.equal(forwardedBody.messages[0].role, "system");
    assert.match(forwardedBody.messages[0].content, /请润色文本/);
    assert.equal(forwardedBody.messages[1].role, "user");
    assert.equal(forwardedBody.messages[1].content, "这是一段需要润色的文字。");

    const result = await response.json();
    assert.equal(result.text, "这是一段更自然、清晰、适合朗读的文本。");
} finally {
    globalThis.fetch = originalFetch;
}

console.log("Verified OpenAI-compatible text polishing flow.");
