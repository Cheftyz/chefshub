import type { Account } from "./types";

const token = () => {
  try {
    return localStorage.getItem("chefshub.token") || "";
  } catch {
    return "";
  }
};

async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`/api${path}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data } as const;
}

/** The signed-in user's own bots (Twitch/Kick sending accounts), including tokens. */
export async function listMyBots(): Promise<Account[]> {
  const { ok, data } = await api("/me/bots");
  return ok ? (data.bots as Account[]) || [] : [];
}
export async function addMyBot(bot: {
  platform: string;
  username: string;
  token: string;
}): Promise<{ ok: boolean; bot?: Account; error?: string }> {
  const { ok, data } = await api("/me/bots", "POST", bot);
  return ok ? { ok, bot: data.bot } : { ok, error: data.error };
}
export async function updateMyBot(
  id: string,
  patch: { visible?: boolean; username?: string; token?: string; proxy?: string; channels?: string[] }
): Promise<{ ok: boolean; bot?: Account }> {
  const { ok, data } = await api(`/me/bots/${id}`, "POST", patch);
  return { ok, bot: data.bot };
}
export async function deleteMyBot(id: string): Promise<{ ok: boolean }> {
  const { ok } = await api(`/me/bots/${id}`, "DELETE");
  return { ok };
}
