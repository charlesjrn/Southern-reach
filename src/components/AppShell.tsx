import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, BarChart3, Briefcase, CalendarClock, CalendarDays, ClipboardList, LayoutDashboard,
  LogOut, Menu, ShieldCheck, Users, Wallet, Clock, UserCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { can, ROLE_LABELS, type AppRole } from "@/lib/roles";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type NavItem = { to: string; label: string; icon: typeof Bell; show?: (r: AppRole[]) => boolean };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/roster", label: "Roster", icon: CalendarClock },
  { to: "/timesheets", label: "Timesheets", icon: Clock },
  { to: "/leave", label: "Leave", icon: CalendarDays },
  { to: "/projects", label: "Clients & projects", icon: Briefcase },
  { to: "/payroll", label: "Payroll & payslips", icon: Wallet },
  { to: "/employees", label: "Employees", icon: Users, show: can.adminPortal },
  { to: "/reports", label: "Reports", icon: BarChart3, show: can.reports },
  { to: "/admin", label: "Administration", icon: ShieldCheck, show: can.systemAdmin },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">SR</div>
      <div className="leading-tight">
        <p className="font-display text-sm font-semibold text-sidebar-accent-foreground">Southern Reach</p>
        <p className="text-[11px] text-sidebar-muted">Agency Hub</p>
      </div>
    </div>
  );
}

function NavList({ roles, onNavigate }: { roles: AppRole[]; onNavigate?: () => void }) {
  return (
    <nav className="mt-6 flex flex-col gap-0.5">
      {NAV.filter((n) => !n.show || n.show(roles)).map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold [&>svg]:text-sidebar-primary" }}
        >
          <n.icon className="size-4" />
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

function Notifications({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications", userId],
    refetchInterval: 60_000,
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const unread = data.filter((n) => !n.read).length;
  const markAll = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && <button onClick={markAll} className="text-xs text-primary hover:underline">Mark all read</button>}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {data.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>}
          {data.map((n) => (
            <div key={n.id} className={`border-b px-4 py-3 last:border-0 ${n.read ? "" : "bg-primary-soft/40"}`}>
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">{fmtDateTime(n.created_at)}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const roles = me?.roles ?? [];
  const name = me?.profile?.full_name || me?.user.email || "";
  const topRole = (["admin", "management", "hr", "payroll", "employee"] as AppRole[]).find((r) => roles.includes(r));

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar px-3 py-5">
      <Brand />
      <NavList roles={roles} onNavigate={() => setOpen(false)} />
      <div className="mt-auto rounded-lg border border-sidebar-border p-3">
        <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{name}</p>
        <p className="text-xs text-sidebar-muted">{me?.profile?.employee_id} · {topRole ? ROLE_LABELS[topRole] : ""}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
        <p className="hidden text-sm text-muted-foreground sm:block">
          {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "Australia/Sydney" })}
        </p>
        <div className="ml-auto flex items-center gap-1">
          {me && <Notifications userId={me.user.id} />}
          <Button variant="ghost" size="icon" asChild aria-label="My profile">
            <Link to="/profile"><UserCircle className="size-5" /></Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
