import { useStore } from "../lib/store";
import { useAuth } from "../lib/auth";
import { PLATFORMS } from "./platform";
import { IcLogout } from "./Icons";
import type { Platform } from "../lib/types";

const ORDER: Platform[] = ["twitch", "kick"];

interface Props {
  screen: "app" | "admin";
  onScreen: (s: "app" | "admin") => void;
}

export function TopBar({ screen, onScreen }: Props) {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const accounts = useStore((s) => s.accounts);
  const channels = useStore((s) => s.channels);
  const authUser = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-bg-panel px-3">
      <div className="flex items-center gap-2 pl-1 pr-2">
        <img src={`${import.meta.env.BASE_URL}chef.svg`} alt="" className="h-6 w-6" />
        <span className="text-[15px] font-bold tracking-tight">
          MB <span className="text-brand-soft">Chatters</span>
        </span>
      </div>

      <nav className="flex items-center gap-1">
        {ORDER.map((p) => {
          const { label, color, Icon } = PLATFORMS[p];
          const active = screen === "app" && view === p;
          const nAcc = accounts.filter((a) => a.platform === p).length;
          const nCh = channels.filter((c) => c.platform === p).length;
          return (
            <button
              key={p}
              onClick={() => {
                setView(p);
                onScreen("app");
              }}
              className={`group relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white/[0.06] text-slate-100"
                  : "text-muted hover:bg-white/[0.03] hover:text-slate-200"
              }`}
            >
              <Icon width={16} height={16} style={{ color: active ? color : undefined }} />
              {label}
              {(nAcc > 0 || nCh > 0) && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    active ? "bg-white/10 text-slate-300" : "bg-white/5 text-muted"
                  }`}
                >
                  {nAcc}·{nCh}
                </span>
              )}
              {active && (
                <span
                  className="absolute -bottom-[1px] left-3 right-3 h-0.5 rounded-full"
                  style={{ background: color }}
                />
              )}
            </button>
          );
        })}
        {authUser?.isAdmin && (
          <button
            onClick={() => onScreen("admin")}
            className={`ml-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              screen === "admin"
                ? "bg-brand/15 text-brand-soft"
                : "text-muted hover:bg-white/[0.03] hover:text-slate-200"
            }`}
          >
            Admin
          </button>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {authUser && <span className="hidden text-[13px] text-muted sm:inline">{authUser.displayName}</span>}
        <button
          onClick={logout}
          title="Sign out"
          className="rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-slate-200"
        >
          <IcLogout />
        </button>
      </div>
    </header>
  );
}
