import { create } from "zustand";

// API-backed auth for MB Chatters's multi-user server.
// Token is kept in localStorage; the server owns accounts, approval status,
// password reset (email OTP), and admin controls.

const TOKEN_KEY = "chefshub.token";

export interface User {
  id: string;
  email: string;
  displayName: string;
  status: "pending" | "approved" | "disabled";
  isAdmin: boolean;
  createdAt: number;
  botCount?: number;
}

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function api(path: string, body?: unknown, method = "POST") {
  const res = await fetch(`/api${path}`, {
    method: body ? method : "GET",
    headers: {
      "content-type": "application/json",
      ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data } as const;
}

interface AuthState {
  ready: boolean; // finished initial /me check
  token: string | null;
  user: User | null;
  /** non-approved status to show a gate screen */
  blockedStatus: "pending" | "disabled" | null;

  init: () => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  forgot: (email: string) => Promise<{ ok: boolean; emailed?: boolean }>;
  reset: (email: string, code: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  ready: false,
  token: getToken(),
  user: null,
  blockedStatus: null,

  init: async () => {
    if (!getToken()) {
      set({ ready: true, user: null });
      return;
    }
    const { ok, status, data } = await api("/me");
    if (ok) {
      set({ ready: true, user: data.user, blockedStatus: null });
    } else if (status === 403 && data?.error) {
      set({ ready: true, user: null, blockedStatus: data.error });
    } else {
      setToken(null);
      set({ ready: true, token: null, user: null });
    }
  },

  signup: async (email, password, displayName) => {
    const { ok, data } = await api("/signup", { email, password, displayName });
    return ok ? { ok: true } : { ok: false, error: data?.error || "Sign up failed." };
  },

  login: async (email, password) => {
    const { ok, data } = await api("/login", { email, password });
    if (ok) {
      setToken(data.token);
      set({ token: data.token, user: data.user, blockedStatus: null });
      return { ok: true };
    }
    if (data?.error === "pending" || data?.error === "disabled") {
      set({ blockedStatus: data.error });
      return { ok: false, error: data.message };
    }
    return { ok: false, error: data?.error || "Login failed." };
  },

  forgot: async (email) => {
    const { data } = await api("/forgot", { email });
    return { ok: true, emailed: !!data?.emailed };
  },

  reset: async (email, code, password) => {
    const { ok, data } = await api("/reset", { email, code, password });
    return ok ? { ok: true } : { ok: false, error: data?.error || "Reset failed." };
  },

  logout: () => {
    setToken(null);
    set({ token: null, user: null, blockedStatus: null });
  },
}));
