import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { bootstrapAdmin, needsSetup } from "@/lib/admin.functions";
import { errMsg } from "@/components/common";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "First-time setup — Southern Reach Agency Hub" },
      { name: "description", content: "Create the first System Administrator account." },
      { property: "og:title", content: "First-time setup — Southern Reach" },
      { property: "og:description", content: "Create the first System Administrator account." },
    ],
  }),
  loader: async () => {
    const { needsSetup: setup } = await needsSetup();
    if (!setup) throw redirect({ to: "/admin-login" });
    return null;
  },
  component: Setup,
});

function Setup() {
  const run = useServerFn(bootstrapAdmin);
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "admin@domain.com", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 10) { toast.error("Password must be at least 10 characters"); return; }
    setLoading(true);
    try {
      await run({ data: form });
      toast.success("Administrator created — please sign in");
      navigate({ to: "/admin-login" });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout eyebrow="First-time setup" title="Create the administrator" subtitle="This page only works once — while no System Administrator exists.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="n">Full name</Label><Input id="n" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="e">Email</Label><Input id="e" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="p">Password (10+ characters)</Label><PasswordInput id="p" required minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} Create administrator</Button>
      </form>
    </AuthLayout>
  );
}
