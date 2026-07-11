import type { ConnState } from "./types";

/**
 * Kick integration.
 *
 * Reading chat works directly in the browser via Kick's public Pusher socket.
 * Everything that touches kick.com / api.kick.com (resolving a channel slug to
 * its chatroom id, and sending messages) is blocked for browsers by Cloudflare
 * and ships no CORS headers, so those calls go through the bundled local proxy
 * (see server/kick-proxy.mjs).
 */

const PUSHER_APP_KEY = "32cbd69e4b950bf97679";
const PUSHER_URL = `wss://ws-us2.pusher.com/app/${PUSHER_APP_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;

export function proxyBase(): string {
  // same-origin by default (served by the MB Chatters server; proxied by vite in dev).
  // Can be overridden to point at a standalone proxy if desired.
  try {
    return localStorage.getItem("chefshub.proxy") || "";
  } catch {
    return "";
  }
}

export interface KickChannelInfo {
  slug: string;
  chatroomId: number;
  broadcasterUserId: number;
}

/** Resolve a Kick slug to its chatroom + broadcaster id via the proxy. */
export async function resolveKickChannel(slug: string): Promise<KickChannelInfo> {
  const res = await fetch(`${proxyBase()}/kick/channel/${encodeURIComponent(slug)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `Lookup failed (${res.status})`);
  }
  return { slug, chatroomId: body.chatroomId, broadcasterUserId: body.broadcasterUserId };
}

/** Send a Kick message via the proxy using the account's bearer token. */
export async function sendKick(opts: {
  token: string;
  chatroomId?: number;
  broadcasterUserId?: number;
  content: string;
  proxy?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${proxyBase()}/kick/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) return { ok: false, error: body.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "proxy unreachable" };
  }
}

interface PusherEvents {
  onState: (s: ConnState, detail?: string) => void;
  onMessage: (m: {
    chatroomId: number;
    id: string;
    username: string;
    color: string;
    text: string;
    ts: number;
  }) => void;
}

/**
 * One shared Pusher connection that can subscribe to many Kick chatrooms.
 * Anonymous — reading public chat needs no auth.
 */
export class KickPusher {
  private ws: WebSocket | null = null;
  private state: ConnState = "idle";
  private rooms = new Set<number>();
  private reconnectTimer: number | null = null;
  private manualClose = false;
  private backoff = 1000;

  constructor(private ev: PusherEvents) {}

  getState() {
    return this.state;
  }

  private setState(s: ConnState, detail?: string) {
    this.state = s;
    this.ev.onState(s, detail);
  }

  private ensure() {
    if (this.ws && (this.state === "open" || this.state === "connecting")) return;
    this.manualClose = false;
    this.setState("connecting");
    const ws = new WebSocket(PUSHER_URL);
    this.ws = ws;

    ws.onmessage = (e) => {
      let frame: { event?: string; data?: unknown; channel?: string };
      try {
        frame = JSON.parse(typeof e.data === "string" ? e.data : "");
      } catch {
        return;
      }
      this.handleFrame(frame);
    };
    ws.onclose = () => {
      if (this.state !== "error") this.setState("closed");
      if (!this.manualClose && this.rooms.size) this.scheduleReconnect();
    };
    ws.onerror = () => this.setState("error", "pusher error");
  }

  private handleFrame(frame: { event?: string; data?: unknown; channel?: string }) {
    switch (frame.event) {
      case "pusher:connection_established":
        this.backoff = 1000;
        this.setState("open");
        for (const id of this.rooms) this.subscribe(id);
        break;
      case "pusher:ping":
        this.ws?.send(JSON.stringify({ event: "pusher:pong", data: {} }));
        break;
      case "App\\Events\\ChatMessageEvent": {
        const data = this.parseData(frame.data);
        if (!data) return;
        const chatroomId = Number(data.chatroom_id ?? this.roomFromChannel(frame.channel));
        this.ev.onMessage({
          chatroomId,
          id: String(data.id ?? `${Date.now()}-${Math.random()}`),
          username: data.sender?.username ?? "unknown",
          color: data.sender?.identity?.color ?? "",
          text: typeof data.content === "string" ? data.content : "",
          ts: data.created_at ? Date.parse(data.created_at) || Date.now() : Date.now(),
        });
        break;
      }
    }
  }

  private parseData(raw: unknown): any {
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return raw ?? null;
  }

  private roomFromChannel(channel?: string): number {
    const m = channel?.match(/chatrooms\.(\d+)/);
    return m ? Number(m[1]) : NaN;
  }

  private subscribe(chatroomId: number) {
    this.ws?.send(
      JSON.stringify({ event: "pusher:subscribe", data: { auth: "", channel: `chatrooms.${chatroomId}.v2` } })
    );
    this.ws?.send(
      JSON.stringify({ event: "pusher:subscribe", data: { auth: "", channel: `chatrooms.${chatroomId}` } })
    );
  }

  join(chatroomId: number) {
    this.rooms.add(chatroomId);
    this.ensure();
    if (this.state === "open") this.subscribe(chatroomId);
  }

  leave(chatroomId: number) {
    this.rooms.delete(chatroomId);
    if (this.state === "open") {
      this.ws?.send(
        JSON.stringify({ event: "pusher:unsubscribe", data: { channel: `chatrooms.${chatroomId}.v2` } })
      );
    }
    if (this.rooms.size === 0) this.close();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.backoff = Math.min(this.backoff * 2, 30000);
      this.ensure();
    }, this.backoff);
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
