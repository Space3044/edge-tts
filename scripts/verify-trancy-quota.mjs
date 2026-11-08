import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import vm from "node:vm";
import { fetchTrancyProfile, fetchYoutubeCaptions } from "../src/trancy/api.js";
import { requestYoutubeCaptions } from "../src/trancy/captions.js";
import { accountView, addTrancyAccount, listTrancyAccounts, markCaptionExhausted, pickCaptionAccounts, recordCaptionUsage, refreshTrancyAccount, utcDay } from "../src/trancy/store.js";
import { handleTrancy } from "../src/routes/trancy.js";
import { CLIENT_SCRIPT } from "../src/frontend/client.js";
import { translations } from "../src/frontend/i18n.js";

// Exercise the actual SQLite expressions (including concurrent daily increments)
// rather than teaching a SQL mock the behavior we want to verify.
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
const env = {
    SECRETS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    DB: { prepare(sql) {
        const stmt = sqlite.prepare(sql);
        return {
            params: [],
            bind(...params) { this.params = params; return this; },
            async first() { return stmt.get(...this.params) || null; },
            async all() { return { results: stmt.all(...this.params) }; },
            async run() { return { meta: { changes: stmt.run(...this.params).changes } }; }
        };
    } }
};
const reply = (body, headers = {}, status = 200) => new Response(JSON.stringify(body), { status, headers });
const tokenFor = id => `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ id, name: id, iat: 1793602683 })).toString("base64url")}.signature`;
const profileFetch = async (_url, options) => {
    const token = options.headers.Authorization.slice(7);
    const { id } = JSON.parse(Buffer.from(token.split(".")[1], "base64url"));
    return reply({ message: "ok", data: { id, token, email: `${id}@example.com` } });
};
const row = await addTrancyAccount(env, { token: tokenFor("quota-test"), fetchImpl: profileFetch });
const stored = () => sqlite.prepare("SELECT * FROM trancy_account WHERE id = ?").get(row.id);

assert.equal(accountView(stored()).quotaRemaining, -1, "new accounts have no invented balance");
assert.equal(accountView(stored()).quotaStatus, "unknown");
await recordCaptionUsage(env, row.id, { quotaLimit: 5, quotaRemaining: 3 });
const observed = accountView(stored());
assert.equal(observed.quotaRemaining, 3);
assert.equal(observed.quotaStatus, "observed");
assert.equal(observed.usedToday, 1, "gateway calls and upstream consumption are independent");
await recordCaptionUsage(env, row.id, { quotaLimit: 5, quotaRemaining: 3 });
assert.equal(accountView(stored()).usedToday, 2);
assert.equal(accountView(stored()).quotaRemaining, 3, "upstream cache hits need not spend quota");

const nextDay = Date.parse(`${utcDay()}T00:00:00Z`) + 86400_000;
const tomorrow = accountView(stored(), { now: nextDay });
assert.equal(tomorrow.quotaRemaining, -1, "yesterday's observation is not today's balance");
assert.equal(tomorrow.quotaStatus, "stale");
assert.equal(tomorrow.usedToday, 0);
assert.equal(tomorrow.captionAvailable, true, "expired observations do not block retry");

await recordCaptionUsage(env, row.id, { quotaRemaining: 2 });
assert.equal(stored().quota_limit, 5, "a missing limit does not overwrite an observed limit");
await recordCaptionUsage(env, row.id);
assert.equal(accountView(stored()).quotaRemaining, -1, "an AI call without headers invalidates its previous balance");
await Promise.all(Array.from({ length: 12 }, () => recordCaptionUsage(env, row.id)));
assert.equal(stored().day_used, 16, "concurrent completions cannot lose daily increments");

await markCaptionExhausted(env, row.id, new Date(Date.now() + 3600_000).toISOString(), { quotaLimit: 8 });
assert.equal(stored().quota_limit, 8, "daily-limit replies also persist the observed limit");
assert.equal(accountView(stored()).captionAvailable, false);
assert.equal(accountView(stored()).quotaStatus, "exhausted");
assert.equal((await pickCaptionAccounts(env)).length, 0);
assert.equal((await pickCaptionAccounts(env, { source: "json3" })).length, 1);
const beforeNative = stored();
const native = await requestYoutubeCaptions(env, {
    videoId: "npka43vhwNo", source: "json3",
    fetchImpl: async () => reply({ data: [{ text: "native" }] }, { "x-quota-limit": "99", "x-quota-remaining": "98" })
});
assert.equal(native.ok, true, "AI exhaustion never blocks native captions");
assert.deepEqual(native.quota, { limit: -1, remaining: -1 }, "native response headers are not AI balance observations");
for (const key of ["quota_limit", "quota_remaining", "quota_checked_at", "exhausted_until", "day_used"]) {
    assert.equal(stored()[key], beforeNative[key], `native captions preserve ${key}`);
}
await refreshTrancyAccount(env, row.id, { fetchImpl: profileFetch });
assert.equal(stored().quota_checked_at, beforeNative.quota_checked_at, "login refresh does not pretend to query balance");
assert.equal(stored().exhausted_until, beforeNative.exhausted_until, "login refresh cannot restore spent quota");

// Expired parking restores eligibility but never a fabricated full balance.
const expired = accountView({ ...stored(), quota_checked_at: "2026-01-01T00:00:00Z", exhausted_until: "2026-01-02T00:00:00Z" });
assert.equal(expired.captionAvailable, true);
assert.equal(expired.quotaRemaining, -1);
assert.equal(expired.exhaustedUntil, "");
for (const override of [{ status: "dead" }, { banned: 1 }, { cooldown_until: new Date(Date.now() + 60_000).toISOString() }]) {
    assert.equal(accountView({ ...stored(), exhausted_until: "", ...override }).captionAvailable, false);
}
assert.equal(accountView({ ...stored(), exhausted_until: "" }, { tokenError: "bad key" }).captionAvailable, false);

sqlite.prepare("UPDATE trancy_account SET quota_limit = 0, quota_remaining = 0, exhausted_until = '' WHERE id = ?").run(row.id);
const beforeList = stored();
const legacy = (await listTrancyAccounts(env))[0];
assert.equal(legacy.quotaRemaining, -1, "legacy missing-header zeros are unknown");
assert.equal(legacy.usedToday, 16, "legacy repair cannot erase real AI usage");
assert.deepEqual(stored(), beforeList, "listing accounts is read-only");

for (const body of [null, {}, { code: 503, message: "unavailable", data: null }, { message: "ok", data: {} }]) {
    const result = await fetchTrancyProfile("token", { fetchImpl: async () => reply(body) });
    assert.equal(result.reason, "invalid_response", "malformed profiles must not retire credentials");
}
assert.equal((await fetchTrancyProfile("token", { fetchImpl: async () => reply({ message: "ok", data: null }) })).reason, "token_invalid");
const temporary = await refreshTrancyAccount(env, row.id, { fetchImpl: async () => reply({ code: 503, message: "unavailable" }) });
assert.equal(temporary.refreshed, false);
assert.equal(temporary.account.status, "ok");
assert.equal(temporary.account.captionAvailable, false);

for (const status of [200, 403, 429]) {
    const daily = await fetchYoutubeCaptions({ fetchImpl: async () => reply({ code: 403, message: "Daily limit reached" }, {}, status) });
    assert.equal(daily.reason, "daily_limit");
}
const denied = await fetchYoutubeCaptions({ fetchImpl: async () => reply({ code: 403, message: "Permission denied" }) });
assert.equal(denied.reason, "rejected", "a generic 403 must not exhaust an account's quota");
for (const value of ["", " ", "-2", "1.5", "Infinity", "1e3", "0x10", "9007199254740992"]) {
    const result = await fetchYoutubeCaptions({ fetchImpl: async () => reply({ data: [] }, { "x-quota-remaining": value }) });
    assert.equal(result.quota.remaining, -1, `invalid header ${value} is unknown`);
}
const zero = await fetchYoutubeCaptions({ fetchImpl: async () => reply({ data: [] }, { "x-quota-remaining": "0" }) });
assert.equal(zero.quota.remaining, 0, "a real zero must survive parsing");

// Three failures are the per-request budget, not proof that four accounts are exhausted.
sqlite.exec("DELETE FROM trancy_account");
for (let i = 0; i < 4; i++) await addTrancyAccount(env, { token: tokenFor(`pool-${i}`), fetchImpl: profileFetch });
let calls = 0;
const partial = await requestYoutubeCaptions(env, {
    videoId: "npka43vhwNo",
    fetchImpl: async () => { calls++; return reply({ code: 403, message: "Daily limit reached" }, { "x-quota-limit": "5" }); }
});
assert.equal(calls, 3);
assert.equal(partial.reason, "caption_failed", "untried accounts can still have quota");
assert.equal(partial.resetAt, "", "partial failure cannot promise pool-wide recovery at midnight");
assert.equal((await pickCaptionAccounts(env)).length, 1);
sqlite.prepare("UPDATE trancy_account SET cooldown_until = ? WHERE exhausted_until = ''").run(new Date(Date.now() + 60_000).toISOString());
const cooling = await requestYoutubeCaptions(env, { videoId: "npka43vhwNo", fetchImpl: async () => { throw new Error("unexpected request"); } });
assert.equal(cooling.reason, "no_account", "a mix of cooling and exhausted accounts is not total quota exhaustion");
assert.equal(cooling.resetAt, "", "cooldown or login failure has no known quota reset time");
const listResponse = await handleTrancy(new Request("https://example.com/api/trancy/accounts"), env);
assert.equal(listResponse.headers.get("cache-control"), "no-store");

// Real upstream response: a missing AI track must not retire healthy accounts.
for (const status of [200, 409]) {
    const missing = await fetchYoutubeCaptions({
        videoId: "mFGzioRMW5s",
        fetchImpl: async () => reply({ code: 409, message: "AI caption not found" }, {}, status)
    });
    assert.equal(missing.reason, "caption_not_found");
    assert.equal(missing.message, "AI caption not found");
}
const differentConflict = await fetchYoutubeCaptions({
    fetchImpl: async () => reply({ code: 409, message: "Account not allowed" })
});
assert.equal(differentConflict.reason, "rejected", "other 409 responses keep their existing handling");
sqlite.exec("UPDATE trancy_account SET cooldown_until = '', exhausted_until = ''");
const beforeMissing = sqlite.prepare("SELECT * FROM trancy_account ORDER BY id").all();
let missingCalls = 0;
const missingFetch = async () => {
    missingCalls++;
    return reply({ code: 409, message: "AI caption not found" });
};
const noTrack = await requestYoutubeCaptions(env, { videoId: "mFGzioRMW5s", fetchImpl: missingFetch });
assert.equal(noTrack.reason, "caption_not_found");
assert.equal(noTrack.resetAt, "");
assert.equal(missingCalls, 1, "do not retry a video-level absence with more accounts");
assert.deepEqual(sqlite.prepare("SELECT * FROM trancy_account ORDER BY id").all(), beforeMissing,
    "missing captions must not change quota, usage, token status or cooldown");
const originalFetch = globalThis.fetch;
try {
    globalThis.fetch = missingFetch;
    const response = await handleTrancy(new Request("https://example.com/api/trancy/captions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: "mFGzioRMW5s", source: "audio" })
    }), env);
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.error.code, "caption_not_found");
    assert.equal(body.error.message, "AI caption not found");
    assert.equal(body.resetAt, "");
} finally {
    globalThis.fetch = originalFetch;
}

// Run the real rendering and refresh handlers against a tiny DOM, so the
// numeric summary and failure feedback remain covered without a browser setup.
class Element {
    children = [];
    style = {};
    text = "";
    set textContent(value) { this.text = String(value); this.children = []; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(""); }
    set innerHTML(value) { this.textContent = value; }
    appendChild(child) { this.children.push(child); }
    setAttribute() {}
    removeAttribute() {}
    addEventListener() {}
}
const elements = new Map();
const context = {
    document: {
        getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
        createElement() { return new Element(); },
        createTextNode(text) { const node = new Element(); node.textContent = text; return node; }
    },
    t: key => translations.zh[key] || translations.en[key] || key,
    Date
};
vm.createContext(context);
vm.runInContext(CLIENT_SCRIPT.slice(CLIENT_SCRIPT.indexOf("var trancyState =")), context);
context.trancyState.accounts = [
    { ...observed, id: "known" },
    { ...observed, id: "unknown", quotaRemaining: -1, quotaStatus: "unknown" },
    { ...observed, id: "stale", quotaRemaining: -1, quotaStatus: "stale" },
    { ...observed, id: "dead", status: "dead", quotaRemaining: 99, captionAvailable: false },
    { ...observed, id: "cooldown", quotaRemaining: 88, captionAvailable: false }
];
context.renderTrancyAccounts();
assert.equal(elements.get("trancyQuotaSummary").textContent, "可用账号已观测 AI 余额 3 · 2 个账号额度未知");
assert.equal(elements.get("trancySummary").textContent, "3 / 5 可尝试 AI 请求");
assert.match(elements.get("trancyAccountList").textContent, /未知（上次观测已过期）/);
assert.match(elements.get("trancyAccountList").textContent, /网关今日 AI 调用（UTC） 1/);
context.loadTrancyAccounts = async () => {};
context.fetch = async () => reply({ result: { refreshed: false, reason: "network" } });
await context.refreshTrancyAccount("known", null);
assert.match(elements.get("trancyAddStatus").textContent, /network/);
assert.doesNotMatch(elements.get("trancyAddStatus").textContent, /登录检查完成/);

sqlite.close();
console.log("Verified Trancy quota freshness, honest balances, native captions, atomic counters, failure classification and rendered refresh feedback.");
