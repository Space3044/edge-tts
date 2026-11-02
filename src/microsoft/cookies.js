/**
 * Cookie jar with domain metadata.
 *
 * The playground session cookie (`AppServiceAuthSession`, domain
 * playground.microsoft.ai) is short-lived. Renewing it requires the Microsoft
 * identity cookies that live on login.microsoftonline.com, so the jar has to
 * remember which domain every cookie belongs to and only send the matching
 * ones on each hop.
 *
 * Accepted inputs:
 *   - a JSON array of { name, value, domain?, path? } (DevTools / Cookie-Editor
 *     export, or Playwright `storageState().cookies`)
 *   - a JSON object with a `cookies` array
 *   - a plain `Cookie:` header value, which is treated as playground-only
 */

export const PLAYGROUND_HOST = "playground.microsoft.ai";
export const LOGIN_HOST = "login.microsoftonline.com";

function normalizeDomain(domain, fallbackHost) {
    const raw = String(domain || "").trim().toLowerCase();
    if (raw) {
        return raw.startsWith(".") ? raw : raw;
    }
    return String(fallbackHost || "").toLowerCase();
}

function toEntry(item, fallbackHost) {
    const name = String(item?.name ?? "").trim();
    if (!name) return null;
    return {
        name,
        value: String(item?.value ?? ""),
        domain: normalizeDomain(item?.domain, fallbackHost),
        path: String(item?.path || "/")
    };
}

/** Parse whatever the operator pasted into a domain-aware jar. */
export function parseCookieJar(input) {
    const raw = String(input || "").trim();
    if (!raw) {
        return [];
    }

    if (raw.startsWith("[") || raw.startsWith("{")) {
        try {
            const parsed = JSON.parse(raw);
            const list = Array.isArray(parsed) ? parsed : parsed?.cookies;
            if (Array.isArray(list)) {
                return list.map(item => toEntry(item, PLAYGROUND_HOST)).filter(Boolean);
            }
        } catch {
            // Fall through to header parsing.
        }
    }

    const header = raw.replace(/^cookie\s*:\s*/i, "");
    return header
        .split(/[;\r\n]/)
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
            const index = part.indexOf("=");
            if (index <= 0) return null;
            return {
                name: part.slice(0, index).trim(),
                value: part.slice(index + 1).trim(),
                domain: PLAYGROUND_HOST,
                path: "/"
            };
        })
        .filter(Boolean);
}

export function serializeCookieJar(jar) {
    return JSON.stringify(jar.map(({ name, value, domain, path }) => ({ name, value, domain, path })));
}

function domainMatches(cookieDomain, host) {
    const domain = String(cookieDomain || "").replace(/^\./, "").toLowerCase();
    const target = String(host || "").toLowerCase();
    return target === domain || target.endsWith(`.${domain}`);
}

function pathMatches(cookiePath, requestPath) {
    const path = String(cookiePath || "/");
    return String(requestPath || "/").startsWith(path);
}

/** `Cookie:` header value for one URL, or "" when the jar has nothing for it. */
export function cookieHeaderFor(jar, url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return "";
    }
    const path = parsed.pathname || "/";
    return jar
        .filter(cookie => domainMatches(cookie.domain, parsed.hostname) && pathMatches(cookie.path, path))
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join("; ");
}

/** Apply one or more `Set-Cookie` headers coming from `responseUrl`. */
export function applySetCookies(jar, setCookieHeaders, responseUrl) {
    let host = "";
    try {
        host = new URL(responseUrl).hostname;
    } catch {
        host = PLAYGROUND_HOST;
    }

    const next = jar.map(cookie => ({ ...cookie }));

    for (const header of setCookieHeaders) {
        if (!header) continue;
        const [pair, ...attributes] = String(header).split(";");
        const index = pair.indexOf("=");
        if (index <= 0) continue;

        const name = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();

        let domain = host;
        let path = "/";
        let deleted = false;
        for (const attribute of attributes) {
            const [key, ...rest] = attribute.split("=");
            const attributeName = key.trim().toLowerCase();
            const attributeValue = rest.join("=").trim();
            if (attributeName === "domain" && attributeValue) {
                domain = attributeValue.replace(/^\./, "").toLowerCase();
            } else if (attributeName === "path" && attributeValue) {
                path = attributeValue;
            } else if (attributeName === "max-age" && Number(attributeValue) <= 0) {
                deleted = true;
            }
        }

        const existingIndex = next.findIndex(cookie =>
            cookie.name === name
            && cookie.domain.replace(/^\./, "").toLowerCase() === domain.replace(/^\./, "").toLowerCase());

        if (deleted || value === "") {
            if (existingIndex >= 0) next.splice(existingIndex, 1);
            continue;
        }

        const entry = { name, value, domain, path };
        if (existingIndex >= 0) {
            next[existingIndex] = entry;
        } else {
            next.push(entry);
        }
    }

    return next;
}

export function hasDomain(jar, host) {
    return jar.some(cookie => domainMatches(cookie.domain, host));
}
