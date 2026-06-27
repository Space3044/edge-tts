import { sign } from "./signing.js";

const TOKEN_REFRESH_BEFORE_EXPIRY = 3 * 60;
let tokenInfo = {
    endpoint: null,
    token: null,
    expiredAt: null
};

export async function getEndpoint() {
    const now = Date.now() / 1000;

    if (tokenInfo.token && tokenInfo.expiredAt && now < tokenInfo.expiredAt - TOKEN_REFRESH_BEFORE_EXPIRY) {
        return tokenInfo.endpoint;
    }

    const endpointUrl = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
    const clientId = crypto.randomUUID().replace(/-/g, "");
    const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
            "Accept-Language": "zh-Hans",
            "X-ClientVersion": "4.0.530a 5fe1dc6c",
            "X-UserId": "0f04d16a175c411e",
            "X-HomeGeographicRegion": "zh-Hans-CN",
            "X-ClientTraceId": clientId,
            "X-MT-Signature": await sign(endpointUrl),
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": "0",
            "Accept-Encoding": "gzip"
        }
    });

    if (!response.ok) {
        throw new Error(`获取endpoint失败: ${response.status}`);
    }

    const data = await response.json();
    const jwt = data.t.split(".")[1];
    const decodedJwt = JSON.parse(atob(jwt));

    tokenInfo = {
        endpoint: data,
        token: data.t,
        expiredAt: decodedJwt.exp
    };

    return data;
}
