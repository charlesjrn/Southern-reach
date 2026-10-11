import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Southern Reach Agency Hub" },
      { name: "description", content: "Request a secure password reset link." },
      { property: "og:title", content: "Reset your password — Southern Reach" },
      { property: "og:description", content: "Request a secure password reset link." },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!z.string().email().safeParse(email.trim()).success) { toast.error("Enter a valid email"); return; }
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    setSent(true);
  };
  return (
    <AuthLayout eyebrow="Account recovery" title="Forgot your password?" subtitle="We'll email you a secure link to set a new one.">
      {sent ? (
        <p className="rounded-lg bg-success-soft p-4 text-sm text-success">If an account exists for that email, a reset link is on its way.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="e">Work email</Label><Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>Send reset link</Button>
        </form>
      )}
      <Link to="/login" className="mt-6 block text-center text-sm text-primary hover:underline">Back to sign in</Link>
    </AuthLayout>
  );
}
