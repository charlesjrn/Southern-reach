import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ShieldCheck, Users } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { needsSetup } from "@/lib/admin.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Southern Reach Agency Hub — Sign in" },
      { name: "description", content: "Internal staff and admin portal for Southern Reach Marketing." },
      { property: "og:title", content: "Southern Reach Agency Hub" },
      { property: "og:description", content: "Internal staff and admin portal for Southern Reach Marketing." },
    ],
  }),
  loader: async () => {
    const { needsSetup: setup } = await needsSetup();
    if (setup) throw redirect({ to: "/setup" });
    return null;
  },
  component: Index,
});

function Index() {
  return (
    <AuthLayout eyebrow="Agency Hub" title="Choose your portal" subtitle="Sign in with the work account your administrator created for you.">
      <div className="space-y-3">
        <Link to="/login" className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-card transition hover:border-primary">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary-soft text-primary"><Users className="size-5" /></div>
          <div><p className="font-semibold">Staff sign-in</p><p className="text-sm text-muted-foreground">Rosters, timesheets, leave and tasks</p></div>
        </Link>
        <Link to="/admin-login" className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-card transition hover:border-primary">
          <div className="flex size-11 items-center justify-center rounded-lg bg-info-soft text-info"><ShieldCheck className="size-5" /></div>
          <div><p className="font-semibold">Admin portal</p><p className="text-sm text-muted-foreground">Administrators, management, HR and payroll</p></div>
        </Link>
      </div>
    </AuthLayout>
  );
}
