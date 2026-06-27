import { errorResponse, jsonResponse } from "../utils/response.js";

const DEFAULT_INSTRUCTION = "请在不改变原意的前提下润色这段文本，使其更自然、清晰、适合语音朗读。只返回润色后的正文，不要解释。";
const MAX_TEXT_LENGTH = 10000;

function normalizeBaseUrl(value) {
    const rawUrl = typeof value === "string" ? value.trim() : "";
    if (!rawUrl) {
        throw new Error("请输入 OpenAI 兼容接口地址");
    }

    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error("OpenAI 兼容接口地址格式无效");
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("OpenAI 兼容接口地址必须以 http:// 或 https:// 开头");
    }

    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
}

function getRequestBodyValue(body, key) {
    return typeof body?.[key] === "string" ? body[key].trim() : "";
}

function buildChatCompletionsUrl(baseUrl) {
    return new URL(`${baseUrl}/chat/completions`).toString();
}

function extractPolishedText(result) {
    const content = result?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : "";
}

function readApiError(status) {
    if (status === 401 || status === 403) {
        return "AI 润色接口鉴权失败，请检查 API Key";
    }
    if (status === 404) {
        return "AI 润色接口地址不可用，请检查 Base URL";
    }
    if (status === 429) {
        return "AI 润色接口请求过于频繁，请稍后重试";
    }
    return "AI 润色接口暂时不可用";
}

export async function handleTextPolish(request) {
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
        if (!contentType.includes("application/json")) {
            return errorResponse("请求必须使用JSON格式", {
                status: 400,
                type: "invalid_request_error",
                param: "content-type",
                code: "invalid_content_type"
            });
        }

        const requestBody = await request.json();
        const baseUrl = normalizeBaseUrl(requestBody.baseUrl);
        const apiKey = getRequestBodyValue(requestBody, "apiKey");
        const model = getRequestBodyValue(requestBody, "model");
        const input = getRequestBodyValue(requestBody, "input");
        const instruction = getRequestBodyValue(requestBody, "instruction") || DEFAULT_INSTRUCTION;

        if (!apiKey) {
            return errorResponse("请输入 API Key", {
                status: 400,
                type: "invalid_request_error",
                param: "apiKey",
                code: "missing_api_key"
            });
        }

        if (!model) {
            return errorResponse("请输入模型名称", {
                status: 400,
                type: "invalid_request_error",
                param: "model",
                code: "missing_model"
            });
        }

        if (!input) {
            return errorResponse("请输入要润色的文本", {
                status: 400,
                type: "invalid_request_error",
                param: "input",
                code: "missing_input"
            });
        }

        if (input.length > MAX_TEXT_LENGTH) {
            return errorResponse("文本内容过长（最大10000字符）", {
                status: 400,
                type: "invalid_request_error",
                param: "input",
                code: "text_too_long"
            });
        }

        const apiResponse = await fetch(buildChatCompletionsUrl(baseUrl), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: instruction },
                    { role: "user", content: input }
                ],
                temperature: 0.4
            })
        });

        if (!apiResponse.ok) {
            console.error("AI polish API error:", apiResponse.status);
            return errorResponse(readApiError(apiResponse.status), {
                status: apiResponse.status,
                type: "api_error",
                code: "polish_api_error"
            });
        }

        const result = await apiResponse.json();
        const text = extractPolishedText(result);

        if (!text) {
            return errorResponse("AI 润色接口未返回可用文本", {
                status: 502,
                type: "api_error",
                code: "empty_polish_result"
            });
        }

        return jsonResponse({ text });
    } catch (error) {
        console.error("AI 润色处理失败:", error);
        return errorResponse(error.message || "AI 润色处理失败", {
            status: 500,
            type: "api_error",
            code: "polish_processing_error"
        });
    }
}
