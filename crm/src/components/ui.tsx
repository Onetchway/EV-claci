"use client";

import { X } from "lucide-react";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";

import { cn, colorFromString, initials } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Buttons & form controls
// ---------------------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500",
  secondary: "border border-ink-300 bg-white text-ink-800 hover:bg-ink-50 focus-visible:ring-ink-400",
  ghost: "text-ink-600 hover:bg-ink-100 focus-visible:ring-ink-400",
  danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500",
  subtle: "bg-ink-100 text-ink-800 hover:bg-ink-200 focus-visible:ring-ink-400",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className ?? "h-4 w-4")} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Field({
  label, hint, error, required, children, className,
}: {
  label: string; hint?: string; error?: string; required?: boolean;
  children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("input", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("input min-h-[76px] resize-y", props.className)} />;
}

export function Select({
  options, placeholder, ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select {...rest} className={cn("input", rest.className)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Checkbox({
  label, checked, onChange, disabled,
}: {
  label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-sm text-ink-800", disabled && "cursor-not-allowed opacity-60")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function Badge({
  className, children, title,
}: { className?: string; children: ReactNode; title?: string }) {
  return <span title={title} className={cn("chip", className ?? "bg-ink-100 text-ink-700 ring-ink-200")}>{children}</span>;
}

export function Card({
  title, subtitle, actions, children, className, bodyClassName,
}: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode;
  children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn("card", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-ink-200 px-4 py-3 sm:px-5">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("card-pad", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({
  label, value, sub, tone = "default", icon,
}: {
  label: string; value: ReactNode; sub?: ReactNode;
  tone?: "default" | "positive" | "negative" | "warn"; icon?: ReactNode;
}) {
  const toneCls = {
    default: "text-ink-900",
    positive: "text-emerald-600",
    negative: "text-rose-600",
    warn: "text-amber-600",
  }[tone];
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        {icon && <span className="text-ink-400">{icon}</span>}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight", toneCls)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

export function Avatar({ name, size = 32 }: { name?: string | null; size?: number }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        colorFromString(name ?? "?"),
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={name ?? undefined}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({
  title, description, action, icon,
}: {
  title: string; description?: string; action?: ReactNode; icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-white px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-300">{icon}</div>}
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title, description, actions, className,
}: {
  title: string; description?: string; actions?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-ink-200", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          clamped >= 100 ? "bg-emerald-500" : clamped >= 50 ? "bg-brand-500" : "bg-amber-500",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({
  open, onClose, title, description, children, footer, wide,
}: {
  open: boolean; onClose: () => void; title: string; description?: string;
  children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/40 p-4 sm:p-8">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 w-full rounded-xl bg-white shadow-xl",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-ink-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-ink-200 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

interface Toast { id: number; message: string; tone: "success" | "error" | "info" }

const ToastContext = createContext<{
  push: (message: string, tone?: Toast["tone"]) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ring-inset",
              t.tone === "success" && "bg-emerald-50 text-emerald-900 ring-emerald-200",
              t.tone === "error" && "bg-rose-50 text-rose-900 ring-rose-200",
              t.tone === "info" && "bg-white text-ink-800 ring-ink-200",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>.");
  return ctx;
}

/** Wrap an async handler so failures surface as a toast instead of a dead click. */
export function useAsyncAction() {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (fn: () => Promise<void>, successMessage?: string) => {
      setBusy(true);
      try {
        await fn();
        if (successMessage) push(successMessage, "success");
      } catch (e) {
        push((e as Error).message || "Something went wrong.", "error");
      } finally {
        setBusy(false);
      }
    },
    [push],
  );

  return { busy, run };
}
