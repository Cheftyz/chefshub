import { useStore } from "../lib/store";
import { PLATFORMS, PlatformBadge } from "./platform";
import { IcCheck, IcEye, IcEyeOff, IcPlus, IcTrash, IcUserPlus } from "./Icons";

interface Props {
  onAddAccount: () => void;
  onJoinChannel: () => void;
}

export function Sidebar({ onAddAccount, onJoinChannel }: Props) {
  const view = useStore((s) => s.view);
  const activeAccountId = useStore((s) => s.activeAccountId);
  const setActiveAccount = useStore((s) => s.setActiveAccount);
  const toggleVisible = useStore((s) => s.toggleVisible);
  const removeAccount = useStore((s) => s.removeAccount);
  const conn = useStore((s) => s.conn);

  const activeChannelId = useStore((s) => s.activeChannelId);
  const setActiveChannel = useStore((s) => s.setActiveChannel);
  const removeChannel = useStore((s) => s.removeChannel);

  // scope everything to the active platform tab
  const accounts = useStore((s) => s.accounts).filter((a) => a.platform === view);
  const channels = useStore((s) => s.channels).filter((c) => c.platform === view);
  const platformLabel = PLATFORMS[view].label;

  const dotColor = (id: string) => {
    const st = conn[id]?.state;
    if (st === "open") return "bg-emerald-400";
    if (st === "connecting") return "bg-amber-400 animate-pulse";
    if (st === "error") return "bg-red-500";
    return "bg-slate-600";
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/5 bg-bg-panel/40 backdrop-blur-2xl">
      {/* platform header */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
        <PlatformBadge platform={view} size={18} />
        <span className="font-display text-sm font-semibold tracking-tight text-slate-100">
          {platformLabel}
        </span>
      </div>

      {/* accounts */}
      <div className="px-3 pt-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {platformLabel} Accounts
          </span>
          <button
            onClick={onAddAccount}
            title={`Add ${platformLabel} account`}
            className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-slate-200"
          >
            <IcUserPlus width={15} height={15} />
          </button>
        </div>
        <div className="space-y-0.5">
          {accounts.length === 0 && (
            <p className="px-2 py-1 text-[12px] italic text-muted/70">No {platformLabel} accounts yet</p>
          )}
          {accounts.map((a) => {
            const active = a.id === activeAccountId;
            return (
              <div
                key={a.id}
                onClick={() => setActiveAccount(a.id)}
                className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                  active ? "bg-white/5" : "hover:bg-white/[0.03]"
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor(a.id)}`} />
                <PlatformBadge platform={a.platform} />
                <span className={`flex-1 truncate ${a.visible ? "text-slate-200" : "text-muted opacity-50"}`}>
                  {a.username}
                </span>
                {active && <IcCheck width={14} height={14} className="text-brand-soft" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisible(a.id);
                  }}
                  title={a.visible ? "Hide from auto-send" : "Include in auto-send"}
                  className="text-muted opacity-0 transition-opacity hover:text-slate-200 group-hover:opacity-100"
                >
                  {a.visible ? <IcEye width={14} height={14} /> : <IcEyeOff width={14} height={14} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAccount(a.id);
                  }}
                  title="Remove account"
                  className="text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                >
                  <IcTrash width={14} height={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* channels */}
      <div className="px-3 pt-6">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {platformLabel} Channels
          </span>
          <button
            onClick={onJoinChannel}
            title={`Join ${platformLabel} channel`}
            className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-slate-200"
          >
            <IcPlus width={15} height={15} />
          </button>
        </div>
        <div className="space-y-0.5">
          {channels.length === 0 && (
            <p className="px-2 py-1 text-[12px] italic text-muted/70">No {platformLabel} channels yet</p>
          )}
          {channels.map((c) => {
            const active = c.id === activeChannelId;
            return (
              <div
                key={c.id}
                onClick={() => setActiveChannel(c.id)}
                className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm ${
                  active ? "bg-brand/15 text-brand-soft" : "text-slate-300 hover:bg-white/[0.03]"
                }`}
              >
                <PlatformBadge platform={c.platform} size={14} />
                <span className="flex-1 truncate">{c.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChannel(c.id);
                  }}
                  title="Leave channel"
                  className="text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                >
                  <IcTrash width={13} height={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto px-4 py-3 text-[11px] text-muted/60">
        {accounts.length} account{accounts.length === 1 ? "" : "s"} · {channels.length} channel
        {channels.length === 1 ? "" : "s"}
      </div>
    </aside>
  );
}
