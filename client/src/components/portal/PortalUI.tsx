import type { LucideIcon } from "lucide-react";
import { FileUp, Plus } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";

export const primaryButton = "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#10263c] px-4 text-xs font-extrabold text-white shadow-[0_10px_22px_rgba(16,38,60,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#193b58] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";
export const secondaryButton = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dde2e1] bg-white px-4 text-xs font-bold text-[#26384a] shadow-sm transition-all duration-200 hover:border-[#f18a3b]/50 hover:text-[#bc510b] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";
export const inputClass = "h-11 w-full rounded-xl border border-[#dfe3e1] bg-white px-3.5 text-sm text-[#13283d] outline-none transition-all placeholder:text-[#9ba4aa] focus:border-[#e87927] focus:ring-4 focus:ring-[#f18a3b]/10";
export const textareaClass = `${inputClass} h-24 resize-none py-3`;

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="mb-2 text-[10px] font-extrabold tracking-[0.2em] text-[#d66214] uppercase">{eyebrow}</p>
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em] text-[#10263c] uppercase sm:text-5xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6e7983]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <section className={`rounded-2xl border border-[#e1e5e3] bg-white shadow-[0_10px_38px_rgba(16,38,60,0.055)] ${className}`}>{children}</section>;
}

export function MetricCard({ icon: Icon, label, value, detail, tone = "navy" }: { icon: LucideIcon; label: string; value: string; detail: string; tone?: "navy" | "orange" | "green" | "red" }) {
  const tones = {
    navy: "bg-[#eaf0f5] text-[#173753]",
    orange: "bg-[#fff0e4] text-[#d66214]",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-600",
  };
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.12em] text-[#79838c] uppercase">{label}</p>
          <p className="font-display mt-3 text-3xl font-bold tracking-tight text-[#10263c] uppercase">{value}</p>
          <p className="mt-1 text-[11px] text-[#7a858e]">{detail}</p>
        </div>
        <span className={`flex size-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="size-[18px]" /></span>
      </div>
    </Panel>
  );
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: { icon: LucideIcon; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-[#f2f4f2] text-[#78848d]"><Icon className="size-5" /></div>
      <h3 className="mt-4 text-sm font-extrabold text-[#24374a]">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-5 text-[#7b858d]">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" className={`${secondaryButton} mt-5`} onClick={onAction}><Plus className="size-3.5" />{actionLabel}</button>
      ) : null}
    </div>
  );
}

export function Field({ label, children, hint }: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-2 text-[11px] font-bold text-[#324659]">
        {label}
        {hint ? <span className="font-medium text-[#8c969d]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function FilePicker({ multiple = true, onChange, label = "Add attachments" }: { multiple?: boolean; onChange: (files: FileList) => void; label?: string }) {
  return (
    <label className="group flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#cdd4d2] bg-[#fafbf9] px-4 text-center transition-colors hover:border-[#e87927]/60 hover:bg-[#fff8f2]">
      <FileUp className="size-5 text-[#d66214]" />
      <span className="mt-2 text-xs font-bold text-[#3d5062]">{label}</span>
      <span className="mt-1 text-[10px] text-[#89939a]">PDF, image, or office file · 6 MB each</span>
      <input type="file" multiple={multiple} className="sr-only" onChange={event => event.target.files && onChange(event.target.files)} />
    </label>
  );
}

export function StatusPill({ status }: { status: "active" | "ended" | "valid" | "warning" | "expired" | "going" | "return" }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    ended: "bg-slate-100 text-slate-600 ring-slate-500/10",
    valid: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    warning: "bg-amber-50 text-amber-700 ring-amber-600/10",
    expired: "bg-red-50 text-red-700 ring-red-600/10",
    going: "bg-[#eaf0f5] text-[#173753] ring-[#173753]/10",
    return: "bg-[#fff0e4] text-[#c9580e] ring-[#c9580e]/10",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-extrabold tracking-[0.08em] uppercase ring-1 ring-inset ${styles[status]}`}>{status}</span>;
}

export function DialogActions({ onCancel, submitLabel, busy = false }: { onCancel: () => void; submitLabel: string; busy?: boolean }) {
  return (
    <div className="mt-6 flex justify-end gap-3 border-t border-[#edf0ee] pt-5">
      <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
      <button type="submit" disabled={busy} className={primaryButton}>{busy ? "Saving…" : submitLabel}</button>
    </div>
  );
}
