// Live channel info (is-live, viewer count, title).
//   Twitch: Helix API via an app access token (needs TWITCH_CLIENT_ID +
//           TWITCH_CLIENT_SECRET from a dev.twitch.tv application).
//   Kick:   public channel endpoint (no creds, but Cloudflare may block cloud IPs).
import { BROWSER_HEADERS } from "./kick.mjs";

// --- tiny 20s cache so we don't hammer the APIs ---
const cache = new Map();
const TTL = 20000;
const cached = (k) => {
  const c = cache.get(k);
  return c && Date.now() - c.ts < TTL ? c.data : null;
};
const put = (k, data) => {
  cache.set(k, { ts: Date.now(), data });
  return data;
};

// --- Twitch app access token (client credentials), cached ---
let twToken = null;
let twExp = 0;
async function twitchAppToken() {
  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (twToken && Date.now() < twExp) return twToken;
  const r = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!r.ok) return null;
  const d = await r.json();
  twToken = d.access_token;
  twExp = Date.now() + Math.max(0, (d.expires_in || 3600) - 120) * 1000;
  return twToken;
}

export async function twitchLive(login) {
  const key = "tw:" + login.toLowerCase();
  const hit = cached(key);
  if (hit) return hit;
  const id = process.env.TWITCH_CLIENT_ID;
  const token = await twitchAppToken();
  if (!id || !token) return put(key, { configured: false });
  try {
    const r = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
      headers: { "Client-Id": id, Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    const s = d.data && d.data[0];
    if (!s) return put(key, { configured: true, live: false });
    return put(key, {
      configured: true,
      live: true,
      viewers: s.viewer_count,
      title: s.title,
      game: s.game_name,
      startedAt: s.started_at,
    });
  } catch (e) {
    return put(key, { configured: true, error: e.message });
  }
}

export async function kickLive(slug) {
  const key = "ki:" + slug.toLowerCase();
  const hit = cached(key);
  if (hit) return hit;
  try {
    const r = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
      headers: BROWSER_HEADERS,
    });
    if (!r.ok) return put(key, { configured: true, error: `kick ${r.status}` });
    const d = await r.json();
    const ls = d.livestream;
    if (!ls || !ls.is_live) return put(key, { configured: true, live: false });
    return put(key, {
      configured: true,
      live: true,
      viewers: ls.viewer_count ?? ls.viewers,
      title: ls.session_title,
      game: ls.categories?.[0]?.name,
    });
  } catch (e) {
    return put(key, { configured: true, error: e.message });
  }
}
