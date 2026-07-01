import { useEffect, useState } from "react";
import type { User } from "../lib/auth";
import { useAuth } from "../lib/auth";
import { adminListUsers, adminSetStatus } from "../lib/admin";
import { IcSpinner } from "./Icons";

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-400",
  pending: "bg-amber-500/15 text-amber-400",
  disabled: "bg-red-500/15 text-red-400",
};

export function AdminPanel() {
  const me = useAuth((s) => s.user);
  const [users, setUsers] = useState<User[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setUsers(await adminListUsers());
  };
  useEffect(() => {
    load();
  }, []);

  const setStatus = async (u: User, status: "approved" | "disabled" | "pending") => {
    setBusyId(u.id);
    setError(null);
    const r = await adminSetStatus(u.id, status);
    if (!r.ok) setError(r.error || "Update failed.");
    await load();
    setBusyId(null);
  };

  const pendingCount = users?.filter((u) => u.status === "pending").length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
      <div className="mx-auto max-w-3xl">
        <div className="mb-1 flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-100">User access</h1>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
              {pendingCount} awaiting approval
            </span>
          )}
        </div>
        <p className="mb-5 text-[13px] text-muted">
          Turn each account's access to the app on or off. New sign-ups start as “pending”.
        </p>

        {error && <p className="mb-3 text-[13px] text-red-400">{error}</p>}

        {users === null ? (
          <div className="flex items-center gap-2 py-10 text-muted">
            <IcSpinner width={18} height={18} /> Loading users…
          </div>
        ) : users.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No users yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">User</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Access</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const busy = busyId === u.id;
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id} className="border-t border-line">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">
                          {u.displayName}
                          {u.isAdmin && (
                            <span className="ml-2 rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand-soft">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-muted">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[u.status]}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {u.isAdmin ? (
                            <span className="text-[12px] text-muted">—</span>
                          ) : busy ? (
                            <IcSpinner width={16} height={16} className="text-muted" />
                          ) : u.status === "approved" ? (
                            <button
                              onClick={() => setStatus(u, "disabled")}
                              className="rounded-md border border-line px-3 py-1.5 text-[12px] font-medium text-muted hover:border-red-500/40 hover:text-red-400"
                            >
                              Turn off
                            </button>
                          ) : (
                            <button
                              onClick={() => setStatus(u, "approved")}
                              className="rounded-md bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand/90"
                            >
                              {u.status === "pending" ? "Approve" : "Turn on"}
                            </button>
                          )}
                          {!u.isAdmin && u.status === "disabled" && !busy && (
                            <span className="text-[11px] text-muted">off</span>
                          )}
                          {isMe && <span className="text-[11px] text-muted">(you)</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
