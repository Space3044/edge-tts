import { decryptSecret, encryptSecret, importEncryptionKey } from "../secrets/crypto.js";

const AAD = "trancy-caption-continuation:v1";
export const CAPTION_JOB_TTL_MS = 90 * 60 * 1000;

// Only immutable routing metadata travels with the caller. Credentials stay in D1,
// and the gateway stores neither transcripts nor a second copy of Trancy's jobs.
export async function createCaptionTicket(env, { accountId, videoId, target }, now = Date.now()) {
    const key = await importEncryptionKey(env?.SECRETS_ENCRYPTION_KEY);
    return encryptSecret(JSON.stringify({ accountId, videoId, target, startedAt: now, expiresAt: now + CAPTION_JOB_TTL_MS }), { key, aad: AAD });
}

export async function readCaptionTicket(env, ticket, now = Date.now()) {
    if (typeof ticket !== "string" || ticket.length > 2000) return null;
    const key = await importEncryptionKey(env?.SECRETS_ENCRYPTION_KEY);
    try {
        const job = JSON.parse(await decryptSecret(ticket, { key, aad: AAD }));
        if (!job || typeof job.accountId !== "string" || !job.accountId
            || typeof job.videoId !== "string" || !/^[A-Za-z0-9_-]{6,20}$/.test(job.videoId)
            || typeof job.target !== "string" || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(job.target)
            || !Number.isSafeInteger(job.startedAt) || job.startedAt > now
            || job.expiresAt !== job.startedAt + CAPTION_JOB_TTL_MS) return null;
        return job;
    } catch { return null; }
}
