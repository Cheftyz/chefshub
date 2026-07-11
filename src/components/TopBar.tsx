import { useState } from "react";
import { useStore } from "../lib/store";
import { useAuth } from "../lib/auth";
import { PLATFORMS } from "./platform";
import { IcBell, IcChevron, IcLogout } from "./Icons";
import type { Platform } from "../lib/types";

const ORDER: Platform[] = ["twitch", "kick"];

export function TopBar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const setPage = useStore((s) => s.setPage);
  const activity = useStore((s) => s.activity);
  const authUser = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const name = authUser?.displayName || authUser?.email || "user";
  const initial = name.charAt(0).toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/5 bg-bg-panel/60 px-4 backdrop-blur-2xl">
      <button onClick={() => setPage("dashboard")} className="flex items-center gap-2.5">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-7 w-7" />
        <span className="font-display text-[16px] font-semibold tracking-tight text-slate-100">
          MB <span className="text-brand">Chatters</span>
        </span>
      </button>

      <nav className="ml-2 flex items-center gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
        {ORDER.map((p) => {
          const { label, color, Icon } = PLATFORMS[p];
          const active = view === p;
          return (
            <button
              key={p}
              onClick={() => setView(p)}
              className={`relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-white/[0.06] text-slate-100" : "text-muted hover:text-slate-200"
              }`}
            >
              <Icon width={15} height={15} style={{ color: active ? color : undefined }} />
              {label}
              {active && (
                <span className="absolute -bottom-1 left-3 right-3 h-0.5 rounded-full" style={{ background: color }} />
              )}
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        {/* notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setBellOpen((v) => !v);
              setUserOpen(false);
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] text-muted hover:text-slate-200"
          >
            <IcBell width={17} height={17} />
            {activity.length > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand" />}
          </button>
          {bellOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-bg-elev/90 shadow-card backdrop-blur-2xl animate-fade-in">
              <div className="border-b border-line px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                Recent activity
              </div>
              <div className="max-h-72 overflow-y-auto scrollbar-thin">
                {activity.length === 0 ? (
                  <p className="px-3 py-6 text-center text-[13px] text-muted">Nothing yet.</p>
                ) : (
                  activity.slice(0, 12).map((a) => (
                    <div key={a.id} className="border-b border-line/50 px-3 py-2 text-[13px] text-slate-300">
                      {a.text}
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={() => {
                  setPage("activity");
                  setBellOpen(false);
                }}
                className="block w-full px-3 py-2 text-center text-[12px] font-medium text-brand-soft hover:bg-white/5"
              >
                View all
              </button>
            </div>
          )}
        </div>

        {/* user menu */}
        <div className="relative">
          <button
            onClick={() => {
              setUserOpen((v) => !v);
              setBellOpen(false);
            }}
            className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] py-1 pl-2.5 pr-1.5 text-sm text-slate-200 hover:border-white/10"
          >
            <span className="max-w-[90px] truncate">{name}</span>
            <IcChevron width={14} height={14} className="text-muted" />
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-[12px] font-semibold text-brand">
              {initial}
            </span>
          </button>
          {userOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-bg-elev/90 shadow-card backdrop-blur-2xl animate-fade-in">
              <div className="border-b border-line px-3 py-2.5">
                <div className="truncate text-sm font-medium text-slate-100">{name}</div>
                <div className="truncate text-[12px] text-muted">{authUser?.email}</div>
              </div>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5"
              >
                <IcLogout width={15} height={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
