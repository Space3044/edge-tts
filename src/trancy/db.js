/**
 * Shared D1 guard for the Trancy modules.
 *
 * Every store function goes through here so a missing binding produces the same
 * message instead of a `Cannot read properties of undefined` deep inside a
 * query builder.
 */

export function hasDatabase(env) {
    return Boolean(env && env.DB && typeof env.DB.prepare === "function");
}

export function requireDatabase(env) {
    if (!hasDatabase(env)) {
        throw new Error("D1 binding DB 未配置，无法读写 Trancy 账号");
    }
    return env.DB;
}
