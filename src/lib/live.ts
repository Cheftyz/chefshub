import type { Platform } from "./types";

const token = () => {
  try {
    return localStorage.getItem("chefshub.token") || "";
  } catch {
    return "";
  }
};

export interface LiveInfo {
  configured?: boolean;
  live?: boolean;
  viewers?: number;
  title?: string;
  game?: string;
  error?: string;
}

export async function fetchLive(platform: Platform, name: string): Promise<LiveInfo> {
  try {
    const r = await fetch(`/api/live/${platform}/${encodeURIComponent(name)}`, {
      headers: { authorization: `Bearer ${token()}` },
    });
    return (await r.json()) as LiveInfo;
  } catch {
    return {};
  }
}

export function formatViewers(n?: number): string {
  if (!n && n !== 0) return "";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}
