import { useEffect, useState } from "react";
import type { User } from "../lib/auth";
import { useAuth } from "../lib/auth";
import {
  adminListUsers,
  adminSetStatus,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminListBots,
  adminAddBot,
  adminDeleteBot,
  type AdminBot,
} from "../lib/admin";
import { Modal } from "./Modal";
import { PLATFORMS, PlatformBadge } from "./platform";
import type { Platform } from "../lib/types";
import { IcSpinner, IcPlus, IcEdit, IcTrash } from "./Icons";

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-400",
  pending: "bg-amber-500/15 text-amber-400",
  disabled: "bg-red-500/15 text-red-400",
};

const input =
  "w-full rounded-lg border border-line bg-bg-soft px-3 py-2 text-sm text-slate-100 placeholder:text-muted/70 outline-none focus:border-brand/70 focus:ring-1 focus:ring-brand/40";
const label = "mb-1 block text-[12px] font-medium uppercase tracking-wide text-muted";
const btnPrimary =
  "flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed";

type Editing = { mode: "create" } | { mode: "edit"; user: User } | null;

function BotManager({ userId }: { userId: string }) {
  const [bots, setBots] = useState<AdminBot[] | null>(null);
  const [platform, setPlatform] = useState<Platform>("twitch");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => setBots(await adminListBots(userId));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const add = async () => {
    if (!username.trim() || !token.trim() || busy) return;
    setBusy(true);
    setError(null);
    const r = await adminAddBot(userId, { platform, username, token });
    setBusy(false);
    if (r.ok) {
      setUsername("");
      setToken("");
      await load();
    } else setError(r.error || "Couldn't add bot.");
  };

  const remove = async (botId: string) => {
    await adminDeleteBot(userId, botId);
    await load();
  };

  return (
    <div className="mt-5 border-t border-line pt-4">
      <label className={label}>Bots on this account</label>
      <p className="mb-2 text-[12px] text-muted">The Twitch/Kick accounts this user sends messages from.</p>

      <div className="mb-3 space-y-1.5">
        {bots === null ? (
          <div className="flex items-center gap-2 py-2 text-[13px] text-muted">
            <IcSpinner width={14} height={14} /> Loading…
          </div>
        ) : bots.length === 0 ? (
          <p className="py-1 text-[13px] italic text-muted/70">No bots yet.</p>
        ) : (
          bots.map((b) => (
            <div key={b.id} className="flex items-center gap-2 rounded-lg border border-line bg-bg-soft px-3 py-2">
              <PlatformBadge platform={b.platform} />
              <span className="flex-1 truncate text-sm text-slate-200">{b.username}</span>
              <button
                onClick={() => remove(b.id)}
                title="Delete bot"
                className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-red-400"
              >
                <IcTrash width={14} height={14} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="rounded-lg border border-line bg-bg-soft/50 p-3">
        <div className="mb-2 flex gap-2">
          {(Object.keys(PLATFORMS) as Platform[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[12px] font-medium ${
                platform === p ? "border-brand/70 bg-brand/10 text-slate-100" : "border-line text-muted"
              }`}
            >
              <PlatformBadge platform={p} /> {PLATFORMS[p].label}
            </button>
          ))}
        </div>
        <input
          className={`${input} mb-2`}
          placeholder="bot username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className={`${input} mb-2 font-mono`}
          placeholder={platform === "kick" ? "bearer token" : "oauth:token"}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        {error && <p className="mb-2 text-[12px] text-red-400">{error}</p>}
        <button
          onClick={add}
          disabled={busy || !username.trim() || !token.trim()}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-brand/90 disabled:opacity-40"
        >
          {busy ? <IcSpinner width={13} height={13} /> : <IcPlus width={13} height={13} />} Add bot
        </button>
      </div>
    </div>
  );
}

function UserDialog({ editing, onClose, onSaved }: { editing: Editing; onClose: () => void; onSaved: () => void }) {
  const isEdit = editing?.mode === "edit";
  const existing = isEdit ? editing.user : null;
  const [displayName, setDisplayName] = useState(existing?.displayName ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<User["status"]>(existing?.status ?? "approved");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = isEdit
      ? await adminUpdateUser(existing!.id, { displayName, email, password: password || undefined, status })
      : await adminCreateUser({ displayName, email, password, status });
    setBusy(false);
    if (r.ok) onSaved();
    else setError(r.error || "Save failed.");
  };

  const remove = async () => {
    if (!existing || busy) return;
    setBusy(true);
    setError(null);
    const r = await adminDeleteUser(existing.id);
    setBusy(false);
    if (r.ok) onSaved();
    else setError(r.error || "Delete failed.");
  };

  const lockStatus = isEdit && existing?.isAdmin; // don't change an admin's status

  return (
    <Modal
      title={isEdit ? `Edit ${existing?.displayName}` : "New user"}
      subtitle={isEdit ? "Update this account. Leave password blank to keep it." : "Create an account. It's approved and ready to use."}
      onClose={onClose}
      footer={
        <>
          {isEdit && !existing?.isAdmin && (
            <button
              onClick={remove}
              disabled={busy}
              className="mr-auto flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:border-red-500/40 hover:text-red-400 disabled:opacity-40"
            >
              <IcTrash width={14} height={14} /> Delete
            </button>
          )}
          <button className={btnPrimary} onClick={save} disabled={busy}>
            {busy && <IcSpinner width={15} height={15} />}
            {isEdit ? "Save changes" : "Create account"}
          </button>
        </>
      }
    >
      <label className={label}>Name</label>
      <input className={`${input} mb-4`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

      <label className={label}>Email</label>
      <input className={`${input} mb-4`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

      <label className={label}>{isEdit ? "New password (optional)" : "Password"}</label>
      <input
        className={`${input} mb-4`}
        type="text"
        placeholder={isEdit ? "leave blank to keep current" : "at least 4 characters"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {!lockStatus && (
        <>
          <label className={label}>Access</label>
          <select className={input} value={status} onChange={(e) => setStatus(e.target.value as User["status"])}>
            <option value="approved">Approved (can use the app)</option>
            <option value="disabled">Off (blocked)</option>
            <option value="pending">Pending</option>
          </select>
        </>
      )}

      {error && <p className="mt-3 text-[13px] text-red-400">{error}</p>}

      {isEdit && existing && <BotManager userId={existing.id} />}
    </Modal>
  );
}

export function AdminPanel() {
  const me = useAuth((s) => s.user);
  const [users, setUsers] = useState<User[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  const load = async () => setUsers(await adminListUsers());
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

  const removeUser = async (u: User) => {
    if (!window.confirm(`Delete ${u.displayName} (${u.email})? This permanently removes their account and bots.`))
      return;
    setBusyId(u.id);
    setError(null);
    const r = await adminDeleteUser(u.id);
    if (!r.ok) setError(r.error || "Delete failed.");
    await load();
    setBusyId(null);
  };

  const pendingCount = users?.filter((u) => u.status === "pending").length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
      <div className="mx-auto max-w-3xl">
        <div className="mb-1 flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-100">User accounts</h1>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
              {pendingCount} awaiting approval
            </span>
          )}
          <button className={`${btnPrimary} ml-auto`} onClick={() => setEditing({ mode: "create" })}>
            <IcPlus width={15} height={15} /> New user
          </button>
        </div>
        <p className="mb-5 text-[13px] text-muted">
          See everyone, turn access on/off, or open an account to edit it. New sign-ups start as “pending”.
        </p>

        {error && <p className="mb-3 text-[13px] text-red-400">{error}</p>}

        {users === null ? (
          <div className="flex items-center gap-2 py-10 text-muted">
            <IcSpinner width={18} height={18} /> Loading users…
          </div>
        ) : users.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No users yet. Add one with “New user”.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-bg-panel/40 backdrop-blur-2xl">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">User</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Bots</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Manage</th>
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
                          {isMe && <span className="ml-2 text-[11px] text-muted">(you)</span>}
                        </div>
                        <div className="text-[12px] text-muted">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[u.status]}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setEditing({ mode: "edit", user: u })}
                          title="Manage this user's bots"
                          className={`rounded-md border px-2.5 py-1 text-[12px] font-medium ${
                            u.botCount
                              ? "border-line text-slate-200 hover:border-brand/50 hover:text-brand-soft"
                              : "border-transparent text-muted/70 hover:text-slate-300"
                          }`}
                        >
                          {u.botCount ? `${u.botCount} bot${u.botCount === 1 ? "" : "s"}` : "no bots"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {!u.isAdmin &&
                            (busy ? (
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
                                className="rounded-md bg-brand px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-brand/90"
                              >
                                {u.status === "pending" ? "Approve" : "Turn on"}
                              </button>
                            ))}
                          <button
                            onClick={() => setEditing({ mode: "edit", user: u })}
                            title="Open & edit"
                            className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-[12px] font-medium text-muted hover:border-brand/40 hover:text-slate-200"
                          >
                            <IcEdit width={13} height={13} /> Edit
                          </button>
                          {!u.isAdmin && (
                            <button
                              onClick={() => removeUser(u)}
                              title="Delete account"
                              className="flex items-center justify-center rounded-md border border-line p-1.5 text-muted hover:border-red-500/40 hover:text-red-400"
                            >
                              <IcTrash width={13} height={13} />
                            </button>
                          )}
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

      {editing && (
        <UserDialog
          editing={editing}
          onClose={() => {
            setEditing(null);
            load(); // refresh bot counts etc. after managing bots
          }}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
