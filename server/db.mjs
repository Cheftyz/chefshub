// Tiny JSON-file database. Fine for a family-sized user list; no native deps.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const dir = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(dir, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const seed = { secret: crypto.randomBytes(32).toString("hex"), users: [], resets: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
  }
}

let cache = null;
export function db() {
  if (cache) return cache;
  ensure();
  cache = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  return cache;
}

export function save() {
  ensure();
  fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2));
}

export const uid = () => crypto.randomBytes(9).toString("base64url");

// ---- user helpers ----
export function findUserByEmail(email) {
  return db().users.find((u) => u.email === String(email).trim().toLowerCase());
}
export function findUserById(id) {
  return db().users.find((u) => u.id === id);
}
export function listUsers() {
  return db().users.map(({ passwordHash, ...safe }) => safe);
}
