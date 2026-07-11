import { useEffect, useRef, useState } from "react";
import { useStore, colorFor } from "../lib/store";
import { PLATFORMS, PlatformBadge } from "./platform";
import { IcMessage } from "./Icons";
import { fetchLive, formatViewers, type LiveInfo } from "../lib/live";
import type { ChatMessage } from "../lib/types";

function timeStr(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatArea() {
  const view = useStore((s) => s.view);
  const channels = useStore((s) => s.channels).filter((c) => c.platform === view);
  const activeChannelId = useStore((s) => s.activeChannelId);
  const setActiveChannel = useStore((s) => s.setActiveChannel);
  const messages = useStore((s) => (s.activeChannelId ? s.messages[s.activeChannelId] : undefined));
  const accounts = useStore((s) => s.accounts);
  const conn = useStore((s) => s.conn);
  const kickRead = useStore((s) => s.kickRead);

  const active = channels.find((c) => c.id === activeChannelId) ?? channels[0];

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length, activeChannelId]);

  // poll live channel info (viewers / title / is-live)
  const [live, setLive] = useState<LiveInfo | null>(null);
  const activePlatform = active?.platform;
  const activeName = active?.name;
  useEffect(() => {
    if (!activePlatform || !activeName) {
      setLive(null);
      return;
    }
    let cancelled = false;
    setLive(null);
    const load = async () => {
      const d = await fetchLive(activePlatform, activeName);
      if (!cancelled) setLive(d);
    };
    load();
    const t = setInterval(load, 45000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activePlatform, activeName]);

  // ---- no channels at all: full-area prompt ----
  if (channels.length === 0 || !active) {
    const label = PLATFORMS[view].label;
    return (
      <div className="flex flex-1 items-center justify-center p-3">
        <div className="flex flex-col items-center rounded-3xl border border-white/10 bg-black/20 px-12 py-14 text-center backdrop-blur-2xl">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <IcMessage width={28} height={28} />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">No {label} channels yet</h2>
          <p className="mt-1 text-sm text-muted">Add a {label} channel from the sidebar to start.</p>
        </div>
      </div>
    );
  }

  const chAccounts = accounts.filter((a) => a.platform === active.platform && a.token);

  // connection status for the active channel
  let tone: "connected" | "connecting" | "none" = "connecting";
  let statusText = "connecting…";
  if (chAccounts.length === 0) {
    tone = "none";
    statusText = "no bots yet";
  } else if (active.platform === "twitch") {
    const open = chAccounts.filter((a) => conn[a.id]?.state === "open").length;
    tone = open > 0 ? "connected" : "connecting";
    statusText = open > 0 ? `${open} connected` : "connecting…";
  } else {
    tone = kickRead.state === "open" ? "connected" : "connecting";
    statusText = kickRead.state === "open" ? "connected" : "connecting…";
  }
  const dot = tone === "connected" ? "bg-brand" : tone === "none" ? "bg-slate-600" : "bg-amber-400 animate-pulse";
  const openUrl =
    active.platform === "twitch" ? `https://twitch.tv/${active.name}` : `https://kick.com/${active.name}`;

  const isLive = live?.live === true;
  const subtitle = isLive
    ? live?.title || (live?.game ? `Playing ${live.game}` : "")
    : live?.live === false
    ? "Offline"
    : "";

  const list = messages ?? [];
  const hasContent = list.some((m) => !m.system);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3">
      {/* channel info header */}
      <header className="flex h-16 shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 backdrop-blur-2xl">
        <PlatformBadge platform={active.platform} size={20} />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-[15px] font-semibold text-slate-100">{active.name}</span>
            {isLive ? (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                LIVE
                {live?.viewers != null && (
                  <span className="font-medium text-red-300/90">· {formatViewers(live.viewers)}</span>
                )}
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                {statusText}
              </span>
            )}
          </div>
          {subtitle && <span className="truncate text-[12px] text-muted">{subtitle}</span>}
        </div>

        {channels.length > 1 && (
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto scrollbar-thin">
            {channels.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveChannel(c.id)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-medium ${
                  c.id === active.id ? "bg-brand/15 text-brand" : "text-muted hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-[12px] font-medium text-muted hover:border-brand/40 hover:text-brand-soft"
        >
          Open ↗
        </a>
      </header>

      {/* messages — black-glass card */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/25 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
        {!hasContent ? (
          <ChannelEmptyState channelName={active.name} platform={active.platform} tone={tone} />
        ) : (
          <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
            {list.map((m, i) => (
              <MessageRow key={m.id} m={m} prev={list[i - 1]} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelEmptyState({
  channelName,
  platform,
  tone,
}: {
  channelName: string;
  platform: "twitch" | "kick";
  tone: "connected" | "connecting" | "none";
}) {
  const line =
    tone === "none"
      ? "Add a bot in the sidebar, then send a message."
      : tone === "connecting"
      ? "Connecting to chat…"
      : "Connected — waiting for messages.";
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-brand">
        <PlatformBadge platform={platform} size={26} />
      </div>
      <h3 className="font-display text-lg font-semibold text-slate-100">{channelName}</h3>
      <p className="mt-1 text-sm text-muted">{line}</p>
    </div>
  );
}

function MessageRow({ m, prev }: { m: ChatMessage; prev?: ChatMessage }) {
  if (m.system) {
    return (
      <div className="my-1 flex justify-center">
        <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[12px] italic text-muted">{m.text}</span>
      </div>
    );
  }

  const color = colorFor(m.username, m.color);
  const grouped =
    prev && !prev.system && prev.username === m.username && m.ts - prev.ts < 60000;

  return (
    <div
      className={`group flex gap-2.5 rounded-lg px-2 ${grouped ? "py-[1px]" : "mt-1 py-1"} hover:bg-white/[0.03] ${
        m.self ? "bg-brand/[0.05]" : ""
      }`}
    >
      {grouped ? (
        <span className="w-7 shrink-0 select-none pt-0.5 text-right text-[10px] tabular-nums text-muted/40 opacity-0 group-hover:opacity-100">
          {timeStr(m.ts)}
        </span>
      ) : (
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {(m.displayName || m.username || "?").charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="truncate font-semibold" style={{ color }}>
              {m.displayName}
            </span>
            {m.self && (
              <span className="rounded bg-brand/20 px-1 text-[9px] font-semibold uppercase text-brand">you</span>
            )}
            <span className="text-[11px] tabular-nums text-muted/60">{timeStr(m.ts)}</span>
          </div>
        )}
        <div className="break-words text-[14px] leading-snug text-slate-200">{m.text}</div>
      </div>
    </div>
  );
}
