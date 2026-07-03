import { useEffect, type ReactNode } from "react";
import { IcClose } from "./Icons";

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, subtitle, onClose, children, footer }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/10 bg-bg-elev/85 shadow-2xl backdrop-blur-2xl animate-fade-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-100">{title}</h2>
            {subtitle && <p className="mt-1 text-[13px] leading-snug text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-slate-200"
          >
            <IcClose />
          </button>
        </div>
        <div className="px-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 p-5 pt-4">{footer}</div>}
      </div>
    </div>
  );
}
