// Shared Kick helpers (channel lookup + send) used by both the standalone
// proxy (kick-proxy.mjs) and the full server (server.mjs).
import { ProxyAgent } from "undici";

// build a fetch dispatcher for an HTTP(S) proxy url, if provided
function proxyDispatcher(proxy) {
  if (!proxy) return undefined;
  try {
    return new ProxyAgent(proxy.trim());
  } catch {
    return undefined;
  }
}

export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://kick.com/",
  Origin: "https://kick.com",
};

export async function resolveChannel(slug) {
  const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
    headers: BROWSER_HEADERS,
  });
  if (!res.ok) throw new Error(`Kick returned ${res.status} (Cloudflare may be blocking this IP)`);
  const data = await res.json();
  const chatroomId = data?.chatroom?.id;
  const broadcasterUserId = data?.user_id ?? data?.user?.id;
  if (!chatroomId) throw new Error("channel has no chatroom id");
  return { chatroomId, broadcasterUserId };
}

export async function sendMessage({ token, chatroomId, broadcasterUserId, content, proxy }) {
  const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const dispatcher = proxyDispatcher(proxy);
  const errors = [];

  if (broadcasterUserId) {
    try {
      const r = await fetch("https://api.kick.com/public/v1/chat", {
        method: "POST",
        headers: { ...BROWSER_HEADERS, Authorization: auth, "content-type": "application/json" },
        body: JSON.stringify({ broadcaster_user_id: Number(broadcasterUserId), content, type: "user" }),
        dispatcher,
      });
      if (r.ok) return { ok: true, via: "public-api" };
      errors.push(`public-api ${r.status}`);
    } catch (e) {
      errors.push(`public-api ${e.message}`);
    }
  }

  if (chatroomId) {
    try {
      const r = await fetch(`https://kick.com/api/v2/messages/send/${chatroomId}`, {
        method: "POST",
        headers: { ...BROWSER_HEADERS, Authorization: auth, "content-type": "application/json" },
        body: JSON.stringify({ content, type: "message" }),
        dispatcher,
      });
      if (r.ok) return { ok: true, via: "v2" };
      errors.push(`v2 ${r.status}`);
    } catch (e) {
      errors.push(`v2 ${e.message}`);
    }
  }

  return { ok: false, error: errors.join("; ") || "no endpoint available" };
}
