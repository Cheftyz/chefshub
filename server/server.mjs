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
import { twitchLive, kickLive } from "./live.mjs";

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
  botCount: Array.isArray(u.bots) ? u.bots.length : 0,
});

// "bots" = the Twitch/Kick sending accounts a user has.
function ensureBots(u) {
  if (!Array.isArray(u.bots)) u.bots = [];
  return u.bots;
}
const ownBot = (b) => ({
  id: b.id,
  platform: b.platform,
  username: b.username,
  token: b.token,
  visible: b.visible !== false,
  proxy: b.proxy || "",
});
const adminBot = (b) => ({ id: b.id, platform: b.platform, username: b.username, visible: b.visible !== false }); // no token
// find any bot across all users (admin)
function findBotGlobal(botId) {
  for (const u of db().users) {
    const bot = ensureBots(u).find((b) => b.id === botId);
    if (bot) return { user: u, bot };
  }
  return null;
}
function makeBot(body) {
  const platform = body?.platform === "kick" ? "kick" : "twitch";
  const username = String(body?.username || "").trim().toLowerCase();
  const token = String(body?.token || "").trim();
  if (!username || !token) return { error: "Username and token are both required." };
  return { bot: { id: uid(), platform, username, token, visible: true } };
}

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

// create a user directly (admin) — approved by default
app.post("/api/admin/users", auth, adminOnly, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const displayName = String(req.body?.displayName || "").trim();
  const status = ["approved", "pending", "disabled"].includes(req.body?.status) ? req.body.status : "approved";
  if (!isValidEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });
  if (findUserByEmail(email)) return res.status(409).json({ error: "An account with that email already exists." });
  const user = {
    id: uid(),
    email,
    displayName: displayName || email.split("@")[0],
    passwordHash: hashPassword(password),
    status,
    isAdmin: false,
    createdAt: Date.now(),
  };
  db().users.push(user);
  await save();
  res.json({ ok: true, user: publicUser(user) });
});

// edit a user (admin) — any of displayName / email / password / status
app.post("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  const target = findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: "user not found" });
  const { displayName, email, password, status } = req.body || {};
  if (displayName !== undefined && String(displayName).trim()) target.displayName = String(displayName).trim();
  if (email !== undefined) {
    const e = String(email).trim().toLowerCase();
    if (!isValidEmail(e)) return res.status(400).json({ error: "Enter a valid email address." });
    const other = findUserByEmail(e);
    if (other && other.id !== target.id) return res.status(409).json({ error: "Another account already uses that email." });
    target.email = e;
  }
  if (password) {
    if (String(password).length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });
    target.passwordHash = hashPassword(String(password));
  }
  if (status !== undefined) {
    if (!["approved", "disabled", "pending"].includes(status)) return res.status(400).json({ error: "bad status" });
    if (target.isAdmin) return res.status(400).json({ error: "You can't change an admin's access." });
    target.status = status;
  }
  await save();
  res.json({ ok: true, user: publicUser(target) });
});

// delete a user (admin)
app.delete("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  const target = findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: "user not found" });
  if (target.isAdmin) return res.status(400).json({ error: "You can't delete an admin account." });
  db().users = db().users.filter((u) => u.id !== target.id);
  await save();
  res.json({ ok: true });
});

// -------------------- bots: a user's own (with tokens) --------------------
app.get("/api/me/bots", auth, (req, res) => {
  res.json({ bots: ensureBots(req.user).map(ownBot) });
});
app.post("/api/me/bots", auth, async (req, res) => {
  const { bot, error } = makeBot(req.body);
  if (error) return res.status(400).json({ error });
  ensureBots(req.user).push(bot);
  await save();
  res.json({ ok: true, bot: ownBot(bot) });
});
app.post("/api/me/bots/:botId", auth, async (req, res) => {
  const bot = ensureBots(req.user).find((b) => b.id === req.params.botId);
  if (!bot) return res.status(404).json({ error: "bot not found" });
  if (req.body?.visible !== undefined) bot.visible = !!req.body.visible;
  if (req.body?.username) bot.username = String(req.body.username).trim().toLowerCase();
  if (req.body?.token) bot.token = String(req.body.token).trim();
  await save();
  res.json({ ok: true, bot: ownBot(bot) });
});
app.delete("/api/me/bots/:botId", auth, async (req, res) => {
  req.user.bots = ensureBots(req.user).filter((b) => b.id !== req.params.botId);
  await save();
  res.json({ ok: true });
});

// -------------------- bots: admin managing any user's --------------------
app.get("/api/admin/users/:id/bots", auth, adminOnly, (req, res) => {
  const u = findUserById(req.params.id);
  if (!u) return res.status(404).json({ error: "user not found" });
  res.json({ bots: ensureBots(u).map(adminBot) });
});
app.post("/api/admin/users/:id/bots", auth, adminOnly, async (req, res) => {
  const u = findUserById(req.params.id);
  if (!u) return res.status(404).json({ error: "user not found" });
  const { bot, error } = makeBot(req.body);
  if (error) return res.status(400).json({ error });
  ensureBots(u).push(bot);
  await save();
  res.json({ ok: true, bot: adminBot(bot) });
});
app.delete("/api/admin/users/:id/bots/:botId", auth, adminOnly, async (req, res) => {
  const u = findUserById(req.params.id);
  if (!u) return res.status(404).json({ error: "user not found" });
  u.bots = ensureBots(u).filter((b) => b.id !== req.params.botId);
  await save();
  res.json({ ok: true });
});

// -------------------- admin: every bot on the site --------------------
app.get("/api/admin/bots", auth, adminOnly, (_req, res) => {
  const all = [];
  for (const u of db().users) {
    for (const b of ensureBots(u)) {
      all.push({
        id: b.id,
        platform: b.platform,
        username: b.username,
        visible: b.visible !== false,
        proxy: b.proxy || "",
        ownerId: u.id,
        ownerName: u.displayName || u.email,
        ownerEmail: u.email,
      });
    }
  }
  all.sort((a, b) => a.ownerName.localeCompare(b.ownerName) || a.username.localeCompare(b.username));
  res.json({ bots: all });
});
app.post("/api/admin/bots/:botId", auth, adminOnly, async (req, res) => {
  const found = findBotGlobal(req.params.botId);
  if (!found) return res.status(404).json({ error: "bot not found" });
  if (req.body?.proxy !== undefined) found.bot.proxy = String(req.body.proxy).trim();
  if (req.body?.visible !== undefined) found.bot.visible = !!req.body.visible;
  await save();
  res.json({ ok: true });
});
app.delete("/api/admin/bots/:botId", auth, adminOnly, async (req, res) => {
  const found = findBotGlobal(req.params.botId);
  if (!found) return res.status(404).json({ error: "bot not found" });
  found.user.bots = ensureBots(found.user).filter((b) => b.id !== req.params.botId);
  await save();
  res.json({ ok: true });
});

// -------------------- tool collections (commands / timers / quotes) --------------------
const TOOL_KINDS = new Set(["commands", "timers", "quotes"]);
const ensureCol = (u, kind) => {
  if (!Array.isArray(u[kind])) u[kind] = [];
  return u[kind];
};
app.get("/api/me/:kind", auth, (req, res, next) => {
  if (!TOOL_KINDS.has(req.params.kind)) return next();
  res.json({ items: ensureCol(req.user, req.params.kind) });
});
app.post("/api/me/:kind", auth, async (req, res, next) => {
  if (!TOOL_KINDS.has(req.params.kind)) return next();
  const item = { ...req.body, id: uid() };
  ensureCol(req.user, req.params.kind).push(item);
  await save();
  res.json({ ok: true, item });
});
app.post("/api/me/:kind/:id", auth, async (req, res, next) => {
  if (!TOOL_KINDS.has(req.params.kind)) return next();
  const col = ensureCol(req.user, req.params.kind);
  const item = col.find((x) => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: "not found" });
  Object.assign(item, req.body, { id: item.id });
  await save();
  res.json({ ok: true, item });
});
app.delete("/api/me/:kind/:id", auth, async (req, res, next) => {
  if (!TOOL_KINDS.has(req.params.kind)) return next();
  req.user[req.params.kind] = ensureCol(req.user, req.params.kind).filter((x) => x.id !== req.params.id);
  await save();
  res.json({ ok: true });
});

// -------------------- message groups (phrase presets per game) --------------------
function ensureGroups(u) {
  if (!Array.isArray(u.groups)) u.groups = [];
  if (u.groups.length === 0) {
    u.groups = [
      {
        id: uid(),
        name: "Default",
        phrases: [
          { id: uid(), text: "gg wp", delay: 30 },
          { id: uid(), text: "LMAO", delay: 30 },
          { id: uid(), text: "W", delay: 30 },
        ],
      },
    ];
  }
  return u.groups;
}
app.get("/api/me/groups", auth, async (req, res) => {
  const seeded = !Array.isArray(req.user.groups) || req.user.groups.length === 0;
  const groups = ensureGroups(req.user);
  if (seeded) await save();
  res.json({ groups });
});
app.put("/api/me/groups", auth, async (req, res) => {
  const incoming = Array.isArray(req.body?.groups) ? req.body.groups : [];
  req.user.groups = incoming.slice(0, 50).map((g) => ({
    id: String(g.id || uid()),
    name: String(g.name || "Group").slice(0, 40),
    phrases: (Array.isArray(g.phrases) ? g.phrases : []).slice(0, 300).map((p) => ({
      id: String(p.id || uid()),
      text: String(p.text || "").slice(0, 500),
      delay: Number(p.delay) > 0 ? Number(p.delay) : 30,
    })),
  }));
  await save();
  res.json({ ok: true, groups: req.user.groups });
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

// live channel info (is-live / viewers / title)
app.get("/api/live/twitch/:login", auth, async (req, res) => res.json(await twitchLive(req.params.login)));
app.get("/api/live/kick/:slug", auth, async (req, res) => res.json(await kickLive(req.params.slug)));

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
