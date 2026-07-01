// ChefsHub Kick proxy.
//
// Browsers cannot call kick.com / api.kick.com directly: Cloudflare blocks the
// requests and no CORS headers are returned. This tiny dependency-free proxy
// runs locally, presents browser-like headers, and exposes a CORS-friendly API
// the ChefsHub web app can use to (1) resolve a channel slug to its chatroom /
// broadcaster ids and (2) send chat messages with an account's bearer token.
//
//   node server/kick-proxy.mjs         # listens on http://localhost:8787
//   PORT=9000 node server/kick-proxy.mjs

import http from "node:http";

const PORT = Number(process.env.PORT) || 8787;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://kick.com/",
  Origin: "https://kick.com",
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}
function json(res, status, body) {
  cors(res);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function resolveChannel(slug) {
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

async function sendMessage({ token, chatroomId, broadcasterUserId, content }) {
  const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const errors = [];

  // 1) official public API
  if (broadcasterUserId) {
    try {
      const r = await fetch("https://api.kick.com/public/v1/chat", {
        method: "POST",
        headers: { ...BROWSER_HEADERS, Authorization: auth, "content-type": "application/json" },
        body: JSON.stringify({ broadcaster_user_id: Number(broadcasterUserId), content, type: "user" }),
      });
      if (r.ok) return { ok: true, via: "public-api" };
      errors.push(`public-api ${r.status}`);
    } catch (e) {
      errors.push(`public-api ${e.message}`);
    }
  }

  // 2) legacy v2 endpoint
  if (chatroomId) {
    try {
      const r = await fetch(`https://kick.com/api/v2/messages/send/${chatroomId}`, {
        method: "POST",
        headers: { ...BROWSER_HEADERS, Authorization: auth, "content-type": "application/json" },
        body: JSON.stringify({ content, type: "message" }),
      });
      if (r.ok) return { ok: true, via: "v2" };
      errors.push(`v2 ${r.status}`);
    } catch (e) {
      errors.push(`v2 ${e.message}`);
    }
  }

  return { ok: false, error: errors.join("; ") || "no endpoint available" };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname.startsWith("/kick/channel/")) {
      const slug = decodeURIComponent(url.pathname.slice("/kick/channel/".length));
      if (!slug) return json(res, 400, { ok: false, error: "missing slug" });
      const info = await resolveChannel(slug);
      return json(res, 200, { ok: true, slug, ...info });
    }

    if (req.method === "POST" && url.pathname === "/kick/send") {
      const body = await readBody(req);
      if (!body.token) return json(res, 400, { ok: false, error: "missing token" });
      if (!body.content) return json(res, 400, { ok: false, error: "missing content" });
      const result = await sendMessage(body);
      return json(res, result.ok ? 200 : 502, result);
    }

    return json(res, 404, { ok: false, error: "not found" });
  } catch (e) {
    return json(res, 502, { ok: false, error: e.message || "proxy error" });
  }
});

server.listen(PORT, () => {
  console.log(`ChefsHub Kick proxy listening on http://localhost:${PORT}`);
});
