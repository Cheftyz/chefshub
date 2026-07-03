// Storage for MB Chatters.
//
// If DATABASE_URL is set (e.g. a free Neon/Supabase Postgres), all data is kept
// in Postgres so it SURVIVES restarts and redeploys — this is what makes admin
// approvals and accounts permanent on hosts with no persistent disk.
//
// Without DATABASE_URL it falls back to a local JSON file (server/data/db.json),
// which is fine for running on your own machine.
//
// The whole (small) dataset is stored as a single JSON blob, so the in-memory
// shape stays identical either way: { secret, users[], resets[] }.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const dir = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(dir, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

let cache = null;
let pool = null;
let usePg = false;

const seed = () => ({ secret: crypto.randomBytes(32).toString("hex"), users: [], resets: [] });

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(seed(), null, 2));
}

function sslOption(url) {
  return /@localhost|@127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false };
}

/** Load data into memory. Must be awaited once before the server handles requests. */
export async function initDb() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pg = (await import("pg")).default;
    pool = new pg.Pool({ connectionString: url, ssl: sslOption(url) });
    await pool.query("CREATE TABLE IF NOT EXISTS kv (k text PRIMARY KEY, v jsonb NOT NULL)");
    const r = await pool.query("SELECT v FROM kv WHERE k = 'db'");
    if (r.rows.length) {
      cache = r.rows[0].v;
    } else {
      cache = seed();
      await pool.query("INSERT INTO kv (k, v) VALUES ('db', $1)", [JSON.stringify(cache)]);
    }
    usePg = true;
    console.log("[MB Chatters] storage: Postgres (persistent)");
  } else {
    ensureFile();
    cache = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    usePg = false;
    console.log("[MB Chatters] storage: local JSON file");
  }
  // guarantee shape
  if (!Array.isArray(cache.users)) cache.users = [];
  if (!Array.isArray(cache.resets)) cache.resets = [];
  if (!cache.secret) cache.secret = crypto.randomBytes(32).toString("hex");
  return cache;
}

export function db() {
  if (!cache) throw new Error("db not initialized — call initDb() first");
  return cache;
}

/** "postgres" (persistent), "file" (local JSON), or "uninitialized" */
export function storageKind() {
  if (!cache) return "uninitialized";
  return usePg ? "postgres" : "file";
}

export async function save() {
  if (usePg) {
    await pool.query(
      "INSERT INTO kv (k, v) VALUES ('db', $1) ON CONFLICT (k) DO UPDATE SET v = $1",
      [JSON.stringify(cache)]
    );
  } else {
    ensureFile();
    fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2));
  }
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
  // never expose passwordHash or bot tokens in the admin list; keep it lean
  return db().users.map(({ passwordHash, bots, groups, ...safe }) => ({
    ...safe,
    botCount: Array.isArray(bots) ? bots.length : 0,
  }));
}
