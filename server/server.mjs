// MB Chatters server: user accounts + admin approval, Kick proxy, and serves the
// built frontend — everything on one Node process so it can be hosted for all
// users. Run: `node server/server.mjs` (after `npm run build`).
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { db, save, uid, initDb, storageKind, findUserByEmail, findUserById, listUsers } from "./db.mjs";
import { hashPassword, verifyPassword, makeToken, verifyToken, genOtp, isValidEmail } from "./authcore.mjs";
import { sendResetCode, mailerConfigured } from "./mailer.mjs";
import { resolveChannel, sendMessage } from "./kick.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT) || 8787;

// --- minimal .env loader (no dependency) ---
(() => {
  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
})();

// --- seed / refresh the admin account (Cheftyz) from env ---
async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) {
    console.warn("[MB Chatters] No ADMIN_EMAIL/ADMIN_PASSWORD set — no admin seeded. Set them in .env.");
    return;
  }
  let admin = findUserByEmail(email);
  if (!admin) {
    admin = {
      id: uid(),
      email,
      displayName: process.env.ADMIN_NAME || "Cheftyz",
      passwordHash: hashPassword(password),
      status: "approved",
      isAdmin: true,
      createdAt: Date.now(),
    };
    db().users.push(admin);
    await save();
    console.log(`[MB Chatters] Seeded admin account: ${email}`);
  } else if (!admin.isAdmin || admin.status !== "approved") {
    admin.isAdmin = true;
    admin.status = "approved";
    await save();
  }
}

const app = express();
app.use(cors());
app.use(express.json());

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName || u.email,
  status: u.status,
  isAdmin: !!u.isAdmin,
  createdAt: u.createdAt,
});

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const userId = token && verifyToken(token);
  const user = userId && findUserById(userId);
  if (!user) return res.status(401).json({ error: "not signed in" });
  req.user = user;
  next();
}
function adminOnly(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: "admins only" });
  next();
}

// ---------------------------- auth ----------------------------
app.post("/api/signup", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const displayName = String(req.body?.displayName || "").trim();
  if (!isValidEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });
  if (findUserByEmail(email)) return res.status(409).json({ error: "An account with that email already exists." });

  const user = {
    id: uid(),
    email,
    displayName: displayName || email.split("@")[0],
    passwordHash: hashPassword(password),
    status: "pending", // must be approved by an admin
    isAdmin: false,
    createdAt: Date.now(),
  };
  db().users.push(user);
  await save();
  res.json({ ok: true, status: "pending" });
});

app.post("/api/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  if (user.status === "pending") return res.status(403).json({ error: "pending", message: "Your account is waiting for admin approval." });
  if (user.status === "disabled") return res.status(403).json({ error: "disabled", message: "Your access has been turned off." });
  res.json({ token: makeToken(user.id), user: publicUser(user) });
});

app.get("/api/me", auth, (req, res) => {
  // re-check status live so a disabled user loses access immediately
  if (req.user.status !== "approved") {
    return res.status(403).json({ error: req.user.status, user: publicUser(req.user) });
  }
  res.json({ user: publicUser(req.user) });
});

app.post("/api/forgot", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const user = findUserByEmail(email);
  // Always respond ok (don't reveal whether the email exists)
  if (user) {
    const code = genOtp();
    db().resets = db().resets.filter((r) => r.email !== email);
    db().resets.push({ email, code, expires: Date.now() + 15 * 60000 });
    await save();
    try {
      await sendResetCode(email, code);
    } catch (e) {
      console.error("[MB Chatters] reset email failed:", e.message);
    }
  }
  res.json({ ok: true, emailed: mailerConfigured });
});

app.post("/api/reset", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").trim();
  const password = String(req.body?.password || "");
  if (password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });
  const entry = db().resets.find((r) => r.email === email && r.code === code);
  if (!entry) return res.status(400).json({ error: "Invalid code." });
  if (entry.expires < Date.now()) return res.status(400).json({ error: "That code has expired." });
  const user = findUserByEmail(email);
  if (!user) return res.status(400).json({ error: "Invalid code." });
  user.passwordHash = hashPassword(password);
  db().resets = db().resets.filter((r) => r.email !== email);
  await save();
  res.json({ ok: true });
});

// ---------------------------- admin ----------------------------
app.get("/api/admin/users", auth, adminOnly, (_req, res) => {
  res.json({ users: listUsers().sort((a, b) => a.createdAt - b.createdAt) });
});

app.post("/api/admin/users/:id/status", auth, adminOnly, async (req, res) => {
  const target = findUserById(req.params.id);
  const status = String(req.body?.status || "");
  if (!target) return res.status(404).json({ error: "user not found" });
  if (!["approved", "disabled", "pending"].includes(status)) return res.status(400).json({ error: "bad status" });
  if (target.isAdmin) return res.status(400).json({ error: "You can't change an admin's access." });
  target.status = status;
  await save();
  res.json({ ok: true, user: publicUser(target) });
});

// ---------------------------- kick proxy ----------------------------
app.get("/kick/channel/:slug", async (req, res) => {
  try {
    const info = await resolveChannel(req.params.slug);
    res.json({ ok: true, slug: req.params.slug, ...info });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});
app.post("/kick/send", async (req, res) => {
  if (!req.body?.token || !req.body?.content) return res.status(400).json({ ok: false, error: "missing token/content" });
  const result = await sendMessage(req.body);
  res.status(result.ok ? 200 : 502).json(result);
});

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, storage: storageKind(), mailer: mailerConfigured ? "smtp" : "console" })
);

// ---------------------------- static frontend ----------------------------
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/kick")) return next();
    res.sendFile(path.join(DIST, "index.html"));
  });
} else {
  console.warn("[MB Chatters] dist/ not found — run `npm run build` to serve the app. API still works.");
}

async function main() {
  await initDb();
  await seedAdmin();
  app.listen(PORT, () => {
    console.log(`MB Chatters server on http://localhost:${PORT}  (mailer: ${mailerConfigured ? "SMTP" : "console"})`);
  });
}

main().catch((err) => {
  console.error("[MB Chatters] failed to start:", err);
  process.exit(1);
});
