-- Trancy 密码改用和 token 相同的 AES-256-GCM 信封保存。
--
-- aad 用 "trancy-password:<行 id>"，与 token 的 "trancy:<行 id>" 不同，两个密文
-- 无法互相替换。旧的明文列直接删除：SQL 层无法加密已有数据，受影响的账号需要
-- 重新登录一次（token 不受影响，仍然可用）。
ALTER TABLE trancy_account ADD COLUMN password_cipher TEXT NOT NULL DEFAULT '';
ALTER TABLE trancy_account DROP COLUMN password;
