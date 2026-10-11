import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Southern Reach Agency Hub" },
      { name: "description", content: "Choose a new password for your account." },
      { property: "og:title", content: "Set a new password — Southern Reach" },
      { property: "og:description", content: "Choose a new password for your account." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 10) { toast.error("Use at least 10 characters"); return; }
    if (pw !== pw2) { toast.error("Passwords do not match"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) { toast.error("This link has expired. Please request a new one."); return; }
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  };
  return (
    <AuthLayout eyebrow="Account recovery" title="Set a new password">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="p">New password</Label><PasswordInput id="p" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="p2">Confirm password</Label><PasswordInput id="p2" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>Update password</Button>
      </form>
    </AuthLayout>
  );
}
