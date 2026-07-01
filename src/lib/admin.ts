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
