import crypto from "node:crypto";
import { env } from "../../config/env.js";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  return crypto
    .createHash("sha256")
    .update(env.INSTAGRAM_TOKEN_ENCRYPTION_KEY)
    .digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    authTag.toString("base64url"),
  ].join(":");
}

export function decryptSecret(value: string): string {
  const [ivValue, encryptedValue, authTagValue] = value.split(":");

  if (!ivValue || !encryptedValue || !authTagValue) {
    throw new Error("Invalid encrypted secret format");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivValue, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
