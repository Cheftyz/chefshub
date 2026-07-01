import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Account, ChatMessage, Channel, ConnState, Phrase, Platform, Scheduled } from "./types";
import { channelId } from "./types";
import { chat } from "./chat";
import { resolveKickChannel } from "./kick";
import { listMyBots, addMyBot, updateMyBot, deleteMyBot } from "./bots";

const uid = () => Math.random().toString(36).slice(2, 10);

const NAME_COLORS = [
  "#ff4a80", "#8b5cf6", "#22c55e", "#f59e0b", "#38bdf8",
  "#f472b6", "#a3e635", "#fb7185", "#2dd4bf", "#c084fc",
];
export function colorFor(name: string, given?: string) {
  if (given) return given;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

interface ConnInfo {
  state: ConnState;
  detail?: string;
}

interface State {
  /** which platform tab is currently shown */
  view: Platform;
  accounts: Account[];
  activeAccountId: string | null;
  channels: Channel[];
  activeChannelId: string | null;
  phrases: Phrase[];
  scheduleDelay: number;
  autoEnabled: boolean;
  autoInterval: number;
  messages: Record<string, ChatMessage[]>;
  scheduled: Scheduled[];
  conn: Record<string, ConnInfo>;
  kickRead: ConnInfo;

  // navigation
  setView: (platform: Platform) => void;

  // accounts ("bots") — stored on the server per user
  loadBots: () => Promise<void>;
  clearBots: () => void;
  addAccount: (platform: Platform, username: string, token: string) => Promise<{ ok: boolean; error?: string }>;
  removeAccount: (id: string) => Promise<void>;
  toggleVisible: (id: string) => Promise<void>;
  setActiveAccount: (id: string) => void;

  // channels
  addChannel: (platform: Platform, name: string) => Promise<void>;
  removeChannel: (id: string) => void;
  setActiveChannel: (id: string) => void;

  // phrases
  addPhrase: (text: string, delay?: number) => void;
  updatePhrase: (id: string, patch: Partial<Phrase>) => void;
  removePhrase: (id: string) => void;
  setScheduleDelay: (n: number) => void;

  // auto
  setAutoEnabled: (b: boolean) => void;
  setAutoInterval: (n: number) => void;

  // messaging
  sendNow: (accountId: string, text: string) => boolean;
  schedule: (accountId: string, text: string, delaySec: number) => void;
  cancelScheduled: (id: string) => void;

  // internal / engines
  pushMessage: (m: ChatMessage) => void;
  pushSystem: (channelId: string, text: string) => void;
  setConnState: (accountId: string, state: ConnState, detail?: string) => void;
  setKickReadState: (state: ConnState, detail?: string) => void;
  tickScheduled: () => void;
  runAuto: () => void;
}

const appendMsg = (
  messages: Record<string, ChatMessage[]>,
  cId: string,
  m: ChatMessage
): Record<string, ChatMessage[]> => {
  const list = messages[cId] ?? [];
  return { ...messages, [cId]: [...list, m].slice(-500) };
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      view: "twitch",
      accounts: [],
      activeAccountId: null,
      channels: [],
      activeChannelId: null,
      phrases: [
        { id: uid(), text: "gg wp", delay: 30 },
        { id: uid(), text: "LMAO", delay: 30 },
        { id: uid(), text: "W", delay: 30 },
      ],
      scheduleDelay: 30,
      autoEnabled: false,
      autoInterval: 180,
      messages: {},
      scheduled: [],
      conn: {},
      kickRead: { state: "idle" },

      setView: (platform) => {
        const { channels, activeChannelId, accounts, activeAccountId } = get();
        const chIn = channels.filter((c) => c.platform === platform);
        const accIn = accounts.filter((a) => a.platform === platform);
        set({
          view: platform,
          activeChannelId: chIn.find((c) => c.id === activeChannelId)?.id ?? chIn[0]?.id ?? null,
          activeAccountId: accIn.find((a) => a.id === activeAccountId)?.id ?? accIn[0]?.id ?? null,
        });
      },

      loadBots: async () => {
        const bots = await listMyBots();
        set((s) => ({
          accounts: bots,
          activeAccountId: bots.find((b) => b.id === s.activeAccountId)?.id ?? bots[0]?.id ?? null,
        }));
        for (const b of bots) if (b.platform === "kick") get().setConnState(b.id, b.token ? "open" : "idle");
        chat.sync(get().accounts, get().channels);
      },
      clearBots: () => {
        set({ accounts: [], activeAccountId: null });
        chat.sync([], get().channels);
      },
      addAccount: async (platform, username, token) => {
        const clean = username.trim().toLowerCase();
        if (!clean || !token.trim()) return { ok: false, error: "Username and token are required." };
        const r = await addMyBot({ platform, username: clean, token: token.trim() });
        if (!r.ok || !r.bot) return { ok: false, error: r.error || "Couldn't add the bot." };
        const acc = r.bot;
        set((s) => ({
          accounts: [...s.accounts, acc],
          activeAccountId: s.activeAccountId ?? acc.id,
        }));
        if (platform === "kick") get().setConnState(acc.id, acc.token ? "open" : "idle");
        chat.sync(get().accounts, get().channels);
        return { ok: true };
      },
      removeAccount: async (id) => {
        await deleteMyBot(id);
        set((s) => {
          const accounts = s.accounts.filter((a) => a.id !== id);
          return {
            accounts,
            activeAccountId: s.activeAccountId === id ? accounts[0]?.id ?? null : s.activeAccountId,
          };
        });
        chat.sync(get().accounts, get().channels);
      },
      toggleVisible: async (id) => {
        const current = get().accounts.find((a) => a.id === id);
        const next = !(current?.visible ?? true);
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, visible: next } : a)),
        }));
        chat.sync(get().accounts, get().channels);
        await updateMyBot(id, { visible: next });
      },
      setActiveAccount: (id) => set({ activeAccountId: id }),

      addChannel: async (platform, name) => {
        const nm = name.trim().toLowerCase().replace(/^#/, "");
        if (!nm) return;
        const id = channelId(platform, nm);
        if (get().channels.some((c) => c.id === id)) {
          set({ activeChannelId: id });
          return;
        }
        let channel: Channel = { id, platform, name: nm };
        if (platform === "kick") {
          // resolve chatroom id via the proxy (throws on failure -> surfaced in dialog)
          const info = await resolveKickChannel(nm);
          channel = { ...channel, kickChatroomId: info.chatroomId, kickBroadcasterId: info.broadcasterUserId };
        }
        set((s) => ({
          channels: [...s.channels, channel],
          activeChannelId: id,
          messages: { ...s.messages, [id]: s.messages[id] ?? [] },
        }));
        get().pushSystem(
          id,
          platform === "twitch" ? `Connecting to #${nm}…` : `Connected to kick.com/${nm}`
        );
        chat.sync(get().accounts, get().channels);
      },
      removeChannel: (id) => {
        const ch = get().channels.find((c) => c.id === id);
        if (ch?.platform === "twitch") chat.partTwitch(ch.name);
        set((s) => {
          const channels = s.channels.filter((c) => c.id !== id);
          const { [id]: _drop, ...messages } = s.messages;
          return {
            channels,
            messages,
            activeChannelId: s.activeChannelId === id ? channels[0]?.id ?? null : s.activeChannelId,
          };
        });
        chat.sync(get().accounts, get().channels);
      },
      setActiveChannel: (id) => set({ activeChannelId: id }),

      addPhrase: (text, delay) => {
        const t = text.trim();
        if (!t) return;
        set((s) => ({ phrases: [...s.phrases, { id: uid(), text: t, delay: delay ?? s.scheduleDelay }] }));
      },
      updatePhrase: (id, patch) =>
        set((s) => ({ phrases: s.phrases.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removePhrase: (id) => set((s) => ({ phrases: s.phrases.filter((p) => p.id !== id) })),
      setScheduleDelay: (n) => set({ scheduleDelay: n }),

      setAutoEnabled: (b) => set({ autoEnabled: b }),
      setAutoInterval: (n) => set({ autoInterval: Math.max(1, n) }),

      sendNow: (accountId, text) => {
        const { activeChannelId, accounts, channels } = get();
        const channel = channels.find((c) => c.id === activeChannelId);
        const acc = accounts.find((a) => a.id === accountId);
        if (!channel || !acc || !text.trim() || acc.platform !== channel.platform) return false;
        const ok = chat.send(acc, channel, text);
        get().pushMessage({
          id: uid(),
          channelId: channel.id,
          username: acc.username,
          displayName: acc.username,
          color: colorFor(acc.username),
          text,
          ts: Date.now(),
          self: true,
        });
        return ok;
      },
      schedule: (accountId, text, delaySec) => {
        const { activeChannelId, accounts, channels } = get();
        const channel = channels.find((c) => c.id === activeChannelId);
        const acc = accounts.find((a) => a.id === accountId);
        if (!channel || !acc || !text.trim() || acc.platform !== channel.platform) return;
        set((s) => ({
          scheduled: [
            ...s.scheduled,
            {
              id: uid(),
              platform: channel.platform,
              accountId,
              accountName: acc.username,
              channelId: channel.id,
              channelName: channel.name,
              text: text.trim(),
              fireAt: Date.now() + delaySec * 1000,
            },
          ],
        }));
      },
      cancelScheduled: (id) => set((s) => ({ scheduled: s.scheduled.filter((x) => x.id !== id) })),

      pushMessage: (m) => set((s) => ({ messages: appendMsg(s.messages, m.channelId, m) })),
      pushSystem: (cId, text) =>
        set((s) => {
          const m: ChatMessage = {
            id: uid(),
            channelId: cId,
            username: "",
            displayName: "",
            color: "",
            text,
            ts: Date.now(),
            system: true,
          };
          return { messages: appendMsg(s.messages, cId, m) };
        }),
      setConnState: (accountId, state, detail) =>
        set((s) => ({ conn: { ...s.conn, [accountId]: { state, detail } } })),
      setKickReadState: (state, detail) => set({ kickRead: { state, detail } }),

      tickScheduled: () => {
        const now = Date.now();
        const due = get().scheduled.filter((x) => x.fireAt <= now);
        if (!due.length) return;
        for (const item of due) {
          const acc = get().accounts.find((a) => a.id === item.accountId);
          const channel = get().channels.find((c) => c.id === item.channelId);
          if (acc && channel) {
            chat.send(acc, channel, item.text);
            get().pushMessage({
              id: uid(),
              channelId: channel.id,
              username: acc.username,
              displayName: acc.username,
              color: colorFor(acc.username),
              text: item.text,
              ts: Date.now(),
              self: true,
            });
          }
        }
        set((st) => ({ scheduled: st.scheduled.filter((x) => x.fireAt > now) }));
      },

      runAuto: () => {
        const { accounts, activeChannelId, channels, phrases } = get();
        const channel = channels.find((c) => c.id === activeChannelId);
        if (!channel || !phrases.length) return;
        const pool = accounts.filter((a) => a.visible && a.token && a.platform === channel.platform);
        if (!pool.length) return;
        const acc = pool[Math.floor(Math.random() * pool.length)];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        chat.send(acc, channel, phrase.text);
        get().pushMessage({
          id: uid(),
          channelId: channel.id,
          username: acc.username,
          displayName: acc.username,
          color: colorFor(acc.username),
          text: phrase.text,
          ts: Date.now(),
          self: true,
        });
      },
    }),
    {
      name: "chefshub",
      version: 1,
      // the channel/account shape changed in v1 — drop any incompatible v0 data
      migrate: (persisted, version) => (version < 1 ? (undefined as unknown as State) : (persisted as State)),
      partialize: (s) => ({
        view: s.view,
        // accounts (bots) are NOT persisted locally — they live on the server
        activeAccountId: s.activeAccountId,
        channels: s.channels,
        activeChannelId: s.activeChannelId,
        phrases: s.phrases,
        scheduleDelay: s.scheduleDelay,
        autoInterval: s.autoInterval,
      }),
    }
  )
);
