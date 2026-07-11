import type { ToolKind } from "./types";

const token = () => {
  try {
    return localStorage.getItem("chefshub.token") || "";
  } catch {
    return "";
  }
};
const h = () => ({ "content-type": "application/json", authorization: `Bearer ${token()}` });

export async function listItems<T>(kind: ToolKind): Promise<T[]> {
  const r = await fetch(`/api/me/${kind}`, { headers: h() });
  const d = await r.json().catch(() => ({}));
  return (d.items as T[]) || [];
}
export async function addItem<T>(kind: ToolKind, item: Partial<T>): Promise<T | null> {
  const r = await fetch(`/api/me/${kind}`, { method: "POST", headers: h(), body: JSON.stringify(item) });
  const d = await r.json().catch(() => ({}));
  return (d.item as T) || null;
}
export async function updateItem<T>(kind: ToolKind, id: string, patch: Partial<T>): Promise<void> {
  await fetch(`/api/me/${kind}/${id}`, { method: "POST", headers: h(), body: JSON.stringify(patch) });
}
export async function deleteItem(kind: ToolKind, id: string): Promise<void> {
  await fetch(`/api/me/${kind}/${id}`, { method: "DELETE", headers: h() });
}
