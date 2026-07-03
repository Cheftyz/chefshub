import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { MatrixRain } from "./MatrixRain";
import { IcSpinner } from "./Icons";

const input =
  "w-full rounded-lg border border-line bg-bg-soft px-3 py-2.5 text-sm text-slate-100 placeholder:text-muted/70 outline-none focus:border-brand/70 focus:ring-1 focus:ring-brand/40";
const label = "mb-1 block text-[12px] font-medium uppercase tracking-wide text-muted";
const primary =
  "mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40";

type Mode = "login" | "signup" | "forgot" | "reset";

function Shell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-bg px-4 text-slate-200">
      <MatrixRain />
      {/* soft dark vignette so the card stays readable over the rain */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(10,11,12,0.82)_75%)]" />
      <div className="animate-glow relative z-10 w-full max-w-sm rounded-2xl border border-brand/30 bg-bg-panel/85 p-7 backdrop-blur-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt=""
            className="mb-3 h-14 w-14 drop-shadow-[0_8px_24px_rgba(34,224,107,0.45)]"
          />
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-100">
            MB <span className="text-brand">Chatters</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const blockedStatus = useAuth((s) => s.blockedStatus);
  const init = useAuth((s) => s.init);
  const signup = useAuth((s) => s.signup);
  const login = useAuth((s) => s.login);
  const forgot = useAuth((s) => s.forgot);
  const reset = useAuth((s) => s.reset);
  const logout = useAuth((s) => s.logout);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg text-muted">
        <IcSpinner width={22} height={22} />
      </div>
    );
  }

  if (user && user.status === "approved") return <>{children}</>;

  // gate screens for a signed-in-but-not-approved account
  if (blockedStatus === "pending") {
    return (
      <Shell subtitle="Account created">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-center text-[13px] text-amber-300">
          Your account is waiting for the admin to approve access.
        </div>
        <button className={primary} onClick={() => { logout(); setMode("login"); }}>
          Back to sign in
        </button>
      </Shell>
    );
  }
  if (blockedStatus === "disabled") {
    return (
      <Shell subtitle="Access turned off">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center text-[13px] text-red-300">
          Your access has been turned off by the admin.
        </div>
        <button className={primary} onClick={() => { logout(); setMode("login"); }}>
          Back to sign in
        </button>
      </Shell>
    );
  }

  const go = (m: Mode) => { setMode(m); setError(null); setNotice(null); };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "login") {
        const r = await login(email, password);
        if (!r.ok) setError(r.error || "Login failed.");
      } else if (mode === "signup") {
        const r = await signup(email, password, displayName);
        if (r.ok) {
          setNotice("Account created! An admin needs to approve you before you can sign in.");
          setMode("login");
          setPassword("");
        } else setError(r.error || "Sign up failed.");
      } else if (mode === "forgot") {
        const r = await forgot(email);
        setNotice(
          r.emailed
            ? "If that email has an account, a reset code was sent to it."
            : "A reset code was generated — check the server console (no email is configured)."
        );
        setMode("reset");
      } else if (mode === "reset") {
        const r = await reset(email, code, password);
        if (r.ok) {
          setNotice("Password updated. You can sign in now.");
          setMode("login");
          setPassword("");
          setCode("");
        } else setError(r.error || "Reset failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    mode === "login" ? "Sign in to continue."
    : mode === "signup" ? "Create your account."
    : mode === "forgot" ? "Reset your password."
    : "Enter the code from your email.";

  return (
    <Shell subtitle={subtitle}>
      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-[12px] leading-snug text-emerald-300">
          {notice}
        </div>
      )}

      {mode === "signup" && (
        <>
          <label className={label}>Name (optional)</label>
          <input className={`${input} mb-4`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </>
      )}

      <label className={label}>Email</label>
      <input
        className={`${input} mb-4`}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {mode === "reset" && (
        <>
          <label className={label}>Reset code</label>
          <input
            className={`${input} mb-4 font-mono tracking-widest`}
            inputMode="numeric"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </>
      )}

      {mode !== "forgot" && (
        <>
          <label className={label}>{mode === "reset" ? "New password" : "Password"}</label>
          <input
            className={input}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </>
      )}

      {error && <p className="mt-3 text-[13px] text-red-400">{error}</p>}

      <button className={primary} onClick={submit} disabled={busy}>
        {busy && <IcSpinner width={15} height={15} />}
        {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset code" : "Set new password"}
      </button>

      <div className="mt-5 flex justify-between text-[12px] text-muted">
        {mode === "login" ? (
          <>
            <button className="hover:text-slate-200" onClick={() => go("signup")}>Create account</button>
            <button className="hover:text-slate-200" onClick={() => go("forgot")}>Forgot password?</button>
          </>
        ) : (
          <button className="hover:text-slate-200" onClick={() => go("login")}>← Back to sign in</button>
        )}
      </div>
    </Shell>
  );
}
