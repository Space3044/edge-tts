import { makeCORSHeaders } from "./cors.js";

export function jsonResponse(body, { status = 200, headers = {} } = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...makeCORSHeaders(),
            ...headers
        }
    });
}

export function errorResponse(message, {
    status = 500,
    type = "api_error",
    param = null,
    code = "api_error"
} = {}) {
    return jsonResponse({
        error: {
            message,
            type,
            param,
            code
        }
    }, { status });
}

export function audioResponse(audioBlob, { filename, contentType = "audio/mpeg" } = {}) {
    const headers = {
        "Content-Type": contentType,
        ...makeCORSHeaders()
    };

    if (filename) {
        headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    }

    return new Response(audioBlob, { headers });
}
