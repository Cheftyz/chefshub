# MB Chatters

A multi-account **Twitch + Kick chat client** with **user accounts and admin-controlled
access**. Manage accounts across both platforms, join channels, chat, and queue quick
phrases with per-phrase timers or an auto-send loop — behind a login where an admin
(Cheftyz) approves who can use the app.

Stack: **React + TypeScript + Vite + Tailwind** frontend, a small **Node/Express** backend
(JSON storage, no external database) that serves the app, handles accounts, and proxies Kick.

## Accounts & access

- **Sign up** with an email + password. New accounts start as **pending**.
- **Admin approval** — the admin opens the **Admin** tab and turns each user's access
  **on/off** (approve, or disable to instantly revoke). Pending/disabled users see a gate
  screen and can't reach the app.
- **Forgot password** — enter your email to get a **one-time code**; enter the code + a new
  password to reset. The code is emailed if SMTP is configured, otherwise printed to the
  server console (so it works out of the box for testing).
- The admin account (**Cheftyz**) is seeded from environment variables and can't be
  disabled or demoted from the panel.

## Run it locally

```bash
cp .env.example .env      # then set ADMIN_EMAIL / ADMIN_PASSWORD
npm install
npm run build
npm run server            # serves the whole app at http://localhost:8787
```

Or just double-click **`Start MB Chatters.bat`** (Windows) — it installs, builds, starts the
server, and opens the browser.

For development with hot-reload:

```bash
npm run dev               # vite on :5173 + API on :8787 (vite proxies /api and /kick)
```

## Put it online for all users

The account system needs a **Node host** (a static site like GitHub Pages can't run the
backend). Easiest path — **Render** (free tier):

1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New → Blueprint**, pick the repo (it reads
   `render.yaml`).
3. After it deploys, set **ADMIN_EMAIL** and **ADMIN_PASSWORD** (and optional `SMTP_*` for
   real reset emails) in the service's **Environment** settings.

A `Dockerfile` is also included for any container host (Railway, Fly.io, etc.).

### Email for password resets (optional)

Set these env vars to email reset codes instead of logging them (example = Gmail App
Password): `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`,
`MAIL_FROM`.

## How each platform connects

| | Read chat | Send / lookup |
|---|---|---|
| **Twitch** | Twitch IRC over WebSocket (browser) | Twitch IRC (browser) |
| **Kick** | Kick's public Pusher socket (browser) | via the MB Chatters server (Kick blocks browsers) |

Twitch runs in the browser. Kick's own API is Cloudflare-guarded with no CORS, so Kick
channel lookup and sending go through the MB Chatters server. Note Kick's API can also block
cloud/datacenter IPs, so Kick sending may fail from some hosts even with a valid token.

## Notes

- Accounts/passwords live in `server/data/db.json` (gitignored); passwords are scrypt-hashed.
- Neither platform reliably echoes your own messages, so sent messages show locally and
  echoes from your other connected accounts are de-duplicated.
- Use responsibly and within each platform's Terms of Service and each channel's rules.
