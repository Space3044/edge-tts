/**
 * AES-256-GCM envelope for provider API keys.
 *
 * The key material lives only in the Worker environment variable
 * `SECRETS_ENCRYPTION_KEY` (base64, 32 bytes). Everything written to D1 is the
 * string `v1.<iv_b64>.<ciphertext_b64>`; the version prefix leaves room for a
 * future algorithm change without a data rewrite.
 *
 * The provider name is passed as additional authenticated data, so a ciphertext
 * copied from one provider row into another fails to decrypt.
 */

const ENVELOPE_VERSION = "v1";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const ALGORITHM = "AES-GCM";
const MASK_PREFIX = "••••";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
}

export function base64ToBytes(value) {
    const binary = atob(String(value));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

/**
 * Import the base64 key from the environment.
 *
 * Throws a message that is safe to show in the settings UI and in logs: it only
 * names the variable and the expected format, never the value.
 */
export async function importEncryptionKey(rawKey) {
    const value = String(rawKey ?? "").trim();
    if (!value) {
        throw new Error("SECRETS_ENCRYPTION_KEY 未配置，无法加密保存 API Key");
    }

    let bytes;
    try {
        bytes = base64ToBytes(value);
    } catch {
        throw new Error("SECRETS_ENCRYPTION_KEY 必须是 base64 编码的 32 字节密钥");
    }

    if (bytes.length !== KEY_BYTES) {
        throw new Error("SECRETS_ENCRYPTION_KEY 解码后必须是 32 字节（base64 长度 44）");
    }

    return crypto.subtle.importKey("raw", bytes, { name: ALGORITHM }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext, { key, aad }) {
    const value = String(plaintext ?? "");
    if (!value) {
        throw new Error("不能加密空密钥");
    }

    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: ALGORITHM,
            iv,
            additionalData: encoder.encode(String(aad ?? ""))
        },
        key,
        encoder.encode(value)
    );

    return [
        ENVELOPE_VERSION,
        bytesToBase64(iv),
        bytesToBase64(new Uint8Array(ciphertext))
    ].join(".");
}

export async function decryptSecret(envelope, { key, aad }) {
    const parts = String(envelope ?? "").split(".");
    if (parts.length !== 3 || parts[0] !== ENVELOPE_VERSION) {
        throw new Error("保存的 API Key 格式无法识别，请重新保存");
    }

    const iv = base64ToBytes(parts[1]);
    const ciphertext = base64ToBytes(parts[2]);

    let plaintext;
    try {
        plaintext = await crypto.subtle.decrypt(
            {
                name: ALGORITHM,
                iv,
                additionalData: encoder.encode(String(aad ?? ""))
            },
            key,
            ciphertext
        );
    } catch {
        throw new Error("保存的 API Key 无法解密，请检查 SECRETS_ENCRYPTION_KEY 是否被更换");
    }

    return decoder.decode(plaintext);
}

/**
 * Never render a stored key back to the browser: show only a short tail so the
 * operator can tell which credential is saved.
 */
export function maskSecret(secret) {
    const value = String(secret ?? "");
    if (!value) {
        return "";
    }
    const tail = value.slice(-4);
    return `${MASK_PREFIX}${tail}`;
}
