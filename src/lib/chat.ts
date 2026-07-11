import { TwitchConnection } from "./twitch";
import { KickPusher, sendKick } from "./kick";
import { twitchSendViaServer } from "./twitchsend";
import type { Account, Channel } from "./types";
import { channelId } from "./types";
import { useStore } from "./store";

/**
 * Owns all live connections and fans events back into the store.
 *  - Twitch: one IRC WebSocket per visible account.
 *  - Kick: one shared Pusher socket subscribed to every kick chatroom (reads
 *    are anonymous); sends go out over HTTP through the local proxy.
 */
class ChatManager {
  private twitch = new Map<string, TwitchConnection>();
  private kick: KickPusher | null = null;
  private roomToChannel = new Map<number, string>();
  private seenIds = new Set<string>();
  private recentSelf: { channelId: string; username: string; text: string; ts: number }[] = [];

  // ---- self-echo de-dup (both platforms rebroadcast our own messages) ----
  private markSelf(cId: string, username: string, text: string) {
    const now = Date.now();
    this.recentSelf.push({ channelId: cId, username: username.toLowerCase(), text: text.trim(), ts: now });
    this.recentSelf = this.recentSelf.filter((s) => now - s.ts < 12000);
  }
  private isEcho(cId: string, username: string, text: string): boolean {
    const idx = this.recentSelf.findIndex(
      (s) => s.channelId === cId && s.username === username.toLowerCase() && s.text === text.trim()
    );
    if (idx !== -1) {
      this.recentSelf.splice(idx, 1);
      return true;
    }
    return false;
  }
  private ownUsernames(): Set<string> {
    return new Set(useStore.getState().accounts.map((a) => a.username.toLowerCase()));
  }
  private firstSeen(id: string): boolean {
    if (this.seenIds.has(id)) return false;
    this.seenIds.add(id);
    if (this.seenIds.size > 5000) this.seenIds = new Set(Array.from(this.seenIds).slice(-2500));
    return true;
  }

  // ---------------------------- Twitch ----------------------------
  private ensureTwitch(account: Account) {
    let conn = this.twitch.get(account.id);
    if (conn) return conn;
    conn = new TwitchConnection(account.id, account.username, account.token, {
      onState: (state, detail) => useStore.getState().setConnState(account.id, state, detail),
      onNotice: (channel, text) => useStore.getState().pushSystem(channelId("twitch", channel), text),
      onPrivmsg: (m) => {
        if (!this.firstSeen(`tw:${m.id}`)) return;
        const cId = channelId("twitch", m.channel);
        const isOwn = this.ownUsernames().has(m.username.toLowerCase());
        if (isOwn && this.isEcho(cId, m.username, m.text)) return;
        useStore.getState().pushMessage({
          id: `tw:${m.id}`,
          channelId: cId,
          username: m.username,
          displayName: m.displayName,
          color: m.color,
          text: m.text,
          ts: m.ts,
          self: isOwn,
        });
        if (!isOwn) useStore.getState().handleIncoming(cId, m.username, m.text);
      },
    });
    this.twitch.set(account.id, conn);
    conn.connect();
    return conn;
  }

  // ----------------------------- Kick -----------------------------
  private ensureKick() {
    if (this.kick) return this.kick;
    this.kick = new KickPusher({
      onState: (state, detail) => useStore.getState().setKickReadState(state, detail),
      onMessage: (m) => {
        if (!this.firstSeen(`ki:${m.id}`)) return;
        const cId = this.roomToChannel.get(m.chatroomId);
        if (!cId) return;
        const isOwn = this.ownUsernames().has(m.username.toLowerCase());
        if (isOwn && this.isEcho(cId, m.username, m.text)) return;
        useStore.getState().pushMessage({
          id: `ki:${m.id}`,
          channelId: cId,
          username: m.username,
          displayName: m.username,
          color: m.color,
          text: m.text,
          ts: m.ts,
          self: isOwn,
        });
        if (!isOwn) useStore.getState().handleIncoming(cId, m.username, m.text);
      },
    });
    return this.kick;
  }

  // ------------------------- reconciliation -----------------------
  sync(accounts: Account[], channels: Channel[]) {
    // Twitch connections track visible twitch accounts
    const wantTwitch = new Set(
      accounts.filter((a) => a.platform === "twitch" && a.visible && a.token).map((a) => a.id)
    );
    for (const [id, conn] of this.twitch) {
      if (!wantTwitch.has(id)) {
        conn.close();
        this.twitch.delete(id);
        useStore.getState().setConnState(id, "idle");
      }
    }
    const twitchChannels = channels.filter((c) => c.platform === "twitch").map((c) => c.name);
    for (const acc of accounts) {
      if (!wantTwitch.has(acc.id)) continue;
      const conn = this.ensureTwitch(acc);
      for (const ch of twitchChannels) conn.join(ch);
    }

    // Kick accounts have no socket of their own — reflect token presence as status
    for (const acc of accounts) {
      if (acc.platform === "kick") useStore.getState().setConnState(acc.id, acc.token ? "open" : "error");
    }

    // Kick pusher subscriptions track resolved kick channels
    const kickChannels = channels.filter((c) => c.platform === "kick" && c.kickChatroomId);
    if (kickChannels.length) {
      const pusher = this.ensureKick();
      const want = new Set(kickChannels.map((c) => c.kickChatroomId!));
      for (const [room] of this.roomToChannel) {
        if (!want.has(room)) {
          pusher.leave(room);
          this.roomToChannel.delete(room);
        }
      }
      for (const c of kickChannels) {
        this.roomToChannel.set(c.kickChatroomId!, c.id);
        pusher.join(c.kickChatroomId!);
      }
    } else if (this.kick) {
      this.kick.close();
      for (const [room] of this.roomToChannel) this.kick.leave(room);
      this.roomToChannel.clear();
    }
  }

  partTwitch(name: string) {
    for (const conn of this.twitch.values()) conn.part(name);
  }

  // ------------------------------ send ----------------------------
  send(account: Account, channel: Channel, text: string): boolean {
    if (account.platform === "twitch") {
      this.markSelf(channel.id, account.username, text);
      // proxied bots send server-side (through the proxy); others send from the browser
      if (account.proxy) {
        void twitchSendViaServer(account.id, channel.name, text).then((r) => {
          if (!r.ok) useStore.getState().pushSystem(channel.id, `Twitch send failed: ${r.error}`);
        });
        return true;
      }
      const conn = this.twitch.get(account.id);
      return conn ? conn.say(channel.name, text) : false;
    }
    // kick — fire over the proxy, mark self so the pusher echo is de-duped
    this.markSelf(channel.id, account.username, text);
    void sendKick({
      token: account.token,
      chatroomId: channel.kickChatroomId,
      broadcasterUserId: channel.kickBroadcasterId,
      content: text,
      proxy: account.proxy,
    }).then((r) => {
      if (!r.ok) useStore.getState().pushSystem(channel.id, `Kick send failed: ${r.error}`);
    });
    return true;
  }
}

export const chat = new ChatManager();
