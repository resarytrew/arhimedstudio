import type { ReactNode } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "../utils/cn";

interface Props {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  maximized?: boolean;
  onMaximize?: () => void;
  onClose?: () => void;
  className?: string;
  bodyClassName?: string;
}

export function IconBtn({
  children,
  onClick,
  title,
  active,
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
        active && "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Panel({ title, icon, children, actions, maximized, onMaximize, onClose, className, bodyClassName }: Props) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.04] dark:bg-slate-900 dark:ring-white/[0.06]",
        className
      )}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-slate-100 pl-3.5 pr-1.5 dark:border-white/5">
        <span className="text-slate-500 dark:text-slate-400">{icon}</span>
        <h2 className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100">{title}</h2>
        <div className="ml-auto flex items-center gap-0.5">
          {actions}
          {onMaximize && (
            <IconBtn onClick={onMaximize} title={maximized ? "Свернуть" : "Развернуть"}>
              {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </IconBtn>
          )}
          {onClose && (
            <IconBtn onClick={onClose} title="Скрыть панель">
              <X size={15} />
            </IconBtn>
          )}
        </div>
      </header>
      <div className={cn("relative min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
