import assert from "node:assert/strict";
import { bytesToBase64, importEncryptionKey, decryptSecret } from "../src/secrets/crypto.js";
import { handleTrancy } from "../src/routes/trancy.js";
import {
    addTrancyAccount,
    loginTrancyAccount,
    reloginTrancyAccount,
    deleteTrancyAccount,
    listTrancyAccounts,
    pickTrancyAccount,
    recordTrancyUsage,
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
            const now = String(params[1] || "");
            return all
                .filter(row => row.status === params[0] && (!row.cooldown_until || row.cooldown_until <= now))
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
                        const values = splitList(statement.match(/VALUES\s*\(([\s\S]*)\)\s*$/)[1]);
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
const env = { DB: createFakeD1(), SECRETS_ENCRYPTION_KEY: encryptionKey, ADMIN_TOKEN: "admin-secret-token" };

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

    // While cooling down the account is not selectable...
    assert.equal(await pickTrancyAccount(env), null);
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
    assert.equal(await pickTrancyAccount(env), null, "a banned account is not usable");

    await refreshTrancyAccount(env, id, {
        fetchImpl: fakeFetch(async () => profileReply({
            data: { id: "6ae7f5f37719d49380129d35", token: makeToken({ iat: 1793605001 }), banned: false },
            message: "ok"
        }))
    });
}

// 7. Rotation is least-recently-used.
{
    const second = await addTrancyAccount(env, {
        token: makeToken({ id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "second", iat: 1793606000 }),
        fetchImpl: fakeFetch(async () => profileReply({
            data: { id: "bbbbbbbbbbbbbbbbbbbbbbbb", token: makeToken({ id: "bbbbbbbbbbbbbbbbbbbbbbbb", iat: 1793606001 }), banned: false },
            message: "ok"
        }))
    });
    assert.equal((await listTrancyAccounts(env)).length, 2);

    const first = await pickTrancyAccount(env);
    assert.ok(first, "an account is available");
    const firstId = first.id;
    await recordTrancyUsage(env, firstId, { ok: true });

    const next = await pickTrancyAccount(env);
    assert.notEqual(next.id, firstId, "the other account is preferred");
    await recordTrancyUsage(env, next.id, { ok: true });

    const third = await pickTrancyAccount(env);
    assert.equal(third.id, firstId, "rotation comes back around");
    assert.ok(second);
}

// 8. refreshAll skips dead rows and can be rate limited by age.
{
    const id = (await listTrancyAccounts(env))[0].id;
    env.DB.rows.get(id).status = "dead";

    const fetchImpl = fakeFetch(async () => profileReply({ data: null, message: "ok" }));
    const result = await refreshAllTrancyAccounts(env, { fetchImpl });
    assert.equal(result.checked, 1, "the dead row is not probed");
    assert.ok(result.skipped >= 1);

    const quiet = fakeFetch(async () => { throw new Error("should not be called"); });
    const fresh = await refreshAllTrancyAccounts(env, { minAgeMinutes: 60, fetchImpl: quiet });
    assert.equal(fresh.checked, 0, "accounts checked recently are left alone");
    assert.equal(quiet.calls.length, 0);
}

// 9. HTTP surface: auth guard, add/list/refresh/delete, relay rotation.
{
    await deleteTrancyAccount(env, (await listTrancyAccounts(env))[0].id);
    for (const row of await listTrancyAccounts(env)) {
        await deleteTrancyAccount(env, row.id);
    }
    assert.equal((await listTrancyAccounts(env)).length, 0);

    const call = (path, init = {}) => handleTrancy(new Request(`https://worker.example${path}`, init), env);
    const adminHeaders = { Authorization: "Bearer admin-secret-token", "Content-Type": "application/json" };

    const unauthorised = await call("/api/trancy/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: makeToken() })
    });
    assert.equal(unauthorised.status, 401, "adding an account requires the admin token");
    assert.equal((await unauthorised.json()).error.code, "invalid_admin_token");

    const badToken = await call("/api/trancy/accounts", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ token: "nope" })
    });
    assert.equal(badToken.status, 400);
    assert.equal((await badToken.json()).error.code, "invalid_token");

    const relayLocked = await call("/api/trancy/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/1/user/profile" })
    });
    assert.equal(relayLocked.status, 401, "the relay is never open");

    const badPath = await call("/api/trancy/relay", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ path: "https://evil.example/steal" })
    });
    assert.equal(badPath.status, 400);
    assert.equal((await badPath.json()).error.code, "invalid_relay_path");

    const relayWithoutAccounts = await call("/api/trancy/relay", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ path: "/1/user/profile" })
    });
    assert.equal(relayWithoutAccounts.status, 503);
    assert.equal((await relayWithoutAccounts.json()).error.code, "no_trancy_account");

    const emptyList = await call("/api/trancy/accounts");
    const emptyPayload = await emptyList.json();
    assert.deepEqual(emptyPayload.accounts, []);
    assert.equal(emptyPayload.writable, true);
}

// 10. Relay hands out pooled tokens; a token that dies mid-flight is retired
//     and the same request is retried on the next account.
{
    const tokenA = makeToken({ id: "aaaaaaaaaaaaaaaaaaaaaaaa", iat: 1793607000 });
    const tokenB = makeToken({ id: "bbbbbbbbbbbbbbbbbbbbbb", iat: 1793607100 });
    let retiredA = false;
    const originalFetch = globalThis.fetch;

    // The real profile answers with the mongo id, never with the token: keep the
    // fake honest, otherwise user_id silently becomes the credential.
    const userIdOf = auth => auth === tokenA ? "aaaaaaaaaaaaaaaaaaaaaaaa" : "bbbbbbbbbbbbbbbbbbbbbb";

    globalThis.fetch = async (url, options = {}) => {
        const auth = String(options.headers?.Authorization || "").replace("Bearer ", "");
        if (String(url).includes("/1/user/profile")) {
            if (auth === tokenA && retiredA) {
                return profileReply({ data: null, message: "ok" });
            }
            return profileReply({ data: { id: userIdOf(auth), token: auth, email: `${userIdOf(auth)}@example.com`, banned: false }, message: "ok" });
        }
        if (auth === tokenA) {
            retiredA = true;
            return profileReply({ data: null, message: "ok" });
        }
        return new Response(JSON.stringify({ data: { ok: true }, message: "ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-Quota-Limit": "200", "X-Quota-Remaining": "37" }
        });
    };

    try {
        const poolA = await addTrancyAccount(env, { token: tokenA });
        const poolB = await addTrancyAccount(env, { token: tokenB });
        for (const row of env.DB.rows.values()) {
            row.last_used_at = "";
        }

        const response = await handleTrancy(new Request("https://worker.example/api/trancy/relay", {
            method: "POST",
            headers: { Authorization: "Bearer admin-secret-token", "Content-Type": "application/json" },
            body: JSON.stringify({ method: "GET", path: "/2/dictionary?text=hello&target=zh-CN" })
        }), env);

        assert.equal(response.status, 200, "the request is retried on another account");
        assert.equal(response.headers.get("X-Quota-Remaining"), "37", "quota headers are exposed to the caller");
        assert.equal(response.headers.get("X-Trancy-Account"), poolB.id, "the healthy account served the request");
        assert.ok(response.headers.has("X-Trancy-Email"), "the serving account also reports its email header");
        assert.deepEqual(await response.json(), { data: { ok: true }, message: "ok" });

        const after = await listTrancyAccounts(env);
        const a = after.find(account => account.id === poolA.id);
        const b = after.find(account => account.id === poolB.id);
        assert.equal(a.status, "dead", "the rejected account is retired so it is never picked again");
        assert.equal(b.useCount, 1, "the retry is booked against the account that answered");
        assert.equal(await pickTrancyAccount(env).then(picked => picked.id), b.id, "only the healthy account remains");
    } finally {
        globalThis.fetch = originalFetch;
    }
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

    const storedRow = Array.from(env.DB.rows.values()).find(row => row.email === "someone@example.com" && row.password);
    assert.equal(storedRow.password, "hunter2-plain", "the password is stored as-is");
    assert.ok(!String(storedRow.token_cipher).includes("eyJ"), "the token itself stays encrypted");
    const key = await importEncryptionKey(encryptionKey);
    assert.ok(await decryptSecret(storedRow.token_cipher, { key, aad: `trancy:${storedRow.id}` }));

    const withPasswords = await listTrancyAccounts(env, { includePasswords: true });
    const withoutPasswords = await listTrancyAccounts(env);
    assert.equal(withPasswords.find(a => a.id === storedRow.id).password, "hunter2-plain");
    assert.equal(withoutPasswords.find(a => a.id === storedRow.id).password, "", "default view hides it");
    assert.equal(withoutPasswords.find(a => a.id === storedRow.id).hasPassword, true);

    // A dead token with a stored password comes back with one click.
    env.DB.rows.get(storedRow.id).status = "dead";
    const relogged = await reloginTrancyAccount(env, storedRow.id, { fetchImpl: authFetch });
    assert.equal(relogged.ok, true, "re-login revives the account");
    assert.equal(relogged.account.status, "ok");

    // Accounts added by pasting a token have no password and say so.
    const tokenOnlyRow = Array.from(env.DB.rows.values()).find(row => !row.password && row.user_id === "aaaaaaaaaaaaaaaaaaaaaaaa");
    assert.ok(tokenOnlyRow, "the token-only account from the relay test is still there");
    assert.equal(tokenOnlyRow.password, undefined, "a token-only row never gets a password");
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
    assert.ok(Array.from(env.DB.rows.values()).some(row => row.password === "secret-123456"));
}

// 12. HTTP surface for the credential routes and the password gate.
{
    const call = (path, init = {}) => handleTrancy(new Request(`https://worker.example${path}`, init), env);
    const adminHeaders = { Authorization: "Bearer admin-secret-token", "Content-Type": "application/json" };

    const unauthorised = await call("/api/trancy/accounts/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "x@example.com", password: "y" })
    });
    assert.equal(unauthorised.status, 401, "logging in is a write");

    const missing = await call("/api/trancy/accounts/login", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ email: "x@example.com" })
    });
    assert.equal(missing.status, 400);
    assert.equal((await missing.json()).error.code, "missing_credentials");

    const logged = await call("/api/trancy/accounts", { headers: adminHeaders });
    const loggedPayload = await logged.json();
    assert.equal(loggedPayload.passwordsVisible, true, "the write guard unlocks the plaintext passwords");

    const anonymous = await call("/api/trancy/accounts");
    const anonymousPayload = await anonymous.json();
    assert.equal(anonymousPayload.passwordsVisible, false);
    assert.ok(anonymousPayload.accounts.every(account => account.password === ""));
    assert.ok(anonymousPayload.accounts.some(account => account.hasPassword));

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
            const target = (await listTrancyAccounts(env, { includePasswords: true })).find(account => account.password);
            assert.ok(target, "a password-backed account exists");
            const reloginResponse = await call(`/api/trancy/accounts/${target.id}/login`, {
                method: "POST",
                headers: adminHeaders
            });
            const reloginPayload = await reloginResponse.json();
            assert.equal(reloginResponse.status, 200, `/:id/login is routed (got ${JSON.stringify(reloginPayload)})`);
            assert.equal(reloginPayload.account.status, "ok");

            const tokenOnly = Array.from(env.DB.rows.values()).find(row => !row.password);
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

    const lockedEnv = { DB: env.DB, SECRETS_ENCRYPTION_KEY: encryptionKey };
    const locked = await handleTrancy(new Request("https://worker.example/api/trancy/accounts"), lockedEnv);
    const lockedPayload = await locked.json();
    assert.equal(lockedPayload.writable, false);
    assert.equal(lockedPayload.passwordsVisible, false, "a locked deployment never echoes passwords");
}

console.log("Verified the Trancy multi-account gateway: token parsing, encrypted storage, LRU rotation, dead-token retirement, cron refresh and the guarded relay endpoint.");
