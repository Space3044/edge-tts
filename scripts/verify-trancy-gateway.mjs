import assert from "node:assert/strict";
import { bytesToBase64, importEncryptionKey, decryptSecret } from "../src/secrets/crypto.js";
import { normalizeCaptionRequest, requestYoutubeCaptions } from "../src/trancy/captions.js";
import { handleTrancy } from "../src/routes/trancy.js";
import {
    addTrancyAccount,
    pickCaptionAccounts,
    loginTrancyAccount,
    reloginTrancyAccount,
    deleteTrancyAccount,
    listTrancyAccounts,
    readTrancyPassword,
    refreshAllTrancyAccounts,
    refreshTrancyAccount
} from "../src/trancy/store.js";
import { maskTrancyToken, normalizeTrancyToken, parseTrancyToken } from "../src/trancy/token.js";

/**
 * In-memory stand-in for the handful of D1 statements the store issues.
 * UPDATE/INSERT columns are read back out of the SQL, so the fake never needs
 * to know the binding order the store happens to use.
 */
function createFakeD1() {
    const rows = new Map();

    function selectRows(sql, params) {
        const all = Array.from(rows.values());
        if (/ORDER BY created_at/.test(sql)) {
            return all.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        }
        if (/WHERE id = \?/.test(sql)) {
            return all.filter(row => row.id === params[0]);
        }
        if (/WHERE user_id = \?/.test(sql)) {
            return all.filter(row => row.user_id === params[0] && params[0]);
        }
        if (/WHERE status = \?/.test(sql)) {
            // The candidates query binds (status, now [, now]) and may also ask
            // for `exhausted_until`; the plain picker only binds (status, now).
            const cooldownNow = String(params[1] || "");
            const exhaustedNow = String(params[2] || cooldownNow);
            const wantsExhausted = /exhausted_until/.test(sql);
            return all
                .filter(row => row.status === params[0])
                .filter(row => !row.cooldown_until || row.cooldown_until <= cooldownNow)
                .filter(row => !wantsExhausted || !row.exhausted_until || row.exhausted_until <= exhaustedNow)
                .sort((a, b) => {
                    const aUsed = a.last_used_at ? 1 : 0;
                    const bUsed = b.last_used_at ? 1 : 0;
                    if (aUsed !== bUsed) return aUsed - bUsed;
                    return String(a.last_used_at).localeCompare(String(b.last_used_at));
                });
        }
        throw new Error(`unexpected SELECT: ${sql}`);
    }

    return {
        rows,
        prepare(sql) {
            const statement = String(sql);
            return {
                _params: [],
                bind(...params) {
                    this._params = params;
                    return this;
                },
                async all() {
                    return { results: selectRows(statement, this._params).map(row => ({ ...row })) };
                },
                async first() {
                    const found = selectRows(statement, this._params);
                    return found.length ? { ...found[0] } : null;
                },
                async run() {
                    if (/^INSERT INTO trancy_account/.test(statement)) {
                        const columns = splitList(statement.match(/\(([\s\S]*?)\)\s*VALUES/)[1]);
                        const values = splitList(statement.match(/VALUES\s*\(([\s\S]*?)\)\s*(?:ON CONFLICT[\s\S]*)?$/)[1]);
                        assert.equal(columns.length, values.length, `INSERT columns/vALUES mismatch: ${statement}`);
                        const row = {};
                        let cursor = 0;
                        values.forEach((expression, index) => {
                            row[columns[index]] = expression === "?" ? this._params[cursor++] : literal(expression);
                        });
                        assert.equal(cursor, this._params.length, `INSERT ignored extra bindings: ${cursor}/${this._params.length}`);
                        rows.set(row.id, row);
                        return { success: true, meta: { changes: 1 } };
                    }

                    if (/^UPDATE trancy_account/.test(statement)) {
                        const assignments = splitList(statement.match(/SET([\s\S]*?)WHERE/)[1]);
                        const id = this._params[this._params.length - 1];
                        const row = rows.get(id);
                        assert.ok(row, `UPDATE target ${id} exists`);
                        let cursor = 0;
                        assignments.forEach(assignment => {
                            const [column, expression] = assignment.split("=").map(part => part.trim());
                            const increment = expression.match(/^(\w+) \+ 1$/);
                            if (increment) {
                                row[column] = Number(row[increment[1]] || 0) + 1;
                            } else if (expression === "?") {
                                row[column] = this._params[cursor++];
                            } else {
                                row[column] = literal(expression);
                            }
                        });
                        assert.equal(cursor, this._params.length - 1, "UPDATE consumed every binding");
                        return { success: true, meta: { changes: 1 } };
                    }

                    if (/^DELETE FROM trancy_account/.test(statement)) {
                        const removed = rows.delete(this._params[0]);
                        return { success: true, meta: { changes: removed ? 1 : 0 } };
                    }

                    throw new Error(`unexpected WRITE: ${statement}`);
                }
            };
        }
    };
}

function splitList(clause) {
    return clause.split(",").map(part => part.trim()).filter(Boolean);
}

function literal(expression) {
    const value = String(expression).trim();
    if (/^'.*'$/.test(value)) return value.slice(1, -1);
    if (/^-?\d+$/.test(value)) return Number(value);
    throw new Error(`unsupported literal in fake D1: ${value}`);
}

function makeToken({ id = "6ae7f5f37719d49380129d35", name = "acc", iat = 1793602683 } = {}) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    const header = encode({ alg: "HS256", typ: "JWT" });
    const payload = encode({ name, id, iat });
    return `${header}.${payload}.signature${iat}`;
}

/** Profile response in Trancy's shape: `data` is null when the token is dead. */
function profileReply(payload) {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}

function fakeFetch(handler) {
    const calls = [];
    const impl = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        return handler(String(url), options, calls.length);
    };
    impl.calls = calls;
    return impl;
}

const encryptionKey = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
const env = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey };

// 1. Token shapes and payload decoding.
{
    const token = makeToken({ name: "quintelliuzp111" });

    assert.equal(normalizeTrancyToken(token), token, "bare token passes through");
    assert.equal(normalizeTrancyToken(`Bearer ${token}`), token, "bearer prefix is stripped");
    assert.equal(normalizeTrancyToken(`trancy=${token}`), token, "cookie pair is unwrapped");
    assert.equal(
        normalizeTrancyToken(`_ga=GA1.1.1; trancy=${token}; trancy-theme=dark`),
        token,
        "full cookie header is parsed"
    );
    assert.equal(normalizeTrancyToken(""), "");
    assert.equal(normalizeTrancyToken("not-a-token"), "");

    const parsed = parseTrancyToken(token);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.userId, "6ae7f5f37719d49380129d35");
    assert.equal(parsed.name, "quintelliuzp111");
    assert.equal(parsed.issuedAt, new Date(1793602683 * 1000).toISOString());

    assert.equal(parseTrancyToken("a.b.c").valid, false, "non-JWT payload is rejected");
    assert.match(maskTrancyToken(token), /^••••/, "only a tail is ever exposed");
    assert.ok(!maskTrancyToken(token).includes(token.slice(0, 30)));
}

// 2. Add -> probe -> status ok, with the renewed token encrypted at rest.
{
    let issued = 1793602683;
    const fetchImpl = fakeFetch(async () => {
        issued += 1;
        return profileReply({
            data: {
                id: "6ae7f5f37719d49380129d35",
                token: makeToken({ iat: issued }),
                name: "quintelliuzp111",
                email: "quintelliuzp111@hotmail.com",
                premium: false,
                banned: false
            },
            message: "ok"
        });
    });

    const row = await addTrancyAccount(env, { token: makeToken(), fetchImpl });
    assert.equal(row.status, "ok", "a fresh account is verified at paste time");
    assert.equal(row.name, "quintelliuzp111", "the JWT name fills in until a probe supplies the email");
    assert.equal(row.email, "quintelliuzp111@hotmail.com");
    assert.ok(!String(row.token_cipher).includes("eyJ"), "the JWT is not stored in plaintext");

    const key = await importEncryptionKey(encryptionKey);
    const stored = await decryptSecret(row.token_cipher, { key, aad: `trancy:${row.id}` });
    assert.equal(stored, makeToken({ iat: issued }), "the renewed token replaced the pasted one");
    await assert.rejects(
        () => decryptSecret(row.token_cipher, { key, aad: "trancy:some-other-row" }),
        /无法解密/,
        "ciphertext is bound to its row id"
    );

    const list = await listTrancyAccounts(env);
    assert.equal(list.length, 1);
    assert.ok(!("token" in list[0]) && !("token_cipher" in list[0]), "the browser view never carries the token");
    assert.ok(list[0].tokenTail.startsWith("••••"));
    assert.equal(list[0].status, "ok");
}

// 3. The same user re-added updates the row instead of duplicating it.
{
    const fetchImpl = fakeFetch(async () => profileReply({ data: null, message: "ok" }));
    const before = (await listTrancyAccounts(env)).length;
    await addTrancyAccount(env, { token: makeToken({ iat: 1793603000 }), fetchImpl });
    const rows = await listTrancyAccounts(env);
    assert.equal(rows.length, before, "same Trancy user id keeps one row");
}

// 4. data:null means the token is gone -> dead, and the next add revives it.
{
    const id = (await listTrancyAccounts(env))[0].id;
    const deadFetch = fakeFetch(async () => profileReply({ data: null, message: "ok" }));
    const result = await refreshTrancyAccount(env, id, { fetchImpl: deadFetch });
    assert.equal(result.refreshed, false);
    assert.equal(result.reason, "dead", "200 + data:null is a rejected token, not an HTTP error");
    assert.equal(result.account.status, "dead");

    const revived = await addTrancyAccount(env, {
        token: makeToken({ iat: 1793604000 }),
        fetchImpl: fakeFetch(async () => profileReply({
            data: { id: "6ae7f5f37719d49380129d35", token: makeToken({ iat: 1793604001 }), banned: false },
            message: "ok"
        }))
    });
    assert.equal(revived.status, "ok");
    assert.equal(revived.fail_count, 0);
}

// 5. Network failures back off without killing the account.
{
    const id = (await listTrancyAccounts(env))[0].id;
    const failing = fakeFetch(async () => { throw new Error("boom"); });
    const result = await refreshTrancyAccount(env, id, { fetchImpl: failing });
    assert.equal(result.refreshed, false);
    assert.equal(result.reason, "network");
    assert.equal(result.account.status, "ok", "a network blip must not mark a token dead");
    assert.equal(result.account.failCount, 1);
    assert.ok(result.account.cooldownUntil, "backoff is recorded as a cooldown");

    // While cooling down the account is not offered to the caption scheduler...
    assert.equal((await pickCaptionAccounts(env)).length, 0);
    // ...until the cooldown is cleared.
    env.DB.rows.get(id).cooldown_until = "";
    env.DB.rows.get(id).fail_count = 0;
}

// 6. Banned accounts are recorded but never handed out.
{
    const id = (await listTrancyAccounts(env))[0].id;
    await refreshTrancyAccount(env, id, {
        fetchImpl: fakeFetch(async () => profileReply({
            data: { id: "6ae7f5f37719d49380129d35", token: makeToken({ iat: 1793605000 }), banned: true },
            message: "ok"
        }))
    });
    const list = await listTrancyAccounts(env);
    assert.equal(list[0].status, "banned");
    assert.equal((await pickCaptionAccounts(env)).length, 0, "a banned account is never handed out");

    await refreshTrancyAccount(env, id, {
        fetchImpl: fakeFetch(async () => profileReply({
            data: { id: "6ae7f5f37719d49380129d35", token: makeToken({ iat: 1793605001 }), banned: false },
            message: "ok"
        }))
    });
}

// 8. refreshAll skips dead rows and can be rate limited by age.
{
    const id = (await listTrancyAccounts(env))[0].id;
    env.DB.rows.get(id).status = "dead";

    const deadFetch = fakeFetch(async () => profileReply({ data: null, message: "ok" }));
    const result = await refreshAllTrancyAccounts(env, { fetchImpl: deadFetch });
    assert.equal(result.checked, 0, "the dead row is not probed");
    assert.equal(deadFetch.calls.length, 0, "a dead account costs no subrequest");
    assert.ok(result.skipped >= 1);

    // Revive it, then prove the age filter keeps a fresh row alone.
    env.DB.rows.get(id).status = "ok";
    env.DB.rows.get(id).last_checked_at = new Date().toISOString();
    const quiet = fakeFetch(async () => { throw new Error("should not be called"); });
    const fresh = await refreshAllTrancyAccounts(env, { minAgeMinutes: 60, fetchImpl: quiet });
    assert.equal(fresh.checked, 0, "accounts checked recently are left alone");
    assert.equal(quiet.calls.length, 0);
}

// 7. HTTP surface for account management: add/list/delete, no app-level auth.
{
    for (const row of await listTrancyAccounts(env)) {
        await deleteTrancyAccount(env, row.id);
    }
    assert.equal((await listTrancyAccounts(env)).length, 0);

    const call = (path, init = {}) => handleTrancy(new Request(`https://worker.example${path}`, init), env);
    const jsonHeaders = { "Content-Type": "application/json" };

    const badToken = await call("/api/trancy/accounts", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ token: "nope" })
    });
    assert.equal(badToken.status, 400);
    assert.equal((await badToken.json()).error.code, "invalid_token");

    const emptyList = await call("/api/trancy/accounts");
    const emptyPayload = await emptyList.json();
    assert.deepEqual(emptyPayload.accounts, []);
    assert.equal(emptyPayload.defaultDailyLimit, 5);
    assert.ok(!("writable" in emptyPayload), "authorisation lives in Cloudflare Access now");

    const unknownRoute = await call("/api/trancy/nope", { method: "POST" });
    assert.equal(unknownRoute.status, 404);
}

// 11. Login / signup through Trancy's own endpoint, and one-click re-login.
{
    const issuedFor = new Map();
    const authFetch = fakeFetch(async (url, options) => {
        const body = options.body ? JSON.parse(options.body) : {};
        if (String(url).endsWith("/1/login")) {
            if (body.password === "wrong-password") {
                // Trancy answers with 200 + code 409, never a 4xx status.
                return new Response(JSON.stringify({ code: 409, message: "Incorrect password" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }
            const userId = `user-${body.email}`;
            const token = makeToken({ id: userId, name: body.email.split("@")[0], iat: 1793609000 });
            issuedFor.set(body.email, token);
            return profileReply({
                data: { id: userId, token, name: body.email.split("@")[0], email: body.email, premium: true, banned: false },
                message: "ok"
            });
        }
        if (String(url).endsWith("/1/signup")) {
            const userId = `new-${body.email}`;
            const token = makeToken({ id: userId, name: "fresh", iat: 1793609100 });
            return profileReply({
                data: { id: userId, token, name: "fresh", email: body.email, premium: false, banned: false },
                message: "ok"
            });
        }
        if (String(url).endsWith("/1/user/profile")) {
            const auth = String(options.headers?.Authorization || "").replace("Bearer ", "");
            return profileReply({ data: { id: auth, token: auth, email: `${auth}@example.com`, banned: false }, message: "ok" });
        }
        throw new Error(`unexpected auth call: ${url}`);
    });

    const failed = await loginTrancyAccount(env, {
        email: "someone@example.com",
        password: "wrong-password",
        fetchImpl: authFetch
    });
    assert.equal(failed.ok, false, "a 200 + code 409 login failure is not mistaken for success");
    assert.equal(failed.message, "Incorrect password", "Trancy's own message is surfaced");
    assert.equal(
        (await listTrancyAccounts(env)).some(account => account.email === "someone@example.com"),
        false,
        "a rejected login writes nothing"
    );

    const loggedIn = await loginTrancyAccount(env, {
        email: "someone@example.com",
        password: "hunter2-plain",
        fetchImpl: authFetch
    });
    assert.equal(loggedIn.ok, true);
    assert.equal(loggedIn.account.status, "ok");
    assert.equal(loggedIn.account.email, "someone@example.com");

    const storedRow = Array.from(env.DB.rows.values()).find(row => row.email === "someone@example.com" && row.password_cipher);
    assert.ok(storedRow, "the password is stored encrypted");
    assert.ok(storedRow.password_cipher.startsWith("v1."), "the password uses the AES-GCM envelope");
    assert.ok(!storedRow.password_cipher.includes("hunter2"), "the plaintext password must not be in the row");
    assert.ok(!String(storedRow.token_cipher).includes("eyJ"), "the token itself stays encrypted");
    const key = await importEncryptionKey(encryptionKey);
    assert.ok(await decryptSecret(storedRow.token_cipher, { key, aad: `trancy:${storedRow.id}` }));

    const listed = await listTrancyAccounts(env);
    const listedRow = listed.find(a => a.id === storedRow.id);
    assert.equal(listedRow.hasPassword, true);
    assert.ok(!("password" in listedRow), "the list never carries the password");

    // Only the explicit reveal decrypts, and it needs the same AAD.
    const revealed = await readTrancyPassword(env, storedRow.id);
    assert.equal(revealed.ok, true);
    assert.equal(revealed.password, "hunter2-plain", "decryption round-trips through SECRETS_ENCRYPTION_KEY");

    const wrongKeyEnv = { DB: env.DB, SECRETS_ENCRYPTION_KEY: bytesToBase64(crypto.getRandomValues(new Uint8Array(32))) };
    const unreadable = await readTrancyPassword(wrongKeyEnv, storedRow.id);
    assert.equal(unreadable.ok, false);
    assert.equal(unreadable.reason, "password_unreadable", "a rotated key surfaces as unreadable, not as garbage");

    // A dead token with a stored password comes back with one click.
    env.DB.rows.get(storedRow.id).status = "dead";
    const relogged = await reloginTrancyAccount(env, storedRow.id, { fetchImpl: authFetch });
    assert.equal(relogged.ok, true, "re-login revives the account");
    assert.equal(relogged.account.status, "ok");

    // Accounts added by pasting a token have no password and say so.
    const tokenOnlyRow = await addTrancyAccount(env, {
        token: makeToken({ id: "token-only-user", iat: 1793625000 }),
        fetchImpl: fakeFetch(async () => profileReply({
            data: { id: "token-only-user", token: "", banned: false },
            message: "ok"
        }))
    });
    assert.ok(tokenOnlyRow, "the token-only account exists");
    assert.ok(!tokenOnlyRow.password_cipher, "a token-only row never gets a password");
    const noCreds = await reloginTrancyAccount(env, tokenOnlyRow.id, { fetchImpl: authFetch });
    assert.equal(noCreds.ok, false);
    assert.equal(noCreds.reason, "no_credentials");
    assert.match(noCreds.message, /粘贴 token/);

    const missingRow = await reloginTrancyAccount(env, "does-not-exist", { fetchImpl: authFetch });
    assert.equal(missingRow.reason, "not_found");

    // Signup path stores the new account and its password.
    const signedUp = await loginTrancyAccount(env, {
        email: "brand-new@example.com",
        password: "secret-123456",
        mode: "signup",
        fetchImpl: authFetch
    });
    assert.equal(signedUp.ok, true);
    assert.ok(Array.from(env.DB.rows.values()).some(row => String(row.password_cipher || "").startsWith("v1.")));
}

// 12. HTTP surface for the credential routes.
{
    const call = (path, init = {}) => handleTrancy(new Request(`https://worker.example${path}`, init), env);
    const adminHeaders = { "Content-Type": "application/json" };

    const missing = await call("/api/trancy/accounts/login", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ email: "x@example.com" })
    });
    assert.equal(missing.status, 400);
    assert.equal((await missing.json()).error.code, "missing_credentials");

    const listed = await call("/api/trancy/accounts");
    const listedPayload = await listed.json();
    assert.ok(
        listedPayload.accounts.some(account => account.hasPassword),
        "the list says a password exists without carrying it"
    );
    assert.ok(
        listedPayload.accounts.every(account => !("password" in account)),
        "no plaintext password in the list response"
    );

    // POST /api/trancy/accounts/:id/login must be routed, not swallowed by the
    // generic ":id" branch (that regression shipped once).
    {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = fakeFetch(async (url, options) => {
            if (String(url).endsWith("/1/login")) {
                const body = JSON.parse(options.body);
                return profileReply({
                    data: { id: "user-relogin", token: makeToken({ id: "user-relogin", iat: 1793610000 }), email: body.email, banned: false },
                    message: "ok"
                });
            }
            throw new Error(`unexpected call ${url}`);
        });
        try {
            const target = (await listTrancyAccounts(env)).find(account => account.hasPassword);
            assert.ok(target, "a password-backed account exists");
            const reloginResponse = await call(`/api/trancy/accounts/${target.id}/login`, {
                method: "POST",
                headers: adminHeaders
            });
            const reloginPayload = await reloginResponse.json();
            assert.equal(reloginResponse.status, 200, `/:id/login is routed (got ${JSON.stringify(reloginPayload)})`);
            assert.equal(reloginPayload.account.status, "ok");

            const tokenOnly = Array.from(env.DB.rows.values()).find(row => !row.password_cipher);
            assert.ok(tokenOnly, "a token-only row exists");
            const noCredsResponse = await call(`/api/trancy/accounts/${tokenOnly.id}/login`, {
                method: "POST",
                headers: adminHeaders
            });
            assert.equal(noCredsResponse.status, 409);
            assert.equal((await noCredsResponse.json()).error.code, "trancy_no_credentials");
        } finally {
            globalThis.fetch = originalFetch;
        }
    }

}

// 13. YouTube captions: quota-aware scheduling, nothing stored.
{
    for (const row of Array.from(env.DB.rows.values())) env.DB.rows.delete(row.id);
    const profileOk = fakeFetch(async (url, options) => {
        const auth = String(options.headers?.Authorization || "").replace("Bearer ", "");
        const payload = JSON.parse(Buffer.from(auth.split(".")[1], "base64url").toString());
        return profileReply({
            data: { id: payload.id, token: auth, email: `${payload.id}@example.com`, banned: false },
            message: "ok"
        });
    });
    await addTrancyAccount(env, { token: makeToken({ id: "acct-one", name: "one", iat: 1793620000 }), fetchImpl: profileOk });
    await addTrancyAccount(env, { token: makeToken({ id: "acct-two", name: "two", iat: 1793620001 }), fetchImpl: profileOk });
    for (const row of env.DB.rows.values()) {
        row.last_used_at = "";
    }

    assert.ok(normalizeCaptionRequest({ videoId: "" }).error);
    assert.ok(normalizeCaptionRequest({ videoId: "abc" }).error, "short ids are rejected");
    assert.ok(normalizeCaptionRequest({ videoId: "npka43vhwNo", target: "not a lang" }).error);
    assert.equal(normalizeCaptionRequest({ videoId: "npka43vhwNo" }).target, "en", "target defaults to en");
    assert.equal(normalizeCaptionRequest({ videoId: "npka43vhwNo", target: "zh-CN" }).error, null);

    const captionCalls = [];
    const captionFetch = fakeFetch(async (url) => {
        captionCalls.push(String(url));
        return new Response(JSON.stringify({
            data: [
                { start: 189, end: 649, text: "Hi, Neil.", sid: "youtube:npka43vhwNo:189:649" },
                { start: 809, end: 1329, text: "Hi, Georgie.", sid: "youtube:npka43vhwNo:809:1329" }
            ]
        }), {
            status: 200,
            headers: { "Content-Type": "application/json", "x-quota-limit": "5", "x-quota-remaining": "3" }
        });
    });

    const first = await requestYoutubeCaptions(env, { videoId: "npka43vhwNo", target: "en", fetchImpl: captionFetch });
    assert.equal(first.ok, true);
    assert.equal(first.sentenceCount, 2);
    assert.equal(first.quota.limit, 5);
    assert.equal(first.quota.remaining, 3, "quota headers are persisted for the scheduler");
    assert.ok(!("cached" in first) && !("pending" in first), "the gateway stores nothing and asks nobody to poll");
    assert.equal(captionCalls.length, 1);
    const charged = Array.from(env.DB.rows.values()).find(row => row.id === first.account.id);
    assert.equal(charged.day_used, 1, "the call is booked against the day");
    assert.equal(charged.quota_remaining, 3);

    // Same video again: a second generation, because no transcript is kept.
    const again = await requestYoutubeCaptions(env, { videoId: "npka43vhwNo", target: "en", fetchImpl: captionFetch });
    assert.equal(again.ok, true);
    assert.equal(captionCalls.length, 2, "a repeat goes upstream again");

    // A third account, so the failover below has to walk past two refusals.
    await addTrancyAccount(env, { token: makeToken({ id: "acct-three", name: "three", iat: 1793620002 }), fetchImpl: profileOk });

    // Trancy says the daily limit is gone: park those accounts, not the pool.
    let limitCalls = 0;
    const limitFetch = fakeFetch(async () => {
        limitCalls += 1;
        if (limitCalls <= 2) {
            return new Response(JSON.stringify({ code: 403, message: "You've reached the daily limit of 5 AI subtitles for free users. Upgrade to premium for unlimited access." }), {
                status: 200,
                headers: { "Content-Type": "application/json", "x-quota-limit": "5", "x-quota-remaining": "0" }
            });
        }
        return new Response(JSON.stringify({ data: [{ start: 0, end: 500, text: "ok" }] }), {
            status: 200,
            headers: { "Content-Type": "application/json", "x-quota-limit": "5", "x-quota-remaining": "2" }
        });
    });

    const failover = await requestYoutubeCaptions(env, { videoId: "anotherVideoId", target: "en", fetchImpl: limitFetch });
    assert.equal(failover.ok, true, "two exhausted accounts later, the third one still answers");
    assert.equal(limitCalls, 3, "the scheduler walks the candidate list, not just one retry");
    const parked = Array.from(env.DB.rows.values()).filter(row => row.exhausted_until);
    assert.equal(parked.length, 2, "each refusing account is parked until the next UTC day");
    assert.match(parked[0].exhausted_until, /T00:00:00\.000Z$/, "the reset is the next UTC midnight");
    assert.equal(parked[0].status, "ok", "an exhausted account keeps its status and token");

    // Everything exhausted -> 503 shaped answer, never a fake success.
    for (const row of env.DB.rows.values()) {
        row.exhausted_until = new Date(Date.now() + 3600_000).toISOString();
    }
    const noneLeft = await requestYoutubeCaptions(env, { videoId: "yetAnotherVideo", target: "en", fetchImpl: captionFetch });
    assert.equal(noneLeft.ok, false);
    assert.equal(noneLeft.reason, "no_caption_quota");
    assert.ok(noneLeft.resetAt);
}

// 14. Caption HTTP surface: one POST, videoId is enough, nothing to poll.
{
    const call = (path, init = {}) => handleTrancy(new Request(`https://worker.example${path}`, init), env);

    for (const row of env.DB.rows.values()) {
        row.exhausted_until = "";
        row.cooldown_until = "";
        row.day_used = 0;
        row.day_used_date = "";
        row.status = "ok";
    }

    const badVideo = await call("/api/trancy/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: "../../etc/passwd" })
    });
    assert.equal(badVideo.status, 400);
    assert.equal((await badVideo.json()).error.code, "invalid_caption_request");

    const okFetch = fakeFetch(async () => new Response(JSON.stringify({ data: [{ start: 0, end: 400, text: "hi" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json", "x-quota-limit": "5", "x-quota-remaining": "4" }
    }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = okFetch;
    try {
        const response = await call("/api/trancy/captions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId: "npka43vhwNo" })
        });
        assert.equal(response.status, 200, "videoId alone is a valid request");
        const payload = await response.json();
        assert.equal(payload.target, "en", "target defaults to en");
        assert.equal(payload.sentenceCount, 1);
        assert.equal(response.headers.get("X-Quota-Remaining"), "4");
        assert.ok(!("cached" in payload) && !("pending" in payload), "no cache, no polling");

        const noGet = await call("/api/trancy/captions/npka43vhwNo");
        assert.equal(noGet.status, 404, "there is no cache-reading GET any more");

        // POOL_EXHAUSTED still answers 503 with a reset time.
        for (const row of env.DB.rows.values()) {
            row.exhausted_until = new Date(Date.now() + 3600_000).toISOString();
        }
        const exhausted = await call("/api/trancy/captions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId: "brandNewVideo" })
        });
        assert.equal(exhausted.status, 503);
        const exhaustedPayload = await exhausted.json();
        assert.equal(exhaustedPayload.error.code, "no_caption_quota");
        assert.ok(exhaustedPayload.resetAt);
    } finally {
        globalThis.fetch = originalFetch;
    }
}

console.log("Verified the Trancy multi-account gateway: token parsing, encrypted storage, LRU rotation, dead-token retirement, cron refresh and the caption quota scheduler.");
