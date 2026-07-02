import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import { PLATFORMS, PlatformBadge } from "./platform";
import {
  IcChevron,
  IcClock,
  IcClose,
  IcEdit,
  IcEmoji,
  IcPause,
  IcPlay,
  IcSend,
} from "./Icons";

const EMOJIS = ["😂", "💀", "🔥", "🗿", "😭", "👍", "❤️", "🎉", "😎", "🤡", "👀", "🐐", "LULW", "KEKW", "Pog", "GG"];

export function Composer({ onEditPhrases }: { onEditPhrases: () => void }) {
  const accounts = useStore((s) => s.accounts);
  const activeAccountId = useStore((s) => s.activeAccountId);
  const setActiveAccount = useStore((s) => s.setActiveAccount);
  const channels = useStore((s) => s.channels);
  const activeChannelId = useStore((s) => s.activeChannelId);
  const phrases = useStore((s) => s.phrases);
  const scheduleDelay = useStore((s) => s.scheduleDelay);
  const scheduled = useStore((s) => s.scheduled);
  const cancelScheduled = useStore((s) => s.cancelScheduled);
  const sendNow = useStore((s) => s.sendNow);
  const schedule = useStore((s) => s.schedule);
  const autoEnabled = useStore((s) => s.autoEnabled);
  const setAutoEnabled = useStore((s) => s.setAutoEnabled);
  const autoInterval = useStore((s) => s.autoInterval);
  const setAutoInterval = useStore((s) => s.setAutoInterval);

  const [text, setText] = useState("");
  const [now, setNow] = useState(Date.now());
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scheduled.length === 0) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [scheduled.length]);

  const view = useStore((s) => s.view);
  const channel = channels.find((c) => c.id === activeChannelId) ?? null;
  const platform = channel?.platform ?? null;
  // scope to the active channel's platform, or the current tab when none is open
  const scope = platform ?? view;
  const eligible = accounts.filter((a) => a.platform === scope);
  const activeAcc = accounts.find((a) => a.id === activeAccountId);
  const sender =
    activeAcc && platform && activeAcc.platform === platform ? activeAcc : eligible[0] ?? null;
  const canSend = !!channel && !!sender;

  const doSend = () => {
    if (!canSend || !text.trim() || !sender) return;
    sendNow(sender.id, text.trim());
    setText("");
    inputRef.current?.focus();
  };
  const doSchedule = () => {
    if (!canSend || !text.trim() || !sender) return;
    schedule(sender.id, text.trim(), scheduleDelay);
    toast(`Scheduled "${text.trim()}" in ${scheduleDelay}s`);
    setText("");
    inputRef.current?.focus();
  };
  const schedulePhrase = (phraseText: string, delay: number) => {
    if (!canSend || !sender) return;
    schedule(sender.id, phraseText, delay);
    toast(`Scheduled "${phraseText}" in ${delay}s`);
  };

  return (
    <div className="border-t border-line bg-bg-panel">
      {/* scheduled countdown rows */}
      {scheduled.map((s) => {
        const remain = Math.max(0, Math.ceil((s.fireAt - now) / 1000));
        return (
          <div
            key={s.id}
            className="flex items-center gap-2 border-b border-line/60 px-4 py-1.5 text-[12px] text-muted animate-fade-in"
          >
            <IcClock width={13} height={13} className="text-brand-soft" />
            <span className="tabular-nums font-medium text-brand-soft">{remain}s</span>
            <span className="text-muted/60">·</span>
            <PlatformBadge platform={s.platform} size={12} />
            <span className="text-slate-300">{s.accountName}</span>
            <span className="text-muted/60">→ {s.channelName}</span>
            <span className="text-muted/60">·</span>
            <span className="truncate text-slate-200">{s.text}</span>
            <button
              onClick={() => cancelScheduled(s.id)}
              className="ml-auto rounded p-0.5 text-muted hover:text-red-400"
              title="Cancel"
            >
              <IcClose width={13} height={13} />
            </button>
          </div>
        );
      })}

      {/* auto row */}
      <div className="flex items-center gap-3 px-4 py-2 text-[12px]">
        <button
          onClick={() => setAutoEnabled(!autoEnabled)}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors ${
            autoEnabled
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-white/5 text-muted hover:text-slate-200"
          }`}
        >
          {autoEnabled ? <IcPause width={12} height={12} /> : <IcPlay width={12} height={12} />}
          Auto {autoEnabled ? "ON" : "OFF"}
        </button>
        <span className="text-muted">every</span>
        <input
          type="number"
          min={1}
          value={autoInterval}
          onChange={(e) => setAutoInterval(Number(e.target.value))}
          className="w-16 rounded-md border border-line bg-bg-soft px-2 py-1 text-center text-slate-100 outline-none focus:border-brand/60"
        />
        <span className="text-muted">sec · random account · your custom phrases only</span>
      </div>

      {/* quick phrases */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
        <button
          onClick={onEditPhrases}
          className="flex items-center gap-1 rounded-md border border-line bg-bg-soft px-2 py-1 text-[12px] font-medium text-muted hover:text-slate-200"
        >
          <IcEdit width={12} height={12} /> Edit
        </button>
        {phrases.map((p) => (
          <button
            key={p.id}
            onClick={() => schedulePhrase(p.text, p.delay)}
            disabled={!canSend}
            title={`Schedule in ${p.delay}s`}
            className="group flex items-center gap-1.5 rounded-md border border-line bg-bg-soft px-2 py-1 text-[12px] text-slate-200 hover:border-brand/50 hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="font-medium">{p.text}</span>
            <span className="flex items-center gap-0.5 text-[10px] text-muted group-hover:text-brand-soft">
              <IcClock width={10} height={10} />
              {p.delay}s
            </span>
          </button>
        ))}
      </div>

      {/* message input */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-1">
        {/* account selector (same platform as active channel) */}
        <div className="relative">
          <button
            onClick={() => setAcctOpen((v) => !v)}
            disabled={eligible.length === 0}
            className="flex w-44 items-center justify-between gap-1 rounded-lg border border-line bg-bg-soft px-2.5 py-2 text-sm text-slate-200 hover:border-brand/40 disabled:opacity-40"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {sender && <PlatformBadge platform={sender.platform} />}
              <span className="truncate">
                {sender ? sender.username : `No ${PLATFORMS[scope].label} account`}
              </span>
            </span>
            <IcChevron width={14} height={14} className="shrink-0 text-muted" />
          </button>
          {acctOpen && eligible.length > 0 && (
            <div className="absolute bottom-full left-0 z-20 mb-1 w-full overflow-hidden rounded-lg border border-line bg-bg-elev shadow-xl animate-fade-in">
              {eligible.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setActiveAccount(a.id);
                    setAcctOpen(false);
                  }}
                  className={`flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm hover:bg-white/5 ${
                    a.id === sender?.id ? "text-brand-soft" : "text-slate-200"
                  }`}
                >
                  <PlatformBadge platform={a.platform} />
                  {a.username}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* text field */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                doSend();
              }
            }}
            placeholder={
              channel
                ? sender
                  ? `Message ${channel.name}`
                  : `Add a ${PLATFORMS[channel.platform].label} account to chat here`
                : "Join a channel first"
            }
            disabled={!canSend}
            className="w-full rounded-lg border border-line bg-bg-soft px-3 py-2 pr-10 text-sm text-slate-100 placeholder:text-muted/60 outline-none focus:border-brand/60 disabled:opacity-50"
          />
          <button
            onClick={() => setEmojiOpen((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-slate-200"
          >
            <IcEmoji width={16} height={16} />
          </button>
          {emojiOpen && (
            <div className="absolute bottom-full right-0 z-20 mb-1 grid w-56 grid-cols-6 gap-1 rounded-lg border border-line bg-bg-elev p-2 shadow-xl animate-fade-in">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setText((t) => t + (e.length > 2 ? ` ${e} ` : e));
                    setEmojiOpen(false);
                    inputRef.current?.focus();
                  }}
                  className="rounded p-1 text-center text-sm hover:bg-white/10"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* schedule button */}
        <button
          onClick={doSchedule}
          disabled={!canSend || !text.trim()}
          title={`Schedule in ${scheduleDelay}s`}
          className="flex items-center justify-center rounded-lg border border-line bg-bg-soft p-2.5 text-muted hover:border-brand/40 hover:text-brand-soft disabled:opacity-40"
        >
          <IcClock width={17} height={17} />
        </button>

        {/* send */}
        <button
          onClick={doSend}
          disabled={!canSend || !text.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IcSend width={15} height={15} />
          Send
        </button>
      </div>
    </div>
  );
}
