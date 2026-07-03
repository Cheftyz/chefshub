import { useEffect, useRef } from "react";
import { useStore, colorFor } from "../lib/store";
import { PLATFORMS, PlatformBadge } from "./platform";
import { IcMessage } from "./Icons";

function timeStr(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatArea() {
  const view = useStore((s) => s.view);
  const channels = useStore((s) => s.channels).filter((c) => c.platform === view);
  const activeChannelId = useStore((s) => s.activeChannelId);
  const setActiveChannel = useStore((s) => s.setActiveChannel);
  const messages = useStore((s) => (s.activeChannelId ? s.messages[s.activeChannelId] : undefined));

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length, activeChannelId]);

  if (channels.length === 0) {
    const label = PLATFORMS[view].label;
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand-soft">
          <IcMessage width={28} height={28} />
        </div>
        <h2 className="text-lg font-semibold text-slate-100">No {label} channels yet</h2>
        <p className="mt-1 text-sm text-muted">
          Add a {label} channel from the sidebar to start chatting.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* channel tabs */}
      <div className="flex h-14 shrink-0 items-center gap-1 overflow-x-auto border-b border-white/5 bg-bg-panel/30 px-3 backdrop-blur-xl scrollbar-thin">
        {channels.map((c) => {
          const active = c.id === activeChannelId;
          return (
            <button
              key={c.id}
              onClick={() => setActiveChannel(c.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                active ? "bg-brand/15 text-brand-soft" : "text-muted hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <PlatformBadge platform={c.platform} />
              {c.name}
            </button>
          );
        })}
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {(messages ?? []).map((m) => {
          if (m.system) {
            return (
              <div key={m.id} className="py-0.5 text-[13px] italic text-muted/80">
                {m.text}
              </div>
            );
          }
          return (
            <div
              key={m.id}
              className={`group flex gap-2 rounded px-1 py-[3px] text-[14px] leading-relaxed hover:bg-white/[0.02] ${
                m.self ? "bg-brand/[0.06]" : ""
              }`}
            >
              <span className="select-none pt-0.5 text-[11px] tabular-nums text-muted/50 opacity-0 group-hover:opacity-100">
                {timeStr(m.ts)}
              </span>
              <span className="min-w-0">
                <span className="font-semibold" style={{ color: colorFor(m.username, m.color) }}>
                  {m.displayName}
                </span>
                <span className="text-muted">: </span>
                <span className="break-words text-slate-200">{m.text}</span>
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
