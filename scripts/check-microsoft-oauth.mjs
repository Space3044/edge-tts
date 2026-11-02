/**
 * Check the Microsoft OAuth credentials in .dev.vars (or the environment).
 *
 *   node scripts/check-microsoft-oauth.mjs
 *
 * It only needs the app registration, not a user login: a client_credentials
 * request tells us whether the client id + secret pair is accepted. A missing
 * grant (AADSTS65001 / invalid_scope / unauthorized_client) still means the
 * credential itself is fine, because the app uses delegated permissions.
 */

import { readFileSync, existsSync } from "node:fs";

const APP_DIR = new URL("..", import.meta.url);

function readDevVars() {
    const file = new URL(".dev.vars", APP_DIR);
    if (!existsSync(file)) {
        return {};
    }
    const values = {};
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const index = trimmed.indexOf("=");
        values[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
    }
    return values;
}

const fileValues = readDevVars();
const env = { ...fileValues, ...process.env };
const clientId = String(env.MICROSOFT_CLIENT_ID || "").trim();
const clientSecret = String(env.MICROSOFT_CLIENT_SECRET || "").trim();
const tenant = String(env.MICROSOFT_TENANT || "").trim() || "common";

// Well-known public client ids belong to their vendors. Using one would make the
// consent screen say "Thunderbird" (etc.) and would request scopes that app never
// declared, so it is both broken and impersonation.
const THIRD_PARTY_CLIENT_IDS = {
    "9e5f94bc-e8a4-4e73-b8be-63364c29d753": "Mozilla Thunderbird",
    "d3590ed6-52b3-4102-aeff-aad2292ab01c": "Microsoft Office",
    "1b730954-1685-4b74-9bfd-dac224a7b894": "Azure CLI",
    "04b07795-8ddb-461a-bbee-02f9e1bf7b46": "Azure CLI (legacy)"
};
const owner = THIRD_PARTY_CLIENT_IDS[clientId.toLowerCase()];
if (owner) {
    fail(
        `这个 client id 是 ${owner} 的公开应用，不是你的。\n` +
        "  - 它的应用注册里没有声明 Cognitive Services Speech 权限，授权会失败（AADSTS65001 / invalid_scope）\n" +
        "  - 也不该冒用别人的应用身份去拿令牌\n" +
        "  请注册自己的应用（免费，约 2 分钟），见 README 的「Microsoft」一节。"
    );
}

function fail(message) {
    console.error(`✘ ${message}`);
    process.exit(1);
}

if (!clientId) {
    fail(
        "未配置 MICROSOFT_CLIENT_ID。\n" +
        "  本地：把它加进 .dev.vars 再重跑；线上：npx wrangler secret put MICROSOFT_CLIENT_ID"
    );
}

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    fail(`MICROSOFT_CLIENT_ID 不像一个应用程序(客户端) ID：${clientId.slice(0, 12)}…`);
}

if (!clientSecret) {
    // Public client: no secret to validate, so probe the authorize endpoint and
    // read the AADSTS code it renders for an unknown app / tenant.
    const url = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", "http://localhost:8787/api/microsoft/callback");
    url.searchParams.set("scope", "https://cognitiveservices.azure.com/.default offline_access");
    url.searchParams.set("prompt", "none");

    const page = await fetch(url).then(res => res.text()).catch(() => "");
    if (/AADSTS700016|AADSTS90002/.test(page)) {
        fail(
            "client id 或 tenant 不被识别（AADSTS700016 / AADSTS90002）。\n" +
            "  检查应用注册里的「应用程序(客户端) ID」和 MICROSOFT_TENANT 是否匹配"
        );
    }
    console.log("✔ 没有配置 client secret：按公共客户端（PKCE）处理，client id 形状与租户都正常");
    console.log("  若登录最后一步报 AADSTS7000218（需要 client secret），说明这个应用是 Web 平台，");
    console.log("  去「证书和密码」新建一个 secret，填进 MICROSOFT_CLIENT_SECRET 再试。");
    console.log("  下一步：Provider settings 填 region → 点「登录微软账号」。");
    process.exit(0);
}

if (clientSecret.length < 20) {
    fail("MICROSOFT_CLIENT_SECRET 太短，看起来不是证书与密码里生成的「值」");
}

const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials",
            scope: "https://cognitiveservices.azure.com/.default"
        })
    }
);

const payload = await response.json().catch(() => ({}));
const code = String(payload.error || "");

if (response.ok && payload.access_token) {
    console.log("✔ 凭据有效，并且应用已获得 Speech 权限（管理员已同意）");
    console.log("  下一步：在页面 Provider settings 里填写 Azure region，然后点「登录微软账号」");
    process.exit(0);
}

if (code === "invalid_client" || /AADSTS7000215|AADSTS700016|AADSTS90002/.test(String(payload.error_description))) {
    fail(
        `凭据被拒绝（${code || response.status}）：${String(payload.error_description || "").slice(0, 220)}\n` +
        "  - AADSTS7000215 = client secret 填错或已过期\n" +
        "  - AADSTS700016 / AADSTS90002 = client id 或 tenant 不对"
    );
}

if (/AADSTS65001|invalid_scope|unauthorized_client|AADSTS70011/.test(`${code} ${payload.error_description || ""}`)) {
    console.log("✔ 凭据有效（client id + secret 都被接受）");
    console.log(`  应用还没有 client_credentials 权限：${code || response.status}，这对委托登录是正常的。`);
    console.log("  下一步：在页面 Provider settings 里填写 Azure region，然后点「登录微软账号」");
    process.exit(0);
}

// Conditional Access, tenant restrictions and other policy gates block the
// client_credentials probe without saying anything about the credential pair.
// The definitive check is the browser login, so report this as inconclusive
// rather than as a failure.
console.log("⚠ 无法用 client_credentials 判定凭据（被租户策略挡住），这不代表凭据有错。");
console.log(`  ${code || response.status}: ${String(payload.error_description || "").slice(0, 200)}`);
console.log("  直接走页面流程验证：Provider settings 填 region → 点「登录微软账号」。");
process.exit(0);
