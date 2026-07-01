// Password hashing (scrypt) and signed session tokens (HMAC), using only
// node:crypto — no bcrypt/jwt dependencies.
import crypto from "node:crypto";
import { db } from "./db.mjs";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(check, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
function sign(data) {
  return crypto.createHmac("sha256", db().secret).update(data).digest("base64url");
}

/** Create a signed token: base64(payload).signature */
export function makeToken(userId, days = 30) {
  const payload = { sub: userId, exp: Date.now() + days * 86400000 };
  const body = b64(payload);
  return `${body}.${sign(body)}`;
}

export function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export const genOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}
