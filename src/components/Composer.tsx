import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import { PLATFORMS, PlatformBadge } from "./platform";
import {
  IcCheck,
  IcChevron,
  IcClock,
  IcClose,
  IcEdit,
  IcEmoji,
  IcLayers,
  IcPause,
  IcPlay,
  IcPlus,
  IcSend,
  IcUsers,
} from "./Icons";

const EMOJIS = ["😂", "💀", "🔥", "🗿", "😭", "👍", "❤️", "🎉", "😎", "🤡", "👀", "🐐"];
// global Twitch emotes — render for everyone when sent as text
const TWITCH_EMOTES = [
  "Kappa", "PogChamp", "LUL", "Kreygasm", "4Head", "BibleThump", "SeemsGood", "NotLikeThis",
  "WutFace", "DansGame", "cmonBruh", "Jebaited", "KappaPride", "TriHard", "VoHiYo", "HeyGuys",
  "EleGiggle", "FailFish", "ResidentSleeper", "SwiftRage", "BabyRage", "PJSalt", "MrDestructoid", "CoolCat",
];

export function Composer({ onEditPhrases }: { onEditPhrases: () => void }) {
  const accounts = useStore((s) => s.accounts);
  const activeAccountId = useStore((s) => s.activeAccountId);
  const setActiveAccount = useStore((s) => s.setActiveAccount);
  const channels = useStore((s) => s.channels);
  const activeChannelId = useStore((s) => s.activeChannelId);
  const groups = useStore((s) => s.groups);
  const activeGroupId = useStore((s) => s.activeGroupId);
  const setActiveGroup = useStore((s) => s.setActiveGroup);
  const scheduleDelay = useStore((s) => s.scheduleDelay);
  const scheduled = useStore((s) => s.scheduled);
  const cancelScheduled = useStore((s) => s.cancelScheduled);
  const sendNow = useStore((s) => s.sendNow);
  const schedule = useStore((s) => s.schedule);
  const autoEnabled = useStore((s) => s.autoEnabled);
  const setAutoEnabled = useStore((s) => s.setAutoEnabled);
  const autoInterval = useStore((s) => s.autoInterval);
  const setAutoInterval = useStore((s) => s.setAutoInterval);
  const view = useStore((s) => s.view);

  const [text, setText] = useState("");
  const [now, setNow] = useState(Date.now());
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"emoji" | "twitch">("emoji");
  const [acctOpen, setAcctOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [broadcast, setBroadcast] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [stagger, setStagger] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scheduled.length === 0) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [scheduled.length]);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null;
  const phrases = activeGroup?.phrases ?? [];

  const channel = channels.find((c) => c.id === activeChannelId) ?? null;
  const platform = channel?.platform ?? null;
  const scope = platform ?? view;
  const eligible = accounts.filter((a) => a.platform === scope);
  const activeAcc = accounts.find((a) => a.id === activeAccountId);
  const sender = activeAcc && platform && activeAcc.platform === platform ? activeAcc : eligible[0] ?? null;

  // who a send goes to: the selected set in broadcast mode, else the single sender
  const targets = broadcast
    ? selected.filter((id) => eligible.some((a) => a.id === id))
    : sender
    ? [sender.id]
    : [];
  const canSend = !!channel && targets.length > 0;

  const toggleBroadcast = () => {
    setBroadcast((v) => {
      const next = !v;
      if (next && selected.length === 0) setSelected(eligible.map((a) => a.id));
      return next;
    });
  };
  const toggleAcc = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const doSend = () => {
    if (!canSend || !text.trim()) return;
    const t = text.trim();
    targets.forEach((id, i) => {
      const extra = i * stagger;
      if (extra > 0) schedule(id, t, extra);
      else sendNow(id, t);
    });
    if (broadcast && targets.length > 1)
      toast(`Sent from ${targets.length} accounts${stagger ? ` (staggered ${stagger}s)` : ""}`);
    setText("");
    inputRef.current?.focus();
  };
  const doSchedule = () => {
    if (!canSend || !text.trim()) return;
    const t = text.trim();
    targets.forEach((id, i) => schedule(id, t, scheduleDelay + i * stagger));
    toast(`Scheduled from ${targets.length} account${targets.length > 1 ? "s" : ""} in ${scheduleDelay}s`);
    setText("");
    inputRef.current?.focus();
  };
  const schedulePhrase = (phraseText: string, delay: number) => {
    if (!canSend) return;
    targets.forEach((id, i) => schedule(id, phraseText, delay + i * stagger));
    toast(
      targets.length > 1
        ? `Scheduled "${phraseText}" from ${targets.length} accounts`
        : `Scheduled "${phraseText}" in ${delay}s`
    );
  };

  return (
    <div className="border-t border-white/5 bg-bg-panel/50 backdrop-blur-2xl">
      {/* toolbar: message group + auto */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="relative">
          <button
            onClick={() => setGroupOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-line bg-bg-soft px-2.5 py-1.5 text-[13px] text-slate-100 hover:border-brand/40"
          >
            <IcLayers width={14} height={14} className="text-brand" />
            <span className="font-medium">{activeGroup ? activeGroup.name : "No group"}</span>
            <span className="rounded bg-white/5 px-1 text-[10px] tabular-nums text-muted">{phrases.length}</span>
            <IcChevron width={13} height={13} className="text-muted" />
          </button>
          {groupOpen && (
            <div className="absolute bottom-full left-0 z-30 mb-1 w-52 overflow-hidden rounded-lg border border-line bg-bg-elev shadow-card animate-fade-in">
              <div className="max-h-56 overflow-y-auto scrollbar-thin py-1">
                {groups.length === 0 && (
                  <p className="px-3 py-2 text-[12px] italic text-muted/70">No groups yet</p>
                )}
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setActiveGroup(g.id);
                      setGroupOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-white/5 ${
                      g.id === activeGroup?.id ? "text-brand-soft" : "text-slate-200"
                    }`}
                  >
                    <span className="truncate">{g.name}</span>
                    <span className="text-[10px] tabular-nums text-muted">{g.phrases.length}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setGroupOpen(false);
                  onEditPhrases();
                }}
                className="flex w-full items-center gap-1.5 border-t border-line px-3 py-2 text-left text-[12px] font-medium text-brand-soft hover:bg-white/5"
              >
                <IcPlus width={13} height={13} /> New / manage groups
              </button>
            </div>
          )}
        </div>

        {/* broadcast toggle */}
        <button
          onClick={toggleBroadcast}
          title="Send from multiple accounts at once"
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
            broadcast ? "bg-brand/15 text-brand" : "border border-line bg-bg-soft text-muted hover:text-slate-200"
          }`}
        >
          <IcUsers width={14} height={14} />
          Broadcast
          {broadcast && targets.length > 0 && (
            <span className="rounded bg-brand/20 px-1 text-[10px] tabular-nums text-brand">{targets.length}</span>
          )}
        </button>

        {/* auto controls */}
        <div className="ml-auto flex items-center gap-2 text-[12px]">
          <button
            onClick={() => setAutoEnabled(!autoEnabled)}
            title="Auto-send random phrases from the active group"
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors ${
              autoEnabled ? "bg-brand/15 text-brand" : "bg-white/5 text-muted hover:text-slate-200"
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
            className="w-14 rounded-md border border-line bg-bg-soft px-2 py-1 text-center text-slate-100 outline-none focus:border-brand/60"
          />
          <span className="text-muted">s</span>
        </div>
      </div>

      {/* broadcast: pick which accounts */}
      {broadcast && (
        <div className="border-t border-line/60 px-3 py-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="font-medium text-slate-200">
              Send from {targets.length}/{eligible.length} {PLATFORMS[scope].label} account
              {eligible.length === 1 ? "" : "s"}
            </span>
            <button onClick={() => setSelected(eligible.map((a) => a.id))} className="text-muted hover:text-slate-200">
              Select all
            </button>
            <button onClick={() => setSelected([])} className="text-muted hover:text-slate-200">
              Clear
            </button>
            <div className="ml-auto flex items-center gap-1.5 text-muted">
              <span>stagger</span>
              <input
                type="number"
                min={0}
                value={stagger}
                onChange={(e) => setStagger(Math.max(0, Number(e.target.value)))}
                className="w-14 rounded-md border border-line bg-bg-soft px-2 py-1 text-center text-slate-100 outline-none focus:border-brand/60"
              />
              <span>s apart</span>
            </div>
          </div>
          {eligible.length === 0 ? (
            <p className="text-[12px] italic text-muted/70">
              No {PLATFORMS[scope].label} accounts — add bots in the sidebar.
            </p>
          ) : (
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto scrollbar-thin">
              {eligible.map((a) => {
                const on = selected.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAcc(a.id)}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] ${
                      on ? "border-brand/60 bg-brand/10 text-slate-100" : "border-line text-muted hover:text-slate-200"
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
                        on ? "border-brand bg-brand text-brand-ink" : "border-line"
                      }`}
                    >
                      {on && <IcCheck width={10} height={10} />}
                    </span>
                    {a.username}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* quick phrases for the active group */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
        <button
          onClick={onEditPhrases}
          className="flex items-center gap-1 rounded-md border border-line bg-bg-soft px-2 py-1 text-[12px] font-medium text-muted hover:text-slate-200"
        >
          <IcEdit width={12} height={12} /> Edit
        </button>
        {phrases.length === 0 && (
          <span className="px-1 text-[12px] italic text-muted/70">
            No phrases in this group — click Edit to add some.
          </span>
        )}
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

      {/* scheduled queue (chips) */}
      {scheduled.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto border-t border-line/60 px-3 py-2 scrollbar-thin">
          {scheduled.map((s) => {
            const remain = Math.max(0, Math.ceil((s.fireAt - now) / 1000));
            return (
              <div
                key={s.id}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-bg-soft py-1 pl-2 pr-1 text-[11px] animate-fade-in"
              >
                <IcClock width={11} height={11} className="text-brand" />
                <span className="tabular-nums font-semibold text-brand">{remain}s</span>
                <PlatformBadge platform={s.platform} size={11} />
                <span className="max-w-[140px] truncate text-slate-200">{s.text}</span>
                <span className="text-muted/60">→ {s.channelName}</span>
                <button
                  onClick={() => cancelScheduled(s.id)}
                  className="rounded-full p-0.5 text-muted hover:bg-white/10 hover:text-red-400"
                  title="Cancel"
                >
                  <IcClose width={12} height={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* message input */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-1">
        {broadcast ? (
          <div className="flex w-44 items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/5 px-2.5 py-2 text-sm text-slate-200">
            <IcUsers width={15} height={15} className="shrink-0 text-brand" />
            <span className="truncate">
              {targets.length} account{targets.length === 1 ? "" : "s"}
            </span>
          </div>
        ) : (
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
        )}

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
            <div className="absolute bottom-full right-0 z-20 mb-1 w-64 rounded-xl border border-white/10 bg-bg-elev/90 p-2 shadow-card backdrop-blur-2xl animate-fade-in">
              <div className="mb-2 flex gap-1 rounded-lg bg-white/[0.03] p-0.5 text-[12px]">
                {(["emoji", "twitch"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPickerTab(t)}
                    className={`flex-1 rounded-md py-1 font-medium ${
                      pickerTab === t ? "bg-white/[0.07] text-slate-100" : "text-muted hover:text-slate-200"
                    }`}
                  >
                    {t === "emoji" ? "Emoji" : "Twitch emotes"}
                  </button>
                ))}
              </div>
              {pickerTab === "emoji" ? (
                <div className="grid grid-cols-6 gap-1">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        setText((t) => t + e);
                        inputRef.current?.focus();
                      }}
                      className="rounded p-1 text-center text-lg hover:bg-white/10"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid max-h-44 grid-cols-3 gap-1 overflow-y-auto scrollbar-thin">
                  {TWITCH_EMOTES.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        setText((t) => (t.endsWith(" ") || t === "" ? t : t + " ") + e + " ");
                        inputRef.current?.focus();
                      }}
                      className="truncate rounded px-1.5 py-1 text-center text-[11px] font-medium text-slate-200 hover:bg-brand/15 hover:text-brand-soft"
                      title={`Insert ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={doSchedule}
          disabled={!canSend || !text.trim()}
          title={`Schedule in ${scheduleDelay}s`}
          className="flex items-center justify-center rounded-lg border border-line bg-bg-soft p-2.5 text-muted hover:border-brand/40 hover:text-brand-soft disabled:opacity-40"
        >
          <IcClock width={17} height={17} />
        </button>

        <button
          onClick={doSend}
          disabled={!canSend || !text.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IcSend width={15} height={15} />
          {broadcast && targets.length > 1 ? `Send ×${targets.length}` : "Send"}
        </button>
      </div>
    </div>
  );
}
