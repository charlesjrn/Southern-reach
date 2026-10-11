import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMPLOYEE = 5;
const MAX_FAILURES_PER_IP = 20;
const PORTAL_ROLES = ["admin", "management", "hr", "payroll"];
const FAILED = "Incorrect Employee ID or password.";
const LOCKED = "Too many sign-in attempts. Wait 15 minutes and try again, or ask your administrator.";

function clientIp(): string | null {
  const req = getRequest();
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

/**
 * Signs staff in with Employee ID and password. The lookup and password check run on the server,
 * so no email address is sent to the browser. Returns session tokens only on success.
 */
export const signInWithEmployeeId = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        employeeId: z.string().trim().toUpperCase().min(3).max(20),
        password: z.string().min(1).max(200),
        portal: z.enum(["staff", "admin"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = clientIp();
    const since = new Date(Date.now() - WINDOW_MS).toISOString();

    const employeeFailures = await supabaseAdmin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", data.employeeId)
      .eq("succeeded", false)
      .gte("attempted_at", since);
    const ipFailures = ip
      ? await supabaseAdmin.from("login_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).eq("succeeded", false).gte("attempted_at", since)
      : null;
    if ((employeeFailures.count ?? 0) >= MAX_FAILURES_PER_EMPLOYEE || (ipFailures?.count ?? 0) >= MAX_FAILURES_PER_IP) {
      throw new Error(LOCKED);
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, is_active")
      .eq("employee_id", data.employeeId)
      .maybeSingle();

    let session: { access_token: string; refresh_token: string } | null = null;
    let roles: string[] = [];
    if (profile?.is_active && profile.email) {
      // A separate client with no stored session, used only to check the password.
      const checker = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: auth } = await checker.auth.signInWithPassword({ email: profile.email, password: data.password });
      if (auth.session) {
        const { data: roleRows } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", profile.id);
        roles = (roleRows ?? []).map((r) => r.role);
        const allowed = data.portal === "admin" ? roles.some((r) => PORTAL_ROLES.includes(r)) : true;
        if (allowed) {
          session = { access_token: auth.session.access_token, refresh_token: auth.session.refresh_token };
        }
      }
    }

    await supabaseAdmin.from("login_attempts").insert({ employee_id: data.employeeId, ip, succeeded: !!session });
    if (!session) {
      if (profile?.is_active && data.portal === "admin" && roles.length && !roles.some((r) => PORTAL_ROLES.includes(r))) {
        throw new Error("This portal is for administrators and managers. Please use the staff sign-in.");
      }
      throw new Error(FAILED);
    }
    return session;
  });
