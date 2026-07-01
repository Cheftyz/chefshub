import { useToasts } from "../lib/toast";
import { IcCheck } from "./Icons";

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-72 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-line bg-bg-elev px-3.5 py-2.5 text-sm text-slate-100 shadow-xl animate-slide-in"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <IcCheck width={13} height={13} />
          </span>
          <span className="truncate">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
