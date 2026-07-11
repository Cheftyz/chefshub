const token = () => {
  try {
    return localStorage.getItem("chefshub.token") || "";
  } catch {
    return "";
  }
};

/** Send a Twitch message via the server (routed through the bot's proxy). */
export async function twitchSendViaServer(
  botId: string,
  channel: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/twitch/send", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
      body: JSON.stringify({ botId, channel, text }),
    });
    const d = await r.json().catch(() => ({}));
    return d.ok ? { ok: true } : { ok: false, error: d.error || `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "server unreachable" };
  }
}
