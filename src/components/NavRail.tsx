import { useStore } from "../lib/store";
import { useAuth } from "../lib/auth";
import { PLATFORMS } from "./platform";
import { IcShield, IcLogout } from "./Icons";
import type { Platform } from "../lib/types";
import type { ReactNode } from "react";

const ORDER: Platform[] = ["twitch", "kick"];

function RailButton({
  active,
  onClick,
  label,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
        active ? "bg-brand/15 text-brand" : "text-muted hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      {/* active indicator bar */}
      <span
        className={`absolute -left-[10px] w-1 rounded-r-full bg-brand transition-all ${
          active ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
      />
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 min-w-[15px] rounded-full bg-brand px-1 text-center text-[9px] font-bold leading-[15px] text-brand-ink">
          {badge}
        </span>
      ) : null}
      {/* hover tooltip */}
      <span className="pointer-events-none absolute left-full z-30 ml-3 whitespace-nowrap rounded-md border border-line bg-bg-elev px-2 py-1 text-[12px] font-medium text-slate-100 opacity-0 shadow-card transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

interface Props {
  screen: "app" | "admin";
  onScreen: (s: "app" | "admin") => void;
}

export function NavRail({ screen, onScreen }: Props) {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const accounts = useStore((s) => s.accounts);
  const authUser = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const initial = (authUser?.displayName || authUser?.email || "?").charAt(0).toUpperCase();

  return (
    <nav className="flex h-full w-16 shrink-0 flex-col items-center gap-1 border-r border-line bg-bg-panel py-3">
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="MB Chatters" className="mb-2 h-8 w-8" />

      {ORDER.map((p) => (
        <RailButton
          key={p}
          active={screen === "app" && view === p}
          onClick={() => {
            setView(p);
            onScreen("app");
          }}
          label={PLATFORMS[p].label}
          badge={accounts.filter((a) => a.platform === p).length || undefined}
        >
          {(() => {
            const Icon = PLATFORMS[p].Icon;
            return (
              <Icon
                width={20}
                height={20}
                style={{ color: screen === "app" && view === p ? PLATFORMS[p].color : undefined }}
              />
            );
          })()}
        </RailButton>
      ))}

      {authUser?.isAdmin && (
        <RailButton active={screen === "admin"} onClick={() => onScreen("admin")} label="Admin">
          <IcShield width={20} height={20} />
        </RailButton>
      )}

      <div className="mt-auto flex flex-col items-center gap-2">
        <div
          title={authUser?.displayName}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand"
        >
          {initial}
        </div>
        <RailButton active={false} onClick={logout} label="Sign out">
          <IcLogout width={18} height={18} />
        </RailButton>
      </div>
    </nav>
  );
}
