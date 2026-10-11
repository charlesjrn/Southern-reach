import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signInWithEmployeeId } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { homeFor, type AppRole } from "@/lib/roles";
import { errMsg } from "@/components/common";

const schema = z.object({
  employeeId: z.string().trim().min(1, "Enter your Employee ID"),
  password: z.string().min(1, "Enter your password"),
});

export function LoginForm({ portal }: { portal: "staff" | "admin" }) {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ employeeId, password });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid input");
    setLoading(true);
    try {
      // The Employee ID check, password check, rate limit and portal check all happen on the server.
      const session = await signInWithEmployeeId({
        data: { employeeId: parsed.data.employeeId, password: parsed.data.password, portal },
      });
      const { error: sessionErr } = await supabase.auth.setSession(session);
      if (sessionErr) throw sessionErr;

      const { data: roleRows } = await supabase.from("user_roles").select("role");
      const roles = (roleRows ?? []).map((r) => r.role as AppRole);
      qc.invalidateQueries();
      toast.success("Welcome back");
      navigate({ to: portal === "admin" ? homeFor(roles) : "/dashboard", replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="employeeId">Employee ID</Label>
        <Input
          id="employeeId"
          autoComplete="username"
          autoCapitalize="characters"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          placeholder="SRM-1A2B3C4D"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
        </div>
        <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />} Sign in
      </Button>
      <p className="pt-2 text-center text-xs text-muted-foreground">
        {portal === "staff" ? (
          <>Administrator? <Link to="/admin-login" className="text-primary hover:underline">Use the admin portal</Link></>
        ) : (
          <>Staff member? <Link to="/login" className="text-primary hover:underline">Use staff sign-in</Link></>
        )}
      </p>
    </form>
  );
}
