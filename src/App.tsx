import { useEffect, useState } from "react";
import { useStore } from "./lib/store";
import { useAuth } from "./lib/auth";
import { chat } from "./lib/chat";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { Composer } from "./components/Composer";
import { Toasts } from "./components/Toasts";
import { AuthGate } from "./components/AuthGate";
import { AdminPanel } from "./components/AdminPanel";
import { AddAccountDialog, JoinChannelDialog, PhrasesDialog } from "./components/dialogs";

type Dialog = null | "account" | "channel" | "phrases";

export default function App() {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [screen, setScreen] = useState<"app" | "admin">("app");

  const accounts = useStore((s) => s.accounts);
  const channels = useStore((s) => s.channels);
  const autoEnabled = useStore((s) => s.autoEnabled);
  const autoInterval = useStore((s) => s.autoInterval);
  const tickScheduled = useStore((s) => s.tickScheduled);
  const runAuto = useStore((s) => s.runAuto);
  const loadBots = useStore((s) => s.loadBots);
  const clearBots = useStore((s) => s.clearBots);

  // load this user's bots from the server once they're signed in
  const userId = useAuth((s) => s.user?.id ?? null);
  useEffect(() => {
    if (userId) loadBots();
    else clearBots();
  }, [userId, loadBots, clearBots]);

  // reconnect accounts/channels whenever the set changes
  useEffect(() => {
    chat.sync(accounts, channels);
  }, [accounts, channels]);

  // fire due scheduled messages
  useEffect(() => {
    const t = setInterval(() => tickScheduled(), 250);
    return () => clearInterval(t);
  }, [tickScheduled]);

  // auto-send loop
  useEffect(() => {
    if (!autoEnabled) return;
    const t = setInterval(() => runAuto(), Math.max(1, autoInterval) * 1000);
    return () => clearInterval(t);
  }, [autoEnabled, autoInterval, runAuto]);

  return (
    <AuthGate>
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-slate-200">
      <TopBar screen={screen} onScreen={setScreen} />
      {screen === "admin" ? (
        <AdminPanel />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            onAddAccount={() => setDialog("account")}
            onJoinChannel={() => setDialog("channel")}
          />
          <main className="flex flex-1 flex-col overflow-hidden">
            <ChatArea />
            <Composer onEditPhrases={() => setDialog("phrases")} />
          </main>
        </div>
      )}

      {dialog === "account" && <AddAccountDialog onClose={() => setDialog(null)} />}
      {dialog === "channel" && <JoinChannelDialog onClose={() => setDialog(null)} />}
      {dialog === "phrases" && <PhrasesDialog onClose={() => setDialog(null)} />}

      <Toasts />
    </div>
    </AuthGate>
  );
}
