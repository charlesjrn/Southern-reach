import type { ReactNode } from "react";

export function AuthLayout({ eyebrow, title, subtitle, children, aside }: { eyebrow: string; title: string; subtitle?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand p-12 lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary font-display font-bold text-sidebar-primary-foreground">SR</div>
          <p className="font-display text-lg font-semibold text-sidebar-accent-foreground">Southern Reach Marketing</p>
        </div>
        <div className="mt-auto max-w-md">
          <h2 className="text-4xl font-semibold leading-tight text-sidebar-accent-foreground">Everything the team needs, in one place.</h2>
          <p className="mt-4 text-sidebar-foreground">Rosters, timesheets, leave, tasks and client work — for internal use by Southern Reach staff only.</p>
          {aside}
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-sidebar-primary/20 blur-3xl" />
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm animate-rise">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
