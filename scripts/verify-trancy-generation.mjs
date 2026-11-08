import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { addTrancyAccount, markCaptionExhausted, utcDay } from "../src/trancy/store.js";
import { requestYoutubeCaptions, pollYoutubeCaptions } from "../src/trancy/captions.js";
import { createCaptionTicket, CAPTION_JOB_TTL_MS } from "../src/trancy/caption-ticket.js";
import { fetchYoutubeCaptions, fetchYoutubeCaptionStatus, submitYoutubeCaptions } from "../src/trancy/api.js";
import { handleTrancy } from "../src/routes/trancy.js";

const videoId = "mFGzioRMW5s";
const transcript = [{ text: "Hello world.", start: 0, end: 1, words: [{ text: "Hello", start: 0, end: 0.5 }, { text: "world", start: 0.5, end: 1 }] }];
const reply = (body, headers = {}, status = 200) => new Response(JSON.stringify(body), { status, headers });
const missing = () => reply({ code: 409, message: "AI caption not found" });
const state = (status, retry = false) => reply({ message: "ok", data: { status, retry } });
const ready = () => reply({ message: "ok", data: transcript }, { "x-quota-limit": "2", "x-quota-remaining": "0" });
const accepted = () => reply({ message: "ok", data: "pending" }, { "x-quota-limit": "2", "x-quota-remaining": "1" });
const tokenFor = id => `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ id, name: id, iat: 1793602683 })).toString("base64url")}.signature`;
const ticketOf = result => new URL(result.statusUrl, "https://gateway.test").searchParams.get("ticket");

async function fixture(count = 1) {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
    const env = {
        SECRETS_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
        DB: { prepare(sql) {
            const statement = sqlite.prepare(sql);
            return {
                params: [], bind(...params) { this.params = params; return this; },
                async first() { return statement.get(...this.params) || null; },
                async all() { return { results: statement.all(...this.params) }; },
                async run() { return { meta: { changes: statement.run(...this.params).changes } }; }
            };
        } }
    };
    const accounts = [];
    for (let i = 0; i < count; i++) {
        const id = `generation-${i}`;
        accounts.push(await addTrancyAccount(env, { token: tokenFor(id), fetchImpl: async () => reply({ message: "ok", data: { id, email: `${id}@example.com`, token: tokenFor(id) } }) }));
    }
    return { env, sqlite, accounts, row: (id = accounts[0].id) => sqlite.prepare("SELECT * FROM trancy_account WHERE id = ?").get(id) };
}

function sequence(steps) {
    const calls = [];
    const fetchImpl = async (url, options) => {
        const request = { url: new URL(url), options };
        calls.push(request);
        const step = steps.shift();
        assert.ok(step, `unexpected upstream call: ${options.method} ${url}`);
        return step(request);
    };
    return { fetchImpl, calls, done() { assert.equal(steps.length, 0); } };
}

async function withFetch(fetchImpl, run) {
    const original = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try { return await run(); } finally { globalThis.fetch = original; }
}

// Real upstream envelopes and verb/parameter contracts, including HTTP-200 errors.
{
    const s = sequence([
        ({ url, options }) => {
            assert.equal(url.pathname, "/2/youtube/captions");
            assert.equal(options.method, "POST");
            assert.equal(options.headers.Authorization, "Bearer test-token");
            const body = JSON.parse(options.body);
            assert.equal(body.id, videoId);
            assert.equal(body.target, "zh-CN");
            assert.equal(body.language, "zh-CN");
            assert.equal(body.cover, `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
            return accepted();
        },
        ({ url, options }) => {
            assert.equal(url.pathname, `/2/youtube/captions/${videoId}/status`);
            assert.equal(url.searchParams.get("target"), "zh-CN");
            assert.equal(options.method, "GET");
            return state("none");
        }
    ]);
    assert.equal((await submitYoutubeCaptions({ token: "test-token", videoId, target: "zh-CN", fetchImpl: s.fetchImpl })).status, "pending");
    assert.equal((await fetchYoutubeCaptionStatus({ token: "test-token", videoId, target: "zh-CN", fetchImpl: s.fetchImpl })).status, "none");
    s.done();
    for (const data of [null, [], {}, { status: "unexpected" }]) {
        const result = await fetchYoutubeCaptionStatus({ videoId, fetchImpl: async () => reply({ message: "ok", data }) });
        assert.equal(result.reason, "invalid_response");
    }
    assert.equal((await fetchYoutubeCaptions({ videoId, fetchImpl: async () => reply({ message: "ok", data: [] }) })).reason, "invalid_response");
}

// Full HTTP lifecycle: 202 -> pending -> downloaded -> 200 with real word timings.
// The ticket pins the account; quota exhaustion after submission cannot hide the job.
{
    const f = await fixture(2);
    const start = sequence([missing, () => state("none"), accepted]);
    const response = await withFetch(start.fetchImpl, () => handleTrancy(new Request("https://gateway.test/api/trancy/captions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId })
    }), f.env));
    assert.equal(response.status, 202);
    assert.equal(response.headers.get("retry-after"), "5");
    assert.equal(response.headers.get("cache-control"), "no-store");
    const job = await response.json();
    assert.equal(response.headers.get("location"), job.statusUrl);
    assert.equal(job.pending, true);
    assert.ok(!JSON.stringify(job).includes(tokenFor("generation-0")));
    assert.equal(f.row(job.account.id).day_used, 1);
    assert.equal(f.row(job.account.id).use_count, 1);
    start.done();
    await markCaptionExhausted(f.env, job.account.id);
    const before = f.row(job.account.id);
    const polls = sequence([() => state("pending"), () => state("downloaded"), () => state("ok"), ready, () => state("ok"), ready]);
    for (const expected of [202, 202, 200, 200]) {
        const res = await withFetch(polls.fetchImpl, () => handleTrancy(new Request("https://gateway.test" + job.statusUrl), f.env));
        assert.equal(res.status, expected);
        const data = await res.json();
        if (expected === 200) {
            assert.deepEqual(data.data, transcript);
            assert.equal(data.usedToday, 1);
            assert.equal(data.account.id, job.account.id);
        }
    }
    assert.ok(polls.calls.every(({ options }) => options.method === "GET"));
    assert.ok(polls.calls.every(({ options }) => options.headers.Authorization === start.calls[0].options.headers.Authorization));
    assert.equal(f.row(job.account.id).day_used, before.day_used);
    assert.equal(f.row(job.account.id).use_count, before.use_count);
    assert.equal(f.row(job.account.id).exhausted_until, before.exhausted_until);
    assert.equal(f.row(job.account.id).quota_remaining, 0);
    assert.equal(f.row(f.accounts.find(a => a.id !== job.account.id).id).day_used, 0);
    polls.done();
    const noHeaders = sequence([() => state("ok"), () => reply({ message: "ok", data: transcript })]);
    await pollYoutubeCaptions(f.env, ticketOf(job), { fetchImpl: noHeaders.fetchImpl });
    assert.equal(f.row(job.account.id).quota_remaining, -1, "a completed AI read without headers invalidates the old balance");
    assert.equal(f.row(job.account.id).quota_checked_at, "");
    assert.equal(f.row(job.account.id).exhausted_until, before.exhausted_until);
    noHeaders.done();
    // Upstream jobs survive a Worker restart; a second request needs only env + ticket.
    const ticket = ticketOf(job);
    const invalid = await pollYoutubeCaptions(f.env, ticket.slice(0, -8) + "AAAAAA==", { fetchImpl: async () => assert.fail("tampered ticket must not reach Trancy") });
    assert.equal(invalid.reason, "invalid_caption_ticket");
    const expiredTicket = await createCaptionTicket(f.env, { videoId, target: "en", accountId: job.account.id }, Date.now() - CAPTION_JOB_TTL_MS - 1000);
    assert.equal((await pollYoutubeCaptions(f.env, expiredTicket)).reason, "generation_timeout");
    const renewedUser = f.row(job.account.id).user_id;
    const renewed = tokenFor(renewedUser).replace(".signature", ".renewed");
    await addTrancyAccount(f.env, { token: renewed, fetchImpl: async () => reply({ message: "ok", data: { id: renewedUser, token: renewed } }) });
    const renewedStatus = sequence([({ options }) => { assert.equal(options.headers.Authorization, `Bearer ${renewed}`); return state("pending"); }]);
    assert.equal((await pollYoutubeCaptions(f.env, ticket, { fetchImpl: renewedStatus.fetchImpl })).pending, true);
    renewedStatus.done();
    f.sqlite.prepare("DELETE FROM trancy_account WHERE id = ?").run(job.account.id);
    assert.equal((await pollYoutubeCaptions(f.env, ticket)).reason, "caption_account_unavailable");
    f.sqlite.close();
}

// JSON3 and an existing AI transcript do not call generation endpoints.
{
    const f = await fixture();
    for (const source of ["audio", "json3"]) {
        const s = sequence([({ url }) => { assert.equal(url.searchParams.get("source"), source); return ready(); }]);
        const result = await requestYoutubeCaptions(f.env, { videoId, source, fetchImpl: s.fetchImpl });
        assert.equal(result.ok, true);
        assert.equal(result.pending, undefined);
        s.done();
    }
    const s = sequence([missing]);
    assert.equal((await requestYoutubeCaptions(f.env, { videoId, source: "json3", fetchImpl: s.fetchImpl })).reason, "caption_not_found");
    s.done();
    f.sqlite.close();
}

// Already-running upstream tasks are followed without another submission or debit.
for (const status of ["pending", "downloaded", "ok"]) {
    const f = await fixture();
    const before = f.row();
    const s = sequence([missing, () => state(status)]);
    const job = await requestYoutubeCaptions(f.env, { videoId, fetchImpl: s.fetchImpl });
    assert.equal(job.pending, true);
    assert.equal(job.status, status);
    assert.deepEqual(f.row(), before);
    s.done();
    f.sqlite.close();
}

// Explicit generation refusal may move to the next account, with the usual budget.
{
    const f = await fixture(2);
    const s = sequence([missing, () => state("none"), () => reply({ code: 403, message: "Daily limit reached" }, { "x-quota-limit": "2" }), missing, () => state("none"), accepted]);
    const job = await requestYoutubeCaptions(f.env, { videoId, fetchImpl: s.fetchImpl });
    assert.equal(job.pending, true);
    assert.equal(f.row(job.account.id).day_used, 1);
    const exhausted = f.accounts.find(a => a.id !== job.account.id);
    assert.ok(f.row(exhausted.id).exhausted_until);
    assert.equal(f.row(exhausted.id).day_used, 0);
    s.done();
    f.sqlite.close();
}

// Permission errors are not quota exhaustion or broken credentials.
{
    const f = await fixture();
    const before = f.row();
    const s = sequence([missing, () => state("none"), () => reply({ code: 403, message: "Premium required" })]);
    const result = await requestYoutubeCaptions(f.env, { videoId, fetchImpl: s.fetchImpl });
    assert.equal(result.reason, "permission_denied");
    assert.equal(result.resetAt, "");
    assert.deepEqual(f.row(), before);
    s.done();
    f.sqlite.close();
}

// Unknown POST outcomes must never fail over and submit a second job.
for (const submit of [() => { throw new Error("network disconnected"); }, () => reply({ message: "unavailable" }, {}, 503), () => new Response("not JSON")]) {
    const f = await fixture(2);
    const s = sequence([missing, () => state("none"), submit]);
    const job = await requestYoutubeCaptions(f.env, { videoId, fetchImpl: s.fetchImpl });
    assert.equal(job.status, "submission_unknown");
    assert.equal(f.row(job.account.id).day_used, 0, "an unconfirmed submission is not a known debit");
    s.done();
    const ticket = ticketOf(job);
    assert.equal((await pollYoutubeCaptions(f.env, ticket, { fetchImpl: async () => state("none") })).pending, true);
    assert.equal((await pollYoutubeCaptions(f.env, ticket, { now: Date.now() + 31000, fetchImpl: async () => state("none") })).reason, "generation_not_found");
    const recovered = sequence([() => state("ok"), ready]);
    assert.equal((await pollYoutubeCaptions(f.env, ticket, { fetchImpl: recovered.fetchImpl })).ok, true);
    assert.ok(recovered.calls.every(({ options }) => options.method === "GET"));
    recovered.done();
    f.sqlite.close();
}

// Video failure never cools an account. Only an explicit new start can retry.
{
    const f = await fixture();
    const before = f.row();
    const failed = sequence([missing, () => state("error")]);
    assert.equal((await requestYoutubeCaptions(f.env, { videoId, fetchImpl: failed.fetchImpl })).reason, "generation_failed");
    assert.deepEqual(f.row(), before);
    failed.done();
    const retry = sequence([missing, () => state("error", true), accepted]);
    const job = await requestYoutubeCaptions(f.env, { videoId, fetchImpl: retry.fetchImpl });
    assert.equal(job.pending, true);
    retry.done();
    const current = f.row();
    assert.equal((await pollYoutubeCaptions(f.env, ticketOf(job), { fetchImpl: async () => state("error", true) })).reason, "generation_failed");
    assert.deepEqual(f.row(), current);
    const unknown = sequence([missing, () => state("future_status")]);
    assert.equal((await requestYoutubeCaptions(f.env, { videoId, fetchImpl: unknown.fetchImpl })).reason, "invalid_response");
    unknown.done();
    assert.equal(f.row().day_used_date, utcDay());
    f.sqlite.close();
}

console.log("Verified Trancy generation, HTTP 202 polling, quota accounting, account affinity, continuation protection and ambiguous submission recovery with SQLite.");
