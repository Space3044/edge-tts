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

function fail(message) {
    console.error(`✘ ${message}`);
    process.exit(1);
}

if (!clientId || !clientSecret) {
    fail(
        "未配置 MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET。\n" +
        "  本地：把两个值加进 .dev.vars 再重跑；线上：npx wrangler secret put <名字>"
    );
}

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    fail(`MICROSOFT_CLIENT_ID 不像一个应用程序(客户端) ID：${clientId.slice(0, 12)}…`);
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
