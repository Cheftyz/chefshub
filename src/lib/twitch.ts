import type { ConnState } from "./types";

const IRC_URL = "wss://irc-ws.chat.twitch.tv:443";

export interface ParsedMessage {
  raw: string;
  tags: Record<string, string>;
  prefix: string | null;
  command: string;
  params: string[];
}

/** Minimal IRCv3 parser (tags + prefix + command + params). */
export function parseIrc(line: string): ParsedMessage {
  let rest = line;
  const tags: Record<string, string> = {};
  let prefix: string | null = null;

  if (rest.startsWith("@")) {
    const sp = rest.indexOf(" ");
    const tagStr = rest.slice(1, sp);
    rest = rest.slice(sp + 1);
    for (const pair of tagStr.split(";")) {
      const eq = pair.indexOf("=");
      if (eq === -1) tags[pair] = "";
      else tags[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
  }
  if (rest.startsWith(":")) {
    const sp = rest.indexOf(" ");
    prefix = rest.slice(1, sp);
    rest = rest.slice(sp + 1);
  }
  const params: string[] = [];
  while (rest.length) {
    if (rest.startsWith(":")) {
      params.push(rest.slice(1));
      break;
    }
    const sp = rest.indexOf(" ");
    if (sp === -1) {
      params.push(rest);
      break;
    }
    params.push(rest.slice(0, sp));
    rest = rest.slice(sp + 1);
  }
  const command = params.shift() ?? "";
  return { raw: line, tags, prefix, command, params };
}

function nickFromPrefix(prefix: string | null): string {
  if (!prefix) return "";
  const bang = prefix.indexOf("!");
  return bang === -1 ? prefix : prefix.slice(0, bang);
}

export interface ConnectionEvents {
  onState: (state: ConnState, detail?: string) => void;
  onPrivmsg: (msg: {
    channel: string;
    username: string;
    displayName: string;
    color: string;
    text: string;
    id: string;
    ts: number;
  }) => void;
  onNotice: (channel: string, text: string) => void;
}

/**
 * One authenticated Twitch IRC connection (one account).
 * Handles auth, capability negotiation, PING/PONG, auto-rejoin and reconnect.
 */
export class TwitchConnection {
  private ws: WebSocket | null = null;
  private channels = new Set<string>();
  private state: ConnState = "idle";
  private reconnectTimer: number | null = null;
  private manualClose = false;
  private backoff = 1000;

  constructor(
    public readonly accountId: string,
    private readonly username: string,
    private readonly token: string,
    private readonly ev: ConnectionEvents
  ) {}

  getState() {
    return this.state;
  }

  private setState(s: ConnState, detail?: string) {
    this.state = s;
    this.ev.onState(s, detail);
  }

  connect() {
    this.manualClose = false;
    if (this.ws && (this.state === "open" || this.state === "connecting")) return;
    this.setState("connecting");
    const ws = new WebSocket(IRC_URL);
    this.ws = ws;

    ws.onopen = () => {
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
      const token = this.token.startsWith("oauth:") ? this.token : `oauth:${this.token}`;
      ws.send(`PASS ${token}`);
      ws.send(`NICK ${this.username.toLowerCase()}`);
    };

    ws.onmessage = (e) => {
      const data = typeof e.data === "string" ? e.data : "";
      for (const line of data.split("\r\n")) {
        if (line) this.handleLine(line);
      }
    };

    ws.onclose = () => {
      if (this.state !== "error") this.setState("closed");
      if (!this.manualClose) this.scheduleReconnect();
    };

    ws.onerror = () => {
      this.setState("error", "connection error");
    };
  }

  private handleLine(line: string) {
    const m = parseIrc(line);
    switch (m.command) {
      case "PING":
        this.ws?.send(`PONG :${m.params[0] ?? "tmi.twitch.tv"}`);
        break;
      case "001": // welcome — auth accepted
        this.backoff = 1000;
        this.setState("open");
        for (const ch of this.channels) this.ws?.send(`JOIN #${ch}`);
        break;
      case "NOTICE": {
        const text = m.params[1] ?? "";
        if (/login authentication failed|improperly formatted auth/i.test(text)) {
          this.setState("error", text);
          this.manualClose = true;
          this.ws?.close();
        } else {
          const ch = (m.params[0] ?? "*").replace(/^#/, "");
          this.ev.onNotice(ch, text);
        }
        break;
      }
      case "PRIVMSG": {
        const channel = (m.params[0] ?? "").replace(/^#/, "");
        const text = m.params[1] ?? "";
        const login = nickFromPrefix(m.prefix);
        this.ev.onPrivmsg({
          channel,
          username: login,
          displayName: m.tags["display-name"] || login,
          color: m.tags.color || "",
          text,
          id: m.tags.id || `${login}-${Date.now()}-${Math.random()}`,
          ts: m.tags["tmi-sent-ts"] ? Number(m.tags["tmi-sent-ts"]) : Date.now(),
        });
        break;
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.backoff = Math.min(this.backoff * 2, 30000);
      this.connect();
    }, this.backoff);
  }

  join(channel: string) {
    const ch = channel.toLowerCase().replace(/^#/, "");
    this.channels.add(ch);
    if (this.state === "open") this.ws?.send(`JOIN #${ch}`);
  }

  part(channel: string) {
    const ch = channel.toLowerCase().replace(/^#/, "");
    this.channels.delete(ch);
    if (this.state === "open") this.ws?.send(`PART #${ch}`);
  }

  /** Reconcile to exactly `desired`: part channels no longer wanted, join new ones. */
  syncChannels(desired: string[]) {
    const want = new Set(desired.map((c) => c.toLowerCase().replace(/^#/, "")));
    for (const ch of Array.from(this.channels)) if (!want.has(ch)) this.part(ch);
    for (const ch of want) this.join(ch);
  }

  say(channel: string, text: string): boolean {
    const ch = channel.toLowerCase().replace(/^#/, "");
    if (this.state !== "open" || !this.ws) return false;
    this.ws.send(`PRIVMSG #${ch} :${text}`);
    return true;
  }

  close() {
    this.manualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setState("idle");
  }
}
