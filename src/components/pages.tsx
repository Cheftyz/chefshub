import { useState, type ReactNode } from "react";
import { useStore } from "../lib/store";
import { PLATFORMS, PlatformBadge } from "./platform";
import type { Command, Timer, Quote } from "../lib/types";
import {
  IcMessage,
  IcTerminal,
  IcAlarm,
  IcQuote,
  IcGift,
  IcPlus,
  IcTrash,
  IcActivity,
  IcSend,
  IcUsers,
} from "./Icons";

const card = "rounded-2xl border border-white/10 bg-black/20 backdrop-blur-2xl";
const input =
  "w-full rounded-lg border border-line bg-bg-soft px-3 py-2 text-sm text-slate-100 placeholder:text-muted/70 outline-none focus:border-brand/70 focus:ring-1 focus:ring-brand/40";
const label = "mb-1 block text-[12px] font-medium uppercase tracking-wide text-muted";
const btn =
  "flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-brand-ink hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40";

function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-start gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold text-slate-100">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="ml-auto">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-brand" : "bg-line"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

// ---------------------------------- Dashboard ----------------------------------
export function DashboardPage({
  onAddAccount,
  onJoinChannel,
}: {
  onAddAccount: () => void;
  onJoinChannel: () => void;
}) {
  const view = useStore((s) => s.view);
  const setPage = useStore((s) => s.setPage);
  const accounts = useStore((s) => s.accounts).filter((a) => a.platform === view);
  const channels = useStore((s) => s.channels).filter((c) => c.platform === view);
  const commands = useStore((s) => s.commands);
  const timers = useStore((s) => s.timers);
  const quotes = useStore((s) => s.quotes);
  const activity = useStore((s) => s.activity);
  const label = PLATFORMS[view].label;

  if (accounts.length === 0 && channels.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className={`${card} mx-auto flex max-w-3xl flex-col items-center px-8 py-14 text-center`}>
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-brand/20 bg-brand/10 text-brand">
            <IcMessage width={34} height={34} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-slate-100">Welcome to MB Chatters</h1>
          <p className="mt-1.5 text-sm text-muted">
            Connect your {label} account and channel to get started.
          </p>
          <div className="mt-7 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={onAddAccount} className={`${card} flex items-start gap-3 p-4 text-left hover:border-brand/40`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <IcUsers width={18} height={18} />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-100">Add Your Account</div>
                <div className="text-[12px] text-muted">Connect your {label} account to unlock all features.</div>
              </div>
            </button>
            <button onClick={onJoinChannel} className={`${card} flex items-start gap-3 p-4 text-left hover:border-brand/40`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <IcMessage width={18} height={18} />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-100">Add a Channel</div>
                <div className="text-[12px] text-muted">Link a channel to start chatting and managing.</div>
              </div>
            </button>
          </div>
          <button onClick={onAddAccount} className={`${btn} mt-7 px-5 py-2.5`}>
            <IcPlus width={16} height={16} /> Add {label} Account
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Accounts", value: accounts.length, icon: <IcUsers width={18} height={18} /> },
    { label: "Channels", value: channels.length, icon: <IcMessage width={18} height={18} /> },
    { label: "Commands", value: commands.length, icon: <IcTerminal width={18} height={18} /> },
    { label: "Timers", value: timers.filter((t) => t.enabled).length, icon: <IcAlarm width={18} height={18} /> },
    { label: "Quotes", value: quotes.length, icon: <IcQuote width={18} height={18} /> },
  ];

  return (
    <PageShell title="Dashboard" subtitle={`Your ${label} chat at a glance.`}>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className={`${card} p-4`}>
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">{s.icon}</div>
            <div className="font-display text-2xl font-semibold text-slate-100">{s.value}</div>
            <div className="text-[12px] text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`${card} p-4`}>
          <div className="mb-3 text-sm font-semibold text-slate-100">Quick actions</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPage("chat")} className="rounded-lg border border-line bg-bg-soft px-3 py-2.5 text-left text-[13px] text-slate-200 hover:border-brand/40">Open chat →</button>
            <button onClick={() => setPage("commands")} className="rounded-lg border border-line bg-bg-soft px-3 py-2.5 text-left text-[13px] text-slate-200 hover:border-brand/40">Manage commands →</button>
            <button onClick={() => setPage("timers")} className="rounded-lg border border-line bg-bg-soft px-3 py-2.5 text-left text-[13px] text-slate-200 hover:border-brand/40">Set up timers →</button>
            <button onClick={() => setPage("giveaways")} className="rounded-lg border border-line bg-bg-soft px-3 py-2.5 text-left text-[13px] text-slate-200 hover:border-brand/40">Run a giveaway →</button>
          </div>
        </div>
        <div className={`${card} p-4`}>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <IcActivity width={16} height={16} className="text-brand" /> Recent activity
          </div>
          {activity.length === 0 ? (
            <p className="py-4 text-[13px] text-muted">Nothing yet — send a message or run a tool.</p>
          ) : (
            <div className="space-y-1.5">
              {activity.slice(0, 6).map((a) => (
                <div key={a.id} className="truncate text-[13px] text-slate-300">
                  {a.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

// ---------------------------------- Activity ----------------------------------
const KIND_META: Record<string, { color: string; icon: ReactNode }> = {
  sent: { color: "text-brand", icon: <IcSend width={14} height={14} /> },
  command: { color: "text-sky-400", icon: <IcTerminal width={14} height={14} /> },
  timer: { color: "text-amber-400", icon: <IcAlarm width={14} height={14} /> },
  giveaway: { color: "text-pink-400", icon: <IcGift width={14} height={14} /> },
  system: { color: "text-muted", icon: <IcActivity width={14} height={14} /> },
};

export function ActivityPage() {
  const activity = useStore((s) => s.activity);
  return (
    <PageShell title="Activity" subtitle="Everything MB Chatters has done recently.">
      <div className={`${card} divide-y divide-line/60`}>
        {activity.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No activity yet.</p>
        ) : (
          activity.map((a) => {
            const meta = KIND_META[a.kind] ?? KIND_META.system;
            return (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`shrink-0 ${meta.color}`}>{meta.icon}</span>
                <span className="flex-1 truncate text-[13px] text-slate-200">{a.text}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted/60">
                  {new Date(a.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </PageShell>
  );
}

// ---------------------------------- Commands ----------------------------------
export function CommandsPage() {
  const commands = useStore((s) => s.commands);
  const addTool = useStore((s) => s.addTool);
  const updateTool = useStore((s) => s.updateTool);
  const deleteTool = useStore((s) => s.deleteTool);
  const [trigger, setTrigger] = useState("");
  const [response, setResponse] = useState("");
  const [cooldown, setCooldown] = useState(5);

  const add = () => {
    if (!trigger.trim() || !response.trim()) return;
    addTool("commands", { trigger: trigger.trim(), response: response.trim(), cooldown, enabled: true });
    setTrigger("");
    setResponse("");
  };

  return (
    <PageShell title="Commands" subtitle="Auto-reply when someone types a trigger in chat. Built-in: !quote">
      <div className={`${card} mb-4 p-4`}>
        <div className="grid gap-3 sm:grid-cols-[160px_1fr_120px]">
          <div>
            <label className={label}>Trigger</label>
            <input className={input} placeholder="!discord" value={trigger} onChange={(e) => setTrigger(e.target.value)} />
          </div>
          <div>
            <label className={label}>Response</label>
            <input className={input} placeholder="Join us: discord.gg/…" value={response} onChange={(e) => setResponse(e.target.value)} />
          </div>
          <div>
            <label className={label}>Cooldown (s)</label>
            <input className={input} type="number" min={0} value={cooldown} onChange={(e) => setCooldown(Math.max(0, Number(e.target.value)))} />
          </div>
        </div>
        <button onClick={add} disabled={!trigger.trim() || !response.trim()} className={`${btn} mt-3`}>
          <IcPlus width={15} height={15} /> Add command
        </button>
      </div>

      <div className={`${card} divide-y divide-line/60`}>
        {commands.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No commands yet.</p>
        ) : (
          commands.map((c: Command) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <Toggle on={c.enabled} onClick={() => updateTool("commands", c.id, { enabled: !c.enabled })} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-brand-soft">{c.trigger}</span>
                  <span className="text-[11px] text-muted">{c.cooldown}s cd</span>
                </div>
                <div className="truncate text-[13px] text-slate-300">{c.response}</div>
              </div>
              <button onClick={() => deleteTool("commands", c.id)} className="rounded-md p-1.5 text-muted hover:text-red-400">
                <IcTrash width={15} height={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </PageShell>
  );
}

// ---------------------------------- Timers ----------------------------------
export function TimersPage() {
  const timers = useStore((s) => s.timers);
  const addTool = useStore((s) => s.addTool);
  const updateTool = useStore((s) => s.updateTool);
  const deleteTool = useStore((s) => s.deleteTool);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [intervalMin, setIntervalMin] = useState(10);

  const add = () => {
    if (!message.trim()) return;
    addTool("timers", { name: name.trim() || "Timer", message: message.trim(), intervalMin, enabled: true });
    setName("");
    setMessage("");
  };

  return (
    <PageShell title="Timers" subtitle="Post a recurring message to the active channel on a schedule.">
      <div className={`${card} mb-4 p-4`}>
        <div className="grid gap-3 sm:grid-cols-[160px_1fr_130px]">
          <div>
            <label className={label}>Name</label>
            <input className={input} placeholder="Socials" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={label}>Message</label>
            <input className={input} placeholder="Follow for more!" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div>
            <label className={label}>Every (min)</label>
            <input className={input} type="number" min={1} value={intervalMin} onChange={(e) => setIntervalMin(Math.max(1, Number(e.target.value)))} />
          </div>
        </div>
        <button onClick={add} disabled={!message.trim()} className={`${btn} mt-3`}>
          <IcPlus width={15} height={15} /> Add timer
        </button>
      </div>

      <div className={`${card} divide-y divide-line/60`}>
        {timers.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No timers yet.</p>
        ) : (
          timers.map((t: Timer) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <Toggle on={t.enabled} onClick={() => updateTool("timers", t.id, { enabled: !t.enabled })} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-slate-100">{t.name}</span>
                  <span className="text-[11px] text-muted">every {t.intervalMin}m</span>
                </div>
                <div className="truncate text-[13px] text-slate-300">{t.message}</div>
              </div>
              <button onClick={() => deleteTool("timers", t.id)} className="rounded-md p-1.5 text-muted hover:text-red-400">
                <IcTrash width={15} height={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </PageShell>
  );
}

// ---------------------------------- Quotes ----------------------------------
export function QuotesPage() {
  const quotes = useStore((s) => s.quotes);
  const addTool = useStore((s) => s.addTool);
  const deleteTool = useStore((s) => s.deleteTool);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");

  const add = () => {
    if (!text.trim()) return;
    addTool("quotes", { text: text.trim(), author: author.trim(), addedAt: Date.now() });
    setText("");
    setAuthor("");
  };

  return (
    <PageShell title="Quotes" subtitle="Saved quotes. Viewers can pull a random one with !quote in chat.">
      <div className={`${card} mb-4 p-4`}>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div>
            <label className={label}>Quote</label>
            <input className={input} placeholder="Something memorable…" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div>
            <label className={label}>Author (optional)</label>
            <input className={input} placeholder="who said it" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
        </div>
        <button onClick={add} disabled={!text.trim()} className={`${btn} mt-3`}>
          <IcPlus width={15} height={15} /> Add quote
        </button>
      </div>

      <div className={`${card} divide-y divide-line/60`}>
        {quotes.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No quotes yet.</p>
        ) : (
          quotes.map((q: Quote, i) => (
            <div key={q.id} className="flex items-center gap-3 px-4 py-3">
              <span className="shrink-0 font-mono text-[12px] text-muted/60">#{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-slate-200">“{q.text}”</div>
                {q.author && <div className="text-[12px] text-muted">— {q.author}</div>}
              </div>
              <button onClick={() => deleteTool("quotes", q.id)} className="rounded-md p-1.5 text-muted hover:text-red-400">
                <IcTrash width={15} height={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </PageShell>
  );
}

// ---------------------------------- Giveaways ----------------------------------
export function GiveawaysPage() {
  const giveaway = useStore((s) => s.giveaway);
  const start = useStore((s) => s.startGiveaway);
  const stop = useStore((s) => s.stopGiveaway);
  const draw = useStore((s) => s.drawWinner);
  const reset = useStore((s) => s.resetGiveaway);
  const activeChannelId = useStore((s) => s.activeChannelId);
  const channels = useStore((s) => s.channels);
  const [keyword, setKeyword] = useState("!enter");

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <PageShell title="Giveaways" subtitle="Viewers type a keyword to enter; draw a random winner.">
      {!giveaway.active && !giveaway.winner && (
        <div className={`${card} p-5`}>
          <label className={label}>Entry keyword</label>
          <div className="flex gap-2">
            <input className={input} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="!enter" />
            <button onClick={() => start(keyword)} disabled={!activeChannel} className={btn}>
              <IcGift width={15} height={15} /> Start
            </button>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            {activeChannel ? (
              <>Collecting from <span className="text-slate-300">{activeChannel.name}</span> — anyone who types the keyword is entered.</>
            ) : (
              "Join a channel first to run a giveaway."
            )}
          </p>
        </div>
      )}

      {giveaway.active && (
        <div className={`${card} p-6 text-center`}>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand/15 px-3 py-1 text-[12px] font-semibold text-brand">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> LIVE
          </div>
          <div className="font-display text-4xl font-bold text-slate-100">{giveaway.entrants.length}</div>
          <div className="text-sm text-muted">
            entrants — type <span className="font-mono text-brand-soft">{giveaway.keyword}</span> to join
          </div>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={draw} disabled={!giveaway.entrants.length} className={btn}>
              🎲 Draw winner
            </button>
            <button onClick={stop} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:text-slate-200">
              Stop
            </button>
          </div>
          {giveaway.entrants.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {giveaway.entrants.slice(-40).map((e) => (
                <span key={e} className="rounded-md bg-white/5 px-2 py-0.5 text-[12px] text-slate-300">{e}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {giveaway.winner && (
        <div className={`${card} p-8 text-center`}>
          <div className="text-[13px] uppercase tracking-wide text-muted">Winner</div>
          <div className="mt-1 font-display text-4xl font-bold text-brand">🎉 {giveaway.winner}</div>
          <div className="mt-2 text-sm text-muted">out of {giveaway.entrants.length} entrants</div>
          <div className="mt-5 flex justify-center gap-2">
            {giveaway.entrants.length > 1 && (
              <button onClick={draw} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-slate-200 hover:border-brand/40">
                Re-draw
              </button>
            )}
            <button onClick={reset} className={btn}>New giveaway</button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
