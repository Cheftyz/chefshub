import { useState } from "react";
import { Modal } from "./Modal";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import { PLATFORMS } from "./platform";
import { IcPlus, IcSpinner, IcTrash } from "./Icons";

const btnPrimary =
  "flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const input =
  "w-full rounded-lg border border-line bg-bg-soft px-3 py-2 text-sm text-slate-100 placeholder:text-muted/70 outline-none focus:border-brand/70 focus:ring-1 focus:ring-brand/40";
const label = "mb-1 block text-[12px] font-medium uppercase tracking-wide text-muted";

function PlatformHeader({ platform }: { platform: "twitch" | "kick" }) {
  const { label: lbl, color, Icon } = PLATFORMS[platform];
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-bg-soft px-3 py-2 text-sm font-medium text-slate-200">
      <Icon width={16} height={16} style={{ color }} />
      {lbl}
    </div>
  );
}

export function AddAccountDialog({ onClose }: { onClose: () => void }) {
  const addAccount = useStore((s) => s.addAccount);
  const platform = useStore((s) => s.view);
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!username.trim() || !token.trim() || busy) return;
    setBusy(true);
    setError(null);
    const r = await addAccount(platform, username, token);
    setBusy(false);
    if (r.ok) {
      toast(`Added ${username.trim().toLowerCase()}`);
      onClose();
    } else {
      setError(r.error || "Couldn't add the bot.");
    }
  };

  const isKick = platform === "kick";

  return (
    <Modal
      title={`Add ${PLATFORMS[platform].label} account`}
      subtitle={
        isKick
          ? "Paste your Kick bearer token. It's stored on your account and used to send messages."
          : "Generate a chat OAuth token (chat:read + chat:edit) and paste it here. It's stored on your account."
      }
      onClose={onClose}
      footer={
        <button className={btnPrimary} disabled={!username.trim() || !token.trim() || busy} onClick={submit}>
          {busy && <IcSpinner width={15} height={15} />}
          Add account
        </button>
      }
    >
      <PlatformHeader platform={platform} />

      {isKick ? (
        <p className="mb-4 rounded-lg border border-line bg-bg-soft px-3 py-2 text-[12px] leading-snug text-muted">
          On kick.com, open DevTools → Network, send a chat message, and copy the{" "}
          <span className="text-slate-300">Authorization: Bearer</span> token from the request.
          Sending requires the bundled proxy (<span className="font-mono">npm run proxy</span>).
        </p>
      ) : (
        <a
          href="https://twitchtokengenerator.com"
          target="_blank"
          rel="noreferrer"
          className="mb-4 inline-block text-[13px] font-medium text-brand-soft hover:underline"
        >
          Open twitchtokengenerator.com ↗
        </a>
      )}

      <label className={label}>{isKick ? "Kick username" : "Twitch username"}</label>
      <input
        className={`${input} mb-4`}
        placeholder="your_login"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoFocus
      />
      <label className={label}>{isKick ? "Bearer token" : "OAuth access token"}</label>
      <input
        className={`${input} font-mono`}
        placeholder={isKick ? "eyJhbGciOi…" : "oauth:xxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {error && <p className="mt-3 text-[13px] text-red-400">{error}</p>}
    </Modal>
  );
}

export function JoinChannelDialog({ onClose }: { onClose: () => void }) {
  const addChannel = useStore((s) => s.addChannel);
  const platform = useStore((s) => s.view);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addChannel(platform, name);
      onClose();
    } catch (e) {
      setError(
        `${(e as Error).message}. Kick lookups need the local proxy running (npm run proxy).`
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Join a ${PLATFORMS[platform].label} channel`}
      subtitle="Enter a channel username (no # required)."
      onClose={onClose}
      footer={
        <button className={btnPrimary} disabled={!name.trim() || busy} onClick={submit}>
          {busy && <IcSpinner width={15} height={15} />}
          {busy ? "Joining…" : "Join"}
        </button>
      }
    >
      <PlatformHeader platform={platform} />
      <label className={label}>Channel</label>
      <input
        className={input}
        placeholder="channel_name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
      />
      {error && <p className="mt-3 text-[12px] leading-snug text-red-400">{error}</p>}
    </Modal>
  );
}

const DELAY_OPTIONS = [5, 10, 15, 30, 45, 60, 90, 120, 180];

export function PhrasesDialog({ onClose }: { onClose: () => void }) {
  const phrases = useStore((s) => s.phrases);
  const addPhrase = useStore((s) => s.addPhrase);
  const updatePhrase = useStore((s) => s.updatePhrase);
  const removePhrase = useStore((s) => s.removePhrase);
  const scheduleDelay = useStore((s) => s.scheduleDelay);
  const setScheduleDelay = useStore((s) => s.setScheduleDelay);
  const [draft, setDraft] = useState("");

  const add = () => {
    if (!draft.trim()) return;
    addPhrase(draft, scheduleDelay);
    setDraft("");
  };

  return (
    <Modal
      title="Quick phrases"
      subtitle="Add your own phrases and set how long the clock button waits before sending."
      onClose={onClose}
      footer={
        <button className={btnPrimary} onClick={onClose}>
          Done
        </button>
      }
    >
      <label className={label}>Schedule delay</label>
      <div className="relative mb-4">
        <select
          className={`${input} appearance-none pr-8`}
          value={scheduleDelay}
          onChange={(e) => setScheduleDelay(Number(e.target.value))}
        >
          {DELAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} seconds
            </option>
          ))}
        </select>
      </div>

      <label className={label}>Add phrase</label>
      <div className="mb-3 flex gap-2">
        <input
          className={input}
          placeholder="e.g. gg wp"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          className="flex shrink-0 items-center justify-center rounded-lg bg-brand px-3 text-white hover:bg-brand/90"
        >
          <IcPlus />
        </button>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto pb-1 pr-1 scrollbar-thin">
        {phrases.length === 0 && <p className="py-6 text-center text-sm text-muted">No phrases yet.</p>}
        {phrases.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <input
              className={input}
              value={p.text}
              onChange={(e) => updatePhrase(p.id, { text: e.target.value })}
            />
            <div className="relative w-20 shrink-0">
              <select
                className={`${input} appearance-none px-2 pr-6 text-center`}
                value={p.delay}
                onChange={(e) => updatePhrase(p.id, { delay: Number(e.target.value) })}
              >
                {DELAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => removePhrase(p.id)}
              className="shrink-0 rounded-md p-2 text-muted hover:bg-white/5 hover:text-red-400"
            >
              <IcTrash />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
