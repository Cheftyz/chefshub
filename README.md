# ChefsHub

A multi-account **Twitch + Kick chat client** — rebuild of the "ChatTime" app. Manage
several accounts across both platforms, join channels, chat, and queue quick phrases with
per-phrase timers or an auto-send loop.

Built with **Vite + React + TypeScript + Tailwind + Zustand**. Accounts, tokens, channels
and phrases are stored locally in your browser.

## Features

- **Platform tabs** — a **Twitch** tab and a **Kick** tab at the top. Each tab is its own
  screen: switch to a tab to see only that platform's accounts and channels, and "Add
  account" / "Join channel" default to that platform.
- **Twitch + Kick accounts** — add any number of logins on either platform. Each account
  and channel is tagged with a platform badge. The green/red dot shows live status.
- **Channels** — join any Twitch or Kick channel by name; live chat renders with colored
  usernames.
- **Composer** — send from the selected account (automatically filtered to the active
  channel's platform), or hit the clock button to **schedule** a message after a delay
  (live countdown you can cancel).
- **Quick phrases** — one-click phrases, each with its own delay. Edit them in the
  **Quick phrases** dialog.
- **Auto mode** — every _N_ seconds, send a random phrase from a random visible account on
  the active channel's platform.

## How each platform connects

| | Read chat | Send / lookup |
|---|---|---|
| **Twitch** | Twitch IRC over WebSocket (in-browser) | Twitch IRC (in-browser) |
| **Kick** | Kick's public Pusher socket (in-browser) | **Local proxy** → Kick API |

Twitch works entirely client-side. **Kick is different**: `kick.com` / `api.kick.com` sit
behind Cloudflare and send no CORS headers, so a browser cannot call them directly. Reading
Kick chat works in-browser via Pusher, but resolving a channel and **sending** messages must
go through the bundled local proxy (`server/kick-proxy.mjs`).

## Getting tokens

- **Twitch** — Add account → Twitch → **Open twitchtokengenerator.com**, generate a token
  with `chat:read` + `chat:edit` scopes, paste your username + `oauth:...` token.
- **Kick** — Add account → Kick. On kick.com open DevTools → Network, send a chat message,
  and copy the `Authorization: Bearer` token from the request. Paste your username + token.

Tokens never leave your browser except when the proxy forwards a Kick send on your behalf.

## Run

```bash
npm install

# Twitch only:
npm run dev            # http://localhost:5173

# Twitch + Kick (web app + Kick proxy together):
npm run start          # web on :5173, proxy on :8787

# proxy alone (if you prefer separate terminals):
npm run proxy          # http://localhost:8787
```

The web app talks to the proxy at `http://localhost:8787` by default. Override it with
`localStorage.setItem('chefshub.proxy', 'http://host:port')`.

## Notes

- Neither Twitch nor Kick echoes your own messages back reliably, so sent messages are shown
  locally as you send them; echoes seen by your other connected accounts are de-duplicated.
- Kick sending depends on a valid token and your network reaching Kick — Kick's API is
  actively Cloudflare-guarded and behavior can change. The proxy tries the official
  `api.kick.com/public/v1/chat` endpoint first, then the legacy `v2` endpoint, and reports
  the error if both fail.
- Use responsibly and within each platform's Terms of Service and each channel's rules.
