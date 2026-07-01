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
