/**
 * Trancy account store.
 *
 * One row per account in `trancy_account`; the JWT is encrypted with the same
 * AES-256-GCM envelope as provider API keys (`src/secrets/crypto.js`) using
 * `trancy:<row id>` as additional authenticated data, so a ciphertext moved
 * between rows fails to decrypt.
 *
 * Rotation rule: `pick` returns the usable account that was used least
 * recently, so consecutive calls spread across accounts and a single account
 * is not burned first. Accounts that Trancy rejected (`status = 'dead'`) are
 * never picked again until a human pastes a fresh token.
 *
 * Why the credential is a bare token and why probing `/1/user/profile` is the
 * renewal: .agents/notes/implemented/feature/2026-11-02-trancy-account-gateway.md
 */

import { decryptSecret, encryptSecret, importEncryptionKey } from "../secrets/crypto.js";
import { fetchTrancyProfile, loginTrancyCredentials, signupTrancyCredentials } from "./api.js";
import { maskTrancyToken, normalizeTrancyToken, parseTrancyToken } from "./token.js";

export const TRANCY_STATUS = {
    new: "new",
    ok: "ok",
    banned: "banned",
    dead: "dead"
};

const SELECT_COLUMNS = `id, token_cipher, password, user_id, name, email, premium, banned,
    status, token_issued_at, last_checked_at, last_used_at, use_count, fail_count, cooldown_until,
    created_at, updated_at`;

function hasDatabase(env) {
    return Boolean(env && env.DB && typeof env.DB.prepare === "function");
}

function requireDatabase(env) {
    if (!hasDatabase(env)) {
        throw new Error("D1 binding DB 未配置，无法读写 Trancy 账号");
    }
    return env.DB;
}

function aadFor(id) {
    return `trancy:${id}`;
}

function nowIso() {
    return new Date().toISOString();
}

async function encryptToken(env, id, token) {
    const key = await importEncryptionKey(env?.SECRETS_ENCRYPTION_KEY);
    return encryptSecret(token, { key, aad: aadFor(id) });
}

async function decryptToken(env, row) {
    const cipher = String(row?.token_cipher || "");
    if (!cipher) {
        return { token: "", error: "没有保存 token" };
    }
    try {
        const key = await importEncryptionKey(env?.SECRETS_ENCRYPTION_KEY);
        return { token: await decryptSecret(cipher, { key, aad: aadFor(row.id) }), error: null };
    } catch (error) {
        return { token: "", error: error instanceof Error ? error.message : String(error) };
    }
}

function isoFromRow(value) {
    return String(value || "");
}

/**
 * Browser-safe projection. The token never leaves the Worker: the view carries
 * only a tail so the operator can tell which account is stored.
 */
export function accountView(row, { tokenTail = "", tokenError = null, includePassword = false } = {}) {
    return {
        id: String(row?.id || ""),
        userId: String(row?.user_id || ""),
        name: String(row?.name || ""),
        email: String(row?.email || ""),
        // Plaintext by design (see migrations/0006): it powers the one-click
        // re-login. Only surfaced to callers that already hold write access.
        password: includePassword ? String(row?.password || "") : "",
        hasPassword: Boolean(row?.password),
        premium: Boolean(row?.premium),
        banned: Boolean(row?.banned),
        status: String(row?.status || TRANCY_STATUS.new),
        tokenTail,
        tokenError,
        tokenIssuedAt: isoFromRow(row?.token_issued_at),
        lastCheckedAt: isoFromRow(row?.last_checked_at),
        lastUsedAt: isoFromRow(row?.last_used_at),
        useCount: Number(row?.use_count || 0),
        failCount: Number(row?.fail_count || 0),
        cooldownUntil: isoFromRow(row?.cooldown_until),
        createdAt: isoFromRow(row?.created_at),
        updatedAt: isoFromRow(row?.updated_at)
    };
}

async function readRows(env) {
    const { results } = await requireDatabase(env)
        .prepare(`SELECT ${SELECT_COLUMNS} FROM trancy_account ORDER BY created_at ASC`)
        .all();
    return results || [];
}

async function readRow(env, id) {
    const row = await requireDatabase(env)
        .prepare(`SELECT ${SELECT_COLUMNS} FROM trancy_account WHERE id = ?`)
        .bind(id)
        .first();
    return row || null;
}

async function readRowByUserId(env, userId) {
    if (!userId) {
        return null;
    }
    const row = await requireDatabase(env)
        .prepare(`SELECT ${SELECT_COLUMNS} FROM trancy_account WHERE user_id = ?`)
        .bind(userId)
        .first();
    return row || null;
}

/**
 * Every account, browser-safe, oldest first.
 *
 * `includePasswords` is decided by the route from the write guard, not from the
 * caller's wish: a locked deployment gets `password: ""` and `hasPassword` only.
 */
export async function listTrancyAccounts(env, { includePasswords = false } = {}) {
    const rows = await readRows(env);
    const accounts = [];
    for (const row of rows) {
        const { token, error } = await decryptToken(env, row);
        accounts.push(accountView(row, {
            tokenTail: maskTrancyToken(token),
            tokenError: token ? null : error,
            includePassword: includePasswords
        }));
    }
    return accounts;
}

export async function addTrancyAccount(env, { token, fetchImpl = fetch } = {}) {
    const parsed = parseTrancyToken(token);
    if (!parsed.valid) {
        throw new Error(parsed.error || "token 无效");
    }

    const db = requireDatabase(env);
    const existing = await readRowByUserId(env, parsed.userId);
    const timestamp = nowIso();
    const id = existing?.id || crypto.randomUUID();
    const cipher = await encryptToken(env, id, parsed.token);

    if (existing) {
        // Re-pasting a token for a known account rotates the credential in
        // place and revives it, instead of creating a duplicate row.
        await db
            .prepare(
                `UPDATE trancy_account SET
                     token_cipher = ?, name = ?, status = ?, banned = 0,
                     token_issued_at = ?, fail_count = 0, cooldown_until = '', updated_at = ?
                 WHERE id = ?`
            )
            .bind(
                cipher,
                parsed.name || existing.name || "",
                TRANCY_STATUS.new,
                parsed.issuedAt,
                timestamp,
                id
            )
            .run();
    } else {
        await db
            .prepare(
                `INSERT INTO trancy_account
                     (id, token_cipher, user_id, name, email, premium, banned, status,
                      token_issued_at, last_checked_at, last_used_at, use_count, fail_count,
                      cooldown_until, created_at, updated_at)
                 VALUES (?, ?, ?, ?, '', 0, 0, ?, ?, '', '', 0, 0, '', ?, ?)`
            )
            .bind(
                id,
                cipher,
                parsed.userId,
                parsed.name,
                TRANCY_STATUS.new,
                parsed.issuedAt,
                timestamp,
                timestamp
            )
            .run();
    }

    // Probe straight away: a freshly pasted token usually works, and finding
    // out at paste time is better than at the first relay. A failure here is
    // not fatal - the credential is already stored and the cron will retry.
    await refreshTrancyAccount(env, id, { fetchImpl }).catch(() => null);

    return (await readRow(env, id)) || null;
}

export async function deleteTrancyAccount(env, id) {
    const result = await requireDatabase(env)
        .prepare("DELETE FROM trancy_account WHERE id = ?")
        .bind(String(id || ""))
        .run();
    return Boolean(result?.meta?.changes ?? result?.changes ?? 0);
}

async function saveRefreshResult(env, id, { token, profile, status, failCount, cooldownUntil, checkedAt }) {
    const cipher = token ? await encryptToken(env, id, token) : null;
    const sets = [
        "status = ?",
        "last_checked_at = ?",
        "fail_count = ?",
        "cooldown_until = ?",
        "updated_at = ?"
    ];
    const params = [status, checkedAt, failCount, cooldownUntil, checkedAt];

    if (cipher) {
        sets.push(
            "token_cipher = ?",
            "user_id = ?",
            "name = ?",
            "email = ?",
            "premium = ?",
            "banned = ?",
            "token_issued_at = ?"
        );
        params.push(
            cipher,
            profile.userId,
            profile.name,
            profile.email,
            profile.premium ? 1 : 0,
            profile.banned ? 1 : 0,
            String(profile.issuedAt || "")
        );
    }

    params.push(id);
    await requireDatabase(env)
        .prepare(`UPDATE trancy_account SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...params)
        .run();
}

/**
 * Probe one account and persist the outcome.
 *
 * - `ok`: token renewed, status ok/banned per the profile flag.
 * - `token_invalid`: Trancy said no -> status dead, needs a human.
 * - anything else (network, 5xx): keep the status, count the failure, and back
 *   off so the cron does not hammer a broken account.
 */
export async function refreshTrancyAccount(env, id, { fetchImpl = fetch } = {}) {
    const row = await readRow(env, id);
    if (!row) {
        return { refreshed: false, reason: "not_found", account: null };
    }

    const { token, error } = await decryptToken(env, row);
    const checkedAt = nowIso();

    if (!token) {
        await saveRefreshResult(env, row.id, {
            token: "",
            profile: null,
            status: TRANCY_STATUS.dead,
            failCount: Number(row.fail_count || 0) + 1,
            cooldownUntil: "",
            checkedAt
        });
        return {
            refreshed: false,
            reason: "token_unreadable",
            error,
            account: accountView({ ...row, status: TRANCY_STATUS.dead }, { tokenError: error })
        };
    }

    const result = await fetchTrancyProfile(token, { fetchImpl });

    if (result.ok) {
        const parsed = parseTrancyToken(result.token);
        await saveRefreshResult(env, row.id, {
            token: result.token,
            profile: { ...result.profile, issuedAt: parsed.issuedAt },
            status: result.profile.banned ? TRANCY_STATUS.banned : TRANCY_STATUS.ok,
            failCount: 0,
            cooldownUntil: "",
            checkedAt
        });
        const updated = await readRow(env, row.id);
        return {
            refreshed: true,
            reason: result.profile.banned ? "banned" : "ok",
            account: accountView(updated, { tokenTail: maskTrancyToken(result.token) })
        };
    }

    if (result.reason === "token_invalid") {
        await saveRefreshResult(env, row.id, {
            token: "",
            profile: null,
            status: TRANCY_STATUS.dead,
            failCount: Number(row.fail_count || 0) + 1,
            cooldownUntil: "",
            checkedAt
        });
        const updated = await readRow(env, row.id);
        return {
            refreshed: false,
            reason: TRANCY_STATUS.dead,
            account: accountView(updated, { tokenTail: maskTrancyToken(token) })
        };
    }

    const failCount = Number(row.fail_count || 0) + 1;
    const backoffMinutes = Math.min(2 ** Math.min(failCount, 5), 60);
    const cooldownUntil = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
    await saveRefreshResult(env, row.id, {
        token: "",
        profile: null,
        status: String(row.status || TRANCY_STATUS.new),
        failCount,
        cooldownUntil,
        checkedAt
    });
    const updated = await readRow(env, row.id);
    return {
        refreshed: false,
        reason: result.reason,
        error: result.error,
        account: accountView(updated, { tokenTail: maskTrancyToken(token) })
    };
}

/**
 * Persist the result of a login/signup call: token cipher plus the plaintext
 * password that makes the next re-login possible.
 */
async function saveCredentialLogin(env, { email = "", password = "", token, profile }) {
    const parsed = parseTrancyToken(token);
    if (!parsed.valid) {
        throw new Error(parsed.error || "Trancy 返回的 token 无法解析");
    }

    const db = requireDatabase(env);
    const existing = await readRowByUserId(env, parsed.userId || profile.userId);
    const timestamp = nowIso();
    const id = existing?.id || crypto.randomUUID();
    const cipher = await encryptToken(env, id, parsed.token);
    const status = profile.banned ? TRANCY_STATUS.banned : TRANCY_STATUS.ok;
    const loginEmail = String(email || profile.email || "").trim();
    const secret = String(password || "");

    if (existing) {
        await db
            .prepare(
                `UPDATE trancy_account SET
                     token_cipher = ?, password = ?, user_id = ?, name = ?, email = ?,
                     premium = ?, banned = ?, status = ?, token_issued_at = ?, last_checked_at = ?,
                     fail_count = 0, cooldown_until = '', updated_at = ?
                 WHERE id = ?`
            )
            .bind(
                cipher,
                secret || String(existing.password || ""),
                parsed.userId || existing.user_id || "",
                profile.name || existing.name || "",
                loginEmail || existing.email || "",
                profile.premium ? 1 : 0,
                profile.banned ? 1 : 0,
                status,
                parsed.issuedAt,
                timestamp,
                timestamp,
                id
            )
            .run();
    } else {
        await db
            .prepare(
                `INSERT INTO trancy_account
                     (id, token_cipher, password, user_id, name, email, premium, banned, status,
                      token_issued_at, last_checked_at, last_used_at, use_count, fail_count,
                      cooldown_until, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, 0, '', ?, ?)`
            )
            .bind(
                id,
                cipher,
                secret,
                parsed.userId || profile.userId,
                profile.name,
                loginEmail,
                profile.premium ? 1 : 0,
                profile.banned ? 1 : 0,
                status,
                parsed.issuedAt,
                timestamp,
                timestamp,
                timestamp
            )
            .run();
    }

    return (await readRow(env, id)) || null;
}

/**
 * Add an account by logging in with its email and password.
 *
 * `mode` picks `POST /1/login` or `POST /1/signup`; both hand back a token in
 * the same response, so this is one subrequest instead of "write the row, then
 * probe it". Failure messages are Trancy's own ("Incorrect password",
 * "email: Invalid email; ..."), which is what the panel shows back.
 */
export async function loginTrancyAccount(env, { email = "", password = "", mode = "login", fetchImpl = fetch } = {}) {
    const credentials = { email, password };
    const result = mode === "signup"
        ? await signupTrancyCredentials(credentials, { fetchImpl })
        : await loginTrancyCredentials(credentials, { fetchImpl });

    if (!result.ok) {
        return { ok: false, reason: result.reason, message: result.message, account: null };
    }

    const row = await saveCredentialLogin(env, {
        email: credentials.email,
        password: credentials.password,
        token: result.token,
        profile: result.profile
    });

    // Read the row back through the list projection so the caller gets the same
    // shape as every other endpoint (tail, masked view, timestamps).
    const { token } = await decryptToken(env, row);
    return {
        ok: true,
        reason: null,
        message: "ok",
        account: accountView(row, { tokenTail: maskTrancyToken(token), includePassword: false })
    };
}

/**
 * One-click re-login for an account whose token died but whose password is
 * still stored. This is the recovery path `dead` accounts point at.
 */
export async function reloginTrancyAccount(env, id, { fetchImpl = fetch } = {}) {
    const row = await readRow(env, id);
    if (!row) {
        return { ok: false, reason: "not_found", message: "账号不存在", account: null };
    }

    const email = String(row.email || "").trim();
    const password = String(row.password || "");
    if (!email || !password) {
        return {
            ok: false,
            reason: "no_credentials",
            message: "这个账号是粘贴 token 加的，没有保存密码，只能重新粘贴 token",
            account: accountView(row)
        };
    }

    return loginTrancyAccount(env, { email, password, mode: "login", fetchImpl });
}

/**
 * Renew every account that is worth a subrequest.
 *
 * `dead` accounts are skipped (only a human can revive them) and so are
 * accounts checked more recently than `minAgeMinutes`, which keeps the manual
 * "refresh all" button from burning calls.
 */
export async function refreshAllTrancyAccounts(env, { minAgeMinutes = 0, limit = 25, fetchImpl = fetch } = {}) {
    const rows = await readRows(env);
    // minAgeMinutes = 0 means "everything is due": the daily cron must not be
    // filtered out by its own previous timestamp.
    const cutoff = minAgeMinutes > 0 ? Date.now() - minAgeMinutes * 60 * 1000 : Number.POSITIVE_INFINITY;

    const due = rows.filter(row => {
        if (String(row.status) === TRANCY_STATUS.dead) {
            return false;
        }
        const checked = Date.parse(String(row.last_checked_at || ""));
        return !Number.isFinite(checked) || checked <= cutoff;
    }).slice(0, limit);

    const results = [];
    for (const row of due) {
        results.push(await refreshTrancyAccount(env, row.id, { fetchImpl }));
    }

    return {
        checked: results.length,
        ok: results.filter(result => result.refreshed).length,
        dead: results.filter(result => result.reason === TRANCY_STATUS.dead).length,
        failed: results.filter(result => !result.refreshed && result.reason !== TRANCY_STATUS.dead).length,
        skipped: rows.length - due.length,
        accounts: results.map(result => result.account).filter(Boolean)
    };
}

/**
 * Least-recently-used usable account. Never returns an account whose token
 * Trancy already rejected, nor one inside a failure cooldown.
 */
export async function pickTrancyAccount(env) {
    const row = await requireDatabase(env)
        .prepare(
            `SELECT ${SELECT_COLUMNS} FROM trancy_account
              WHERE status = ? AND (cooldown_until = '' OR cooldown_until <= ?)
              ORDER BY (last_used_at = '') DESC, last_used_at ASC
              LIMIT 1`
        )
        .bind(TRANCY_STATUS.ok, nowIso())
        .first();

    if (!row) {
        return null;
    }

    const { token, error } = await decryptToken(env, row);
    if (!token) {
        return null;
    }
    return { id: row.id, email: String(row.email || ""), name: String(row.name || ""), token, tokenError: error };
}

/** Bookkeeping for the relay: keep `last_used_at` ordered, count failures. */
export async function recordTrancyUsage(env, id, { ok = true, cooldownMinutes = 0 } = {}) {
    const timestamp = nowIso();
    if (ok) {
        await requireDatabase(env)
            .prepare("UPDATE trancy_account SET last_used_at = ?, use_count = use_count + 1, updated_at = ? WHERE id = ?")
            .bind(timestamp, timestamp, id)
            .run();
        return;
    }

    const cooldownUntil = cooldownMinutes > 0
        ? new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString()
        : "";
    await requireDatabase(env)
        .prepare(
            `UPDATE trancy_account SET last_used_at = ?, fail_count = fail_count + 1,
                 cooldown_until = ?, updated_at = ? WHERE id = ?`
        )
        .bind(timestamp, cooldownUntil, timestamp, id)
        .run();
}

/** Normalize then hand back the token, so routes can validate before saving. */
export function normalizeIncomingToken(raw) {
    return normalizeTrancyToken(raw);
}
