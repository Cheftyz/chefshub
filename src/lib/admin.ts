import type { User } from "./auth";

const token = () => {
  try {
    return localStorage.getItem("chefshub.token") || "";
  } catch {
    return "";
  }
};

export async function adminListUsers(): Promise<User[]> {
  const r = await fetch("/api/admin/users", { headers: { authorization: `Bearer ${token()}` } });
  const d = await r.json().catch(() => ({}));
  return (d.users as User[]) || [];
}

export async function adminSetStatus(
  id: string,
  status: "approved" | "disabled" | "pending"
): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(`/api/admin/users/${id}/status`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
    body: JSON.stringify({ status }),
  });
  return r.json().catch(() => ({ ok: false }));
}

export interface UserInput {
  email?: string;
  password?: string;
  displayName?: string;
  status?: "approved" | "disabled" | "pending";
}

export async function adminCreateUser(data: UserInput): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
    body: JSON.stringify(data),
  });
  return r.json().catch(() => ({ ok: false }));
}

export async function adminUpdateUser(id: string, patch: UserInput): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(`/api/admin/users/${id}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
    body: JSON.stringify(patch),
  });
  return r.json().catch(() => ({ ok: false }));
}

export async function adminDeleteUser(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(`/api/admin/users/${id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token()}` },
  });
  return r.json().catch(() => ({ ok: false }));
}

// ---- a user's bots (Twitch/Kick sending accounts), tokens hidden from admin ----
export interface AdminBot {
  id: string;
  platform: "twitch" | "kick";
  username: string;
  visible: boolean;
}

export async function adminListBots(userId: string): Promise<AdminBot[]> {
  const r = await fetch(`/api/admin/users/${userId}/bots`, { headers: { authorization: `Bearer ${token()}` } });
  const d = await r.json().catch(() => ({}));
  return (d.bots as AdminBot[]) || [];
}
export async function adminAddBot(
  userId: string,
  bot: { platform: string; username: string; token: string }
): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(`/api/admin/users/${userId}/bots`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
    body: JSON.stringify(bot),
  });
  return r.json().catch(() => ({ ok: false }));
}
export async function adminDeleteBot(userId: string, botId: string): Promise<{ ok: boolean }> {
  const r = await fetch(`/api/admin/users/${userId}/bots/${botId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token()}` },
  });
  return r.json().catch(() => ({ ok: false }));
}

// ---- every bot on the site (admin), with owner + proxy ----
export interface AdminGlobalBot {
  id: string;
  platform: "twitch" | "kick";
  username: string;
  visible: boolean;
  proxy: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
}
export async function adminListAllBots(): Promise<AdminGlobalBot[]> {
  const r = await fetch("/api/admin/bots", { headers: { authorization: `Bearer ${token()}` } });
  const d = await r.json().catch(() => ({}));
  return (d.bots as AdminGlobalBot[]) || [];
}
export async function adminSetBotProxy(botId: string, proxy: string): Promise<{ ok: boolean }> {
  const r = await fetch(`/api/admin/bots/${botId}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
    body: JSON.stringify({ proxy }),
  });
  return r.json().catch(() => ({ ok: false }));
}
export async function adminDeleteBotGlobal(botId: string): Promise<{ ok: boolean }> {
  const r = await fetch(`/api/admin/bots/${botId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token()}` },
  });
  return r.json().catch(() => ({ ok: false }));
}
