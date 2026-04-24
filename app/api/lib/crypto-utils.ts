import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SECRETS_FILE = join(__dirname, "../../data/.secrets.enc");
const SALT_FILE = join(__dirname, "../../data/.salt");

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * 从密码派生 AES-256 密钥
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

/**
 * 获取或创建 salt
 */
function getOrCreateSalt(): Buffer {
  if (existsSync(SALT_FILE)) {
    return readFileSync(SALT_FILE);
  }
  const salt = randomBytes(SALT_LENGTH);
  writeFileSync(SALT_FILE, salt);
  return salt;
}

/**
 * 加密 JSON 数据并写入文件
 */
export function encryptSecrets(data: Record<string, string>, password: string): void {
  const salt = getOrCreateSalt();
  const key = deriveKey(password, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  // 格式: salt(32) + iv(16) + authTag(16) + ciphertext
  const combined = Buffer.concat([iv, encrypted]);

  // 确保 data 目录存在
  const dir = dirname(SECRETS_FILE);
  if (!existsSync(dir)) {
    const { mkdirSync } = require("node:fs");
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(SECRETS_FILE, combined);
  console.log(`✅ Secrets encrypted and saved to ${SECRETS_FILE}`);
}

/**
 * 解密并读取密钥
 */
export function decryptSecrets(password: string): Record<string, string> {
  if (!existsSync(SECRETS_FILE)) {
    return {};
  }

  const salt = getOrCreateSalt();
  const key = deriveKey(password, salt);
  const combined = readFileSync(SECRETS_FILE);

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - 16);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

/**
 * 获取某个密钥值（优先从加密存储读取，回退到环境变量）
 */
export function getSecret(key: string, envKey: string, password: string): string {
  // 先尝试从加密文件读取
  const secrets = decryptSecrets(password);
  if (secrets[key]) return secrets[key];

  // 回退到环境变量
  return process.env[envKey] || "";
}
