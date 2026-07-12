// Client for the admin-only MB Chatters AI bot. The LLM key lives on the server;
// the browser only reads config (never the key) and asks the server to generate.
const token = () => {
  try {
    return localStorage.getItem("chefshub.token") || "";
  } catch {
    return "";
  }
};

export interface AiConfig {
  enabled: boolean;
  provider: "anthropic" | "openai";
  model: string;
  persona: string;
  botId: string;
  channelId: string;
  cooldownSec: number;
  maxReplyChars: number;
  /** true if a key is stored on the server (the key itself is never returned) */
  hasKey: boolean;
}

export type AiPatch = Partial<Omit<AiConfig, "hasKey">> & { apiKey?: string; clearKey?: boolean };

export async function getAiConfig(): Promise<AiConfig | null> {
  try {
    const r = await fetch("/api/admin/ai", { headers: { authorization: `Bearer ${token()}` } });
    if (!r.ok) return null;
    const d = await r.json().catch(() => ({}));
    return (d.ai as AiConfig) || null;
  } catch {
    return null;
  }
}

export async function saveAiConfig(patch: AiPatch): Promise<AiConfig | null> {
  const r = await fetch("/api/admin/ai", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
    body: JSON.stringify(patch),
  });
  const d = await r.json().catch(() => ({}));
  return (d.ai as AiConfig) || null;
}

export async function aiReply(
  context: { username: string; text: string }[]
): Promise<{ ok: boolean; reply?: string; skip?: boolean; error?: string }> {
  try {
    const r = await fetch("/api/admin/ai/reply", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
      body: JSON.stringify({ context }),
    });
    return await r.json().catch(() => ({ ok: false, error: "server error" }));
  } catch (e) {
    return { ok: false, error: (e as Error).message || "server unreachable" };
  }
}
