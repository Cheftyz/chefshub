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
import {
  DashboardPage,
  ActivityPage,
  CommandsPage,
  TimersPage,
  QuotesPage,
  GiveawaysPage,
} from "./components/pages";
import { AddAccountDialog, JoinChannelDialog, PhrasesDialog } from "./components/dialogs";

type Dialog = null | "account" | "channel" | "phrases";

export default function App() {
  const [dialog, setDialog] = useState<Dialog>(null);

  const page = useStore((s) => s.page);
  const accounts = useStore((s) => s.accounts);
  const channels = useStore((s) => s.channels);
  const autoEnabled = useStore((s) => s.autoEnabled);
  const autoInterval = useStore((s) => s.autoInterval);
  const tickScheduled = useStore((s) => s.tickScheduled);
  const runAuto = useStore((s) => s.runAuto);
  const runTimers = useStore((s) => s.runTimers);
  const loadBots = useStore((s) => s.loadBots);
  const clearBots = useStore((s) => s.clearBots);
  const loadGroups = useStore((s) => s.loadGroups);
  const clearGroups = useStore((s) => s.clearGroups);
  const loadTools = useStore((s) => s.loadTools);
  const clearTools = useStore((s) => s.clearTools);

  // load this user's server data once signed in
  const userId = useAuth((s) => s.user?.id ?? null);
  useEffect(() => {
    if (userId) {
      loadBots();
      loadGroups();
      loadTools();
    } else {
      clearBots();
      clearGroups();
      clearTools();
    }
  }, [userId, loadBots, clearBots, loadGroups, clearGroups, loadTools, clearTools]);

  useEffect(() => {
    chat.sync(accounts, channels);
  }, [accounts, channels]);

  useEffect(() => {
    const t = setInterval(() => tickScheduled(), 250);
    return () => clearInterval(t);
  }, [tickScheduled]);

  useEffect(() => {
    if (!autoEnabled) return;
    const t = setInterval(() => runAuto(), Math.max(1, autoInterval) * 1000);
    return () => clearInterval(t);
  }, [autoEnabled, autoInterval, runAuto]);

  // recurring timers
  useEffect(() => {
    const t = setInterval(() => runTimers(), 15000);
    return () => clearInterval(t);
  }, [runTimers]);

  const openAdd = () => setDialog("account");
  const openJoin = () => setDialog("channel");

  const renderPage = () => {
    switch (page) {
      case "activity":
        return <ActivityPage />;
      case "commands":
        return <CommandsPage />;
      case "timers":
        return <TimersPage />;
      case "quotes":
        return <QuotesPage />;
      case "giveaways":
        return <GiveawaysPage />;
      case "admin":
        return <AdminPanel />;
      case "chat":
        return <ChatArea />;
      case "dashboard":
      default:
        return <DashboardPage onAddAccount={openAdd} onJoinChannel={openJoin} />;
    }
  };

  const showComposer = page !== "admin";

  return (
    <AuthGate>
      <div className="flex h-screen w-screen flex-col overflow-hidden text-slate-200">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar onAddAccount={openAdd} onJoinChannel={openJoin} />
          <main className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden">{renderPage()}</div>
            {showComposer && <Composer onEditPhrases={() => setDialog("phrases")} />}
          </main>
        </div>

        {dialog === "account" && <AddAccountDialog onClose={() => setDialog(null)} />}
        {dialog === "channel" && <JoinChannelDialog onClose={() => setDialog(null)} />}
        {dialog === "phrases" && <PhrasesDialog onClose={() => setDialog(null)} />}

        <Toasts />
      </div>
    </AuthGate>
  );
}
