// Server-side Twitch IRC senders, one persistent connection per bot, routed
// through the bot's proxy (HTTP/HTTPS) so proxied Twitch bots post from the
// proxy IP. Only used for bots that have a proxy set; others send from the
// browser as before.
import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";

const IRC_URL = "wss://irc-ws.chat.twitch.tv:443";

class Sender {
  constructor(username, token, proxy) {
    this.username = String(username).toLowerCase();
    this.token = token.startsWith("oauth:") ? token : `oauth:${token}`;
    this.proxy = proxy || "";
    this.ws = null;
    this.ready = false;
    this.authFailed = false;
    this.joined = new Set();
    this.queue = [];
    this.lastError = "";
    this.connect();
  }

  connect() {
    if (this.ws) return;
    let agent;
    try {
      agent = this.proxy ? new HttpsProxyAgent(this.proxy) : undefined;
    } catch (e) {
      this.lastError = `bad proxy: ${e.message}`;
      return;
    }
    const ws = new WebSocket(IRC_URL, { agent, handshakeTimeout: 15000 });
    this.ws = ws;
    ws.on("open", () => {
      ws.send("CAP REQ :twitch.tv/commands");
      ws.send(`PASS ${this.token}`);
      ws.send(`NICK ${this.username}`);
    });
    ws.on("message", (data) => {
      for (const line of data.toString().split("\r\n")) {
        if (!line) continue;
        if (line.startsWith("PING")) ws.send(`PONG :${line.split(":")[1] || "tmi.twitch.tv"}`);
        else if (line.includes(" 001 ")) {
          this.ready = true;
          this.flush();
        } else if (/login authentication failed|improperly formatted auth/i.test(line)) {
          this.authFailed = true;
          this.lastError = "login authentication failed";
          ws.close();
        }
      }
    });
    ws.on("close", () => {
      this.ready = false;
      this.ws = null;
    });
    ws.on("error", (e) => {
      this.lastError = e.message || "connection error";
    });
  }

  ensureJoin(ch) {
    if (!this.joined.has(ch)) {
      this.joined.add(ch);
      if (this.ready && this.ws) this.ws.send(`JOIN #${ch}`);
    }
  }

  say(channel, text) {
    const ch = String(channel).toLowerCase().replace(/^#/, "");
    if (this.authFailed) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.ready) {
      this.queue.push([ch, text]);
      if (this.queue.length > 50) this.queue.shift();
      this.connect();
      return;
    }
    this.ensureJoin(ch);
    this.ws.send(`PRIVMSG #${ch} :${text}`);
  }

  flush() {
    for (const ch of this.joined) this.ws.send(`JOIN #${ch}`);
    const q = this.queue.splice(0);
    for (const [ch, text] of q) {
      this.ensureJoin(ch);
      this.ws.send(`PRIVMSG #${ch} :${text}`);
    }
  }
}

const senders = new Map(); // botId -> Sender

export function twitchSend({ botId, username, token, proxy, channel, text }) {
  let s = senders.get(botId);
  if (s && (s.proxy !== (proxy || "") || s.token.replace(/^oauth:/, "") !== token.replace(/^oauth:/, ""))) {
    try {
      s.ws?.close();
    } catch {
      /* ignore */
    }
    senders.delete(botId);
    s = null;
  }
  if (!s) {
    s = new Sender(username, token, proxy);
    senders.set(botId, s);
  }
  if (s.authFailed) return { ok: false, error: s.lastError || "auth failed" };
  s.say(channel, text);
  return { ok: true };
}
