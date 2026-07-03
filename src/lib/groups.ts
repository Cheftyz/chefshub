import type { PhraseGroup } from "./types";

const token = () => {
  try {
    return localStorage.getItem("chefshub.token") || "";
  } catch {
    return "";
  }
};

/** The signed-in user's message groups (phrase presets), from the server. */
export async function listGroups(): Promise<PhraseGroup[]> {
  const r = await fetch("/api/me/groups", { headers: { authorization: `Bearer ${token()}` } });
  const d = await r.json().catch(() => ({}));
  return (d.groups as PhraseGroup[]) || [];
}

/** Replace the whole set of groups on the server. */
export async function saveGroups(groups: PhraseGroup[]): Promise<void> {
  await fetch("/api/me/groups", {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
    body: JSON.stringify({ groups }),
  });
}
