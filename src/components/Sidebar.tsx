import { useStore } from "../lib/store";
import { useAuth } from "../lib/auth";
import { PLATFORMS, PlatformBadge } from "./platform";
import type { NavPage } from "../lib/types";
import {
  IcHome,
  IcActivity,
  IcTerminal,
  IcAlarm,
  IcQuote,
  IcGift,
  IcShield,
  IcPlus,
  IcUserPlus,
  IcTrash,
  IcEye,
  IcEyeOff,
  IcCheck,
  IcSparkle,
  IcChevron,
} from "./Icons";

interface Props {
  onAddAccount: () => void;
  onJoinChannel: () => void;
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted/70">{children}</div>
);

export function Sidebar({ onAddAccount, onJoinChannel }: Props) {
  const view = useStore((s) => s.view);
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const activeAccountId = useStore((s) => s.activeAccountId);
  const setActiveAccount = useStore((s) => s.setActiveAccount);
  const toggleVisible = useStore((s) => s.toggleVisible);
  const removeAccount = useStore((s) => s.removeAccount);
  const removeChannel = useStore((s) => s.removeChannel);
  const setActiveChannel = useStore((s) => s.setActiveChannel);
  const activeChannelId = useStore((s) => s.activeChannelId);
  const conn = useStore((s) => s.conn);
  const isAdmin = useAuth((s) => s.user?.isAdmin);

  const accounts = useStore((s) => s.accounts).filter((a) => a.platform === view);
  const channels = useStore((s) => s.channels).filter((c) => c.platform === view);
  const label = PLATFORMS[view].label;

  const NavItem = ({ id, icon, children }: { id: NavPage; icon: React.ReactNode; children: React.ReactNode }) => {
    const active = page === id;
    return (
      <button
        onClick={() => setPage(id)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active ? "bg-brand/15 text-brand" : "text-slate-300 hover:bg-white/[0.04] hover:text-slate-100"
        }`}
      >
        <span className={active ? "text-brand" : "text-muted"}>{icon}</span>
        {children}
      </button>
    );
  };

  const dotColor = (id: string) => {
    const st = conn[id]?.state;
    if (st === "open") return "bg-brand";
    if (st === "connecting") return "bg-amber-400 animate-pulse";
    if (st === "error") return "bg-red-500";
    return "bg-slate-600";
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-bg-panel/40 backdrop-blur-2xl scrollbar-thin">
      <div className="px-3 pt-3">
        <SectionLabel>Overview</SectionLabel>
        <div className="space-y-0.5">
          <NavItem id="dashboard" icon={<IcHome width={17} height={17} />}>Dashboard</NavItem>
          <NavItem id="activity" icon={<IcActivity width={17} height={17} />}>Activity</NavItem>
          {isAdmin && <NavItem id="admin" icon={<IcShield width={17} height={17} />}>Admin</NavItem>}
        </div>

        {/* accounts */}
        <div className="flex items-center justify-between px-3 pb-1.5 pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted/70">Accounts</span>
          <button onClick={onAddAccount} title={`Add ${label} account`} className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-slate-200">
            <IcPlus width={15} height={15} />
          </button>
        </div>
        {accounts.length === 0 ? (
          <button
            onClick={onAddAccount}
            className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left hover:border-brand/30"
          >
            <PlatformBadge platform={view} size={18} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-slate-200">Connect {label} Account</div>
              <div className="text-[11px] text-muted">Manage multiple accounts in one place</div>
            </div>
            <IcChevron width={15} height={15} className="-rotate-90 text-muted" />
          </button>
        ) : (
          <div className="space-y-0.5">
            {accounts.map((a) => (
              <div
                key={a.id}
                onClick={() => setActiveAccount(a.id)}
                className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
                  a.id === activeAccountId ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor(a.id)}`} />
                <PlatformBadge platform={a.platform} />
                <span className={`flex-1 truncate ${a.visible ? "text-slate-200" : "text-muted opacity-50"}`}>{a.username}</span>
                {a.id === activeAccountId && <IcCheck width={13} height={13} className="text-brand" />}
                <button onClick={(e) => { e.stopPropagation(); toggleVisible(a.id); }} className="text-muted opacity-0 group-hover:opacity-100 hover:text-slate-200">
                  {a.visible ? <IcEye width={14} height={14} /> : <IcEyeOff width={14} height={14} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeAccount(a.id); }} className="text-muted opacity-0 group-hover:opacity-100 hover:text-red-400">
                  <IcTrash width={13} height={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* channels */}
        <div className="flex items-center justify-between px-3 pb-1.5 pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted/70">Channels</span>
          <button onClick={onJoinChannel} title={`Join ${label} channel`} className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-slate-200">
            <IcPlus width={15} height={15} />
          </button>
        </div>
        {channels.length === 0 ? (
          <button
            onClick={onJoinChannel}
            className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left hover:border-brand/30"
          >
            <PlatformBadge platform={view} size={18} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-slate-200">Add {label} Channel</div>
              <div className="text-[11px] text-muted">Connect a channel to start chatting.</div>
            </div>
            <IcChevron width={15} height={15} className="-rotate-90 text-muted" />
          </button>
        ) : (
          <div className="space-y-0.5">
            {channels.map((c) => (
              <div
                key={c.id}
                onClick={() => { setActiveChannel(c.id); setPage("chat"); }}
                className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
                  c.id === activeChannelId && page === "chat" ? "bg-brand/15 text-brand" : "text-slate-300 hover:bg-white/[0.03]"
                }`}
              >
                <PlatformBadge platform={c.platform} />
                <span className="flex-1 truncate">{c.name}</span>
                <button onClick={(e) => { e.stopPropagation(); removeChannel(c.id); }} className="text-muted opacity-0 group-hover:opacity-100 hover:text-red-400">
                  <IcTrash width={13} height={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* tools */}
        <SectionLabel>Tools</SectionLabel>
        <div className="space-y-0.5">
          <NavItem id="commands" icon={<IcTerminal width={17} height={17} />}>Commands</NavItem>
          <NavItem id="timers" icon={<IcAlarm width={17} height={17} />}>Timers</NavItem>
          <NavItem id="quotes" icon={<IcQuote width={17} height={17} />}>Quotes</NavItem>
          <NavItem id="giveaways" icon={<IcGift width={17} height={17} />}>Giveaways</NavItem>
        </div>

        {/* pro tip */}
        <div className="mt-4 rounded-xl border border-brand/20 bg-brand/[0.06] p-3.5">
          <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-brand-soft">
            <IcSparkle width={14} height={14} /> Pro Tip
          </div>
          <p className="text-[12px] leading-snug text-muted">
            Use commands and timers to automate your chat and engage your community.
          </p>
          <button
            onClick={() => setPage("commands")}
            className="mt-2.5 flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-brand/90"
          >
            Learn More →
          </button>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-white/5 px-4 py-3 text-[11px] text-muted/70">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        {accounts.length} account{accounts.length === 1 ? "" : "s"} · {channels.length} channel
        {channels.length === 1 ? "" : "s"}
      </div>
    </aside>
  );
}
