import type { ReactNode } from "react";
import { Inbox, Search, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { label } from "@/lib/format";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="animate-rise relative overflow-hidden rounded-2xl border bg-card px-5 py-6 shadow-card sm:px-7">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1.5" style={{ background: "var(--gradient-brand)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full opacity-[0.18] blur-3xl" style={{ background: "var(--gradient-brand)" }} />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl"><span className="text-gradient">{title}</span></h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

const STATUS: Record<string, "success" | "warning" | "info" | "danger" | "muted" | "brand"> = {
  approved: "success", done: "success", completed: "success", active: "success",
  submitted: "warning", review: "warning", in_progress: "info", planning: "info",
  rejected: "danger", cancelled: "danger", urgent: "danger", high: "brand",
  draft: "muted", todo: "muted", on_hold: "muted", low: "muted", medium: "info", inactive: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS[status] ?? "muted"}>{label(status)}</Badge>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <Inbox className="mb-3 size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function NoAccess() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-16 text-center">
      <ShieldAlert className="mb-3 size-8 text-primary" />
      <p className="font-medium">You don't have access to this area</p>
      <p className="mt-1 text-sm text-muted-foreground">Ask a System Administrator if you think this is a mistake.</p>
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  );
}

export function Panel({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border bg-card p-5 shadow-card transition-shadow duration-300 hover:shadow-pop sm:p-6 animate-rise ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-3 border-b pb-3">
          {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label: l, value, icon, tone = "brand" }: { label: string; value: ReactNode; icon: ReactNode; tone?: "brand" | "info" | "success" | "warning" }) {
  const tones = { brand: "bg-primary-soft text-primary", info: "bg-info-soft text-info", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning" };
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-card animate-rise">
      <div className={`flex size-11 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{l}</p>
        <p className="font-display text-2xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Something went wrong";
}
