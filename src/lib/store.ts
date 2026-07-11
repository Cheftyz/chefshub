import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Account,
  ChatMessage,
  Channel,
  ConnState,
  Phrase,
  PhraseGroup,
  Platform,
  Scheduled,
  Command,
  Timer,
  Quote,
  ToolKind,
  GiveawayState,
  ActivityEvent,
  NavPage,
} from "./types";
import { channelId } from "./types";
import { chat } from "./chat";
import { resolveKickChannel } from "./kick";
import { listMyBots, addMyBot, updateMyBot, deleteMyBot } from "./bots";
import { listGroups, saveGroups } from "./groups";
import { listItems, addItem, updateItem, deleteItem } from "./tools";

const uid = () => Math.random().toString(36).slice(2, 10);
const cmdCooldown = new Map<string, number>();
const timerLastRun = new Map<string, number>();

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
  groups: PhraseGroup[];
  activeGroupId: string | null;
  scheduleDelay: number;
  autoEnabled: boolean;
  autoInterval: number;
  messages: Record<string, ChatMessage[]>;
  scheduled: Scheduled[];
  conn: Record<string, ConnInfo>;
  kickRead: ConnInfo;

  // tools + dashboard
  page: NavPage;
  commands: Command[];
  timers: Timer[];
  quotes: Quote[];
  giveaway: GiveawayState;
  activity: ActivityEvent[];

  // navigation
  setView: (platform: Platform) => void;
  setPage: (p: NavPage) => void;

  // tools (commands/timers/quotes) — stored on the server per user
  loadTools: () => Promise<void>;
  clearTools: () => void;
  addTool: (kind: ToolKind, item: Record<string, unknown>) => Promise<void>;
  updateTool: (kind: ToolKind, id: string, patch: Record<string, unknown>) => Promise<void>;
  deleteTool: (kind: ToolKind, id: string) => Promise<void>;

  // giveaways (live)
  startGiveaway: (keyword: string) => void;
  stopGiveaway: () => void;
  drawWinner: () => void;
  resetGiveaway: () => void;

  // activity + engine hooks
  pushActivity: (kind: ActivityEvent["kind"], text: string) => void;
  respondFromChannel: (channelId: string, text: string) => boolean;
  handleIncoming: (channelId: string, username: string, text: string) => void;
  runTimers: () => void;

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

  // message groups (phrase presets) — stored on the server per user
  loadGroups: () => Promise<void>;
  clearGroups: () => void;
  addGroup: (name: string) => void;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  setActiveGroup: (id: string) => void;
  addPhrase: (groupId: string, text: string, delay?: number) => void;
  updatePhrase: (groupId: string, phraseId: string, patch: Partial<Phrase>) => void;
  removePhrase: (groupId: string, phraseId: string) => void;
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
      groups: [],
      activeGroupId: null,
      scheduleDelay: 30,
      autoEnabled: false,
      autoInterval: 180,
      messages: {},
      scheduled: [],
      conn: {},
      kickRead: { state: "idle" },

      page: "dashboard",
      commands: [],
      timers: [],
      quotes: [],
      giveaway: { active: false, keyword: "", channelId: null, entrants: [], winner: null },
      activity: [],

      setPage: (p) => set({ page: p }),

      loadTools: async () => {
        const [commands, timers, quotes] = await Promise.all([
          listItems<Command>("commands"),
          listItems<Timer>("timers"),
          listItems<Quote>("quotes"),
        ]);
        set({ commands, timers, quotes });
      },
      clearTools: () => set({ commands: [], timers: [], quotes: [] }),
      addTool: async (kind, item) => {
        const created = await addItem(kind, item);
        if (created) set((s) => ({ [kind]: [...(s[kind] as unknown[]), created] } as unknown as Partial<State>));
      },
      updateTool: async (kind, id, patch) => {
        set((s) => ({
          [kind]: (s[kind] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)),
        } as unknown as Partial<State>));
        await updateItem(kind, id, patch);
      },
      deleteTool: async (kind, id) => {
        set((s) => ({
          [kind]: (s[kind] as { id: string }[]).filter((x) => x.id !== id),
        } as unknown as Partial<State>));
        await deleteItem(kind, id);
      },

      startGiveaway: (keyword) => {
        const kw = keyword.trim() || "!enter";
        set({
          giveaway: { active: true, keyword: kw, channelId: get().activeChannelId, entrants: [], winner: null },
        });
        get().pushActivity("giveaway", `Giveaway started — type ${kw} to enter`);
      },
      stopGiveaway: () => set((s) => ({ giveaway: { ...s.giveaway, active: false } })),
      drawWinner: () => {
        const e = get().giveaway.entrants;
        if (!e.length) return;
        const w = e[Math.floor(Math.random() * e.length)];
        set((s) => ({ giveaway: { ...s.giveaway, winner: w, active: false } }));
        get().pushActivity("giveaway", `Winner drawn: ${w}`);
      },
      resetGiveaway: () =>
        set({ giveaway: { active: false, keyword: "", channelId: null, entrants: [], winner: null } }),

      pushActivity: (kind, text) =>
        set((s) => ({ activity: [{ id: uid(), ts: Date.now(), kind, text }, ...s.activity].slice(0, 150) })),

      respondFromChannel: (cId, text) => {
        const { accounts, channels } = get();
        const channel = channels.find((c) => c.id === cId);
        if (!channel || !text.trim()) return false;
        const pool = accounts.filter((a) => a.visible && a.token && a.platform === channel.platform);
        if (!pool.length) return false;
        const acc = pool[Math.floor(Math.random() * pool.length)];
        chat.send(acc, channel, text);
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
        return true;
      },

      handleIncoming: (cId, username, text) => {
        const t = text.trim();
        const low = t.toLowerCase();
        // giveaway entry
        const g = get().giveaway;
        if (g.active && g.channelId === cId && low === g.keyword.trim().toLowerCase()) {
          if (!g.entrants.includes(username)) {
            set((s) => ({ giveaway: { ...s.giveaway, entrants: [...s.giveaway.entrants, username] } }));
          }
          return;
        }
        // built-in !quote
        if (low === "!quote") {
          const qs = get().quotes;
          if (qs.length) {
            const q = qs[Math.floor(Math.random() * qs.length)];
            if (get().respondFromChannel(cId, `"${q.text}"${q.author ? ` — ${q.author}` : ""}`))
              get().pushActivity("command", `!quote answered`);
          }
          return;
        }
        // custom commands
        const cmd = get().commands.find((c) => c.enabled && low.startsWith(c.trigger.trim().toLowerCase()));
        if (cmd) {
          const now = Date.now();
          if (now - (cmdCooldown.get(cmd.id) ?? 0) < (cmd.cooldown || 0) * 1000) return;
          cmdCooldown.set(cmd.id, now);
          if (get().respondFromChannel(cId, cmd.response)) get().pushActivity("command", `${cmd.trigger} triggered`);
        }
      },

      runTimers: () => {
        const { timers, activeChannelId } = get();
        if (!activeChannelId) return;
        const now = Date.now();
        for (const tm of timers) {
          if (!tm.enabled) continue;
          if (now - (timerLastRun.get(tm.id) ?? 0) < Math.max(1, tm.intervalMin || 5) * 60000) continue;
          timerLastRun.set(tm.id, now);
          if (get().respondFromChannel(activeChannelId, tm.message))
            get().pushActivity("timer", `Timer "${tm.name}" posted`);
        }
      },

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

      loadGroups: async () => {
        const groups = await listGroups();
        set((s) => ({
          groups,
          activeGroupId: groups.find((g) => g.id === s.activeGroupId)?.id ?? groups[0]?.id ?? null,
        }));
      },
      clearGroups: () => set({ groups: [], activeGroupId: null }),
      addGroup: (name) => {
        const g: PhraseGroup = { id: uid(), name: name.trim() || "New group", phrases: [] };
        set((s) => ({ groups: [...s.groups, g], activeGroupId: g.id }));
        saveGroups(get().groups);
      },
      renameGroup: (id, name) => {
        set((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, name: name.trim() || g.name } : g)) }));
        saveGroups(get().groups);
      },
      deleteGroup: (id) => {
        set((s) => {
          const groups = s.groups.filter((g) => g.id !== id);
          return { groups, activeGroupId: s.activeGroupId === id ? groups[0]?.id ?? null : s.activeGroupId };
        });
        saveGroups(get().groups);
      },
      setActiveGroup: (id) => set({ activeGroupId: id }),
      addPhrase: (groupId, text, delay) => {
        const t = text.trim();
        if (!t) return;
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId
              ? { ...g, phrases: [...g.phrases, { id: uid(), text: t, delay: delay ?? s.scheduleDelay }] }
              : g
          ),
        }));
        saveGroups(get().groups);
      },
      updatePhrase: (groupId, phraseId, patch) => {
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId
              ? { ...g, phrases: g.phrases.map((p) => (p.id === phraseId ? { ...p, ...patch } : p)) }
              : g
          ),
        }));
        saveGroups(get().groups);
      },
      removePhrase: (groupId, phraseId) => {
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId ? { ...g, phrases: g.phrases.filter((p) => p.id !== phraseId) } : g
          ),
        }));
        saveGroups(get().groups);
      },
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
        get().pushActivity("sent", `${acc.username} → ${channel.name}: ${text.slice(0, 60)}`);
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
        const { accounts, activeChannelId, channels, groups, activeGroupId } = get();
        const channel = channels.find((c) => c.id === activeChannelId);
        const group = groups.find((g) => g.id === activeGroupId) ?? groups[0];
        const phrases = group?.phrases ?? [];
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
        page: s.page,
        // accounts (bots) and groups are NOT persisted locally — they live on the server
        activeAccountId: s.activeAccountId,
        activeGroupId: s.activeGroupId,
        channels: s.channels,
        activeChannelId: s.activeChannelId,
        scheduleDelay: s.scheduleDelay,
        autoInterval: s.autoInterval,
      }),
    }
  )
);
