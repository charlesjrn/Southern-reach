import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleEnum = z.enum(["admin", "management", "hr", "payroll", "employee"]);

/** Public: tells the setup page whether a first administrator still needs creating. */
export const needsSetup = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
  return { needsSetup: (count ?? 0) === 0 };
});

/** Public, one-time: creates the first System Administrator only while none exists. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      email: z.string().trim().email().max(255),
      full_name: z.string().trim().min(1).max(100),
      password: z.string().min(10).max(72),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Setup has already been completed.");
    // Claim setup first: the primary key stops a second simultaneous request from also creating an admin.
    const { error: lockErr } = await supabaseAdmin.from("setup_state").insert({ id: true });
    if (lockErr) throw new Error("Setup has already been completed.");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) {
      await supabaseAdmin.from("setup_state").delete().eq("id", true);
      throw new Error(error?.message ?? "Could not create account");
    }
    await supabaseAdmin.from("user_roles").insert([
      { user_id: created.user.id, role: "admin" },
      { user_id: created.user.id, role: "employee" },
    ]);
    return { ok: true };
  });

async function assertAdmin(supabase: any, userId: string, roles: string[] = ["admin"]) {
  const { data } = await supabase.rpc("has_any_role", { _user_id: userId, _roles: roles });
  if (!data) throw new Error("Forbidden");
}

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      email: z.string().trim().email().max(255),
      full_name: z.string().trim().min(1).max(100),
      password: z.string().min(10).max(72),
      roles: z.array(roleEnum).min(1),
      department_id: z.string().uuid().nullable().optional(),
      position_id: z.string().uuid().nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create account");
    const id = created.user.id;
    const { data: profileRow, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ department_id: data.department_id ?? null, position_id: data.position_id ?? null })
      .eq("id", id)
      .select("employee_id")
      .single();
    if (profileErr) throw new Error(profileErr.message);
    await supabaseAdmin.from("user_roles").insert(data.roles.map((role) => ({ user_id: id, role })));
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "CREATE_ACCOUNT", table_name: "profiles", record_id: id, details: { email: data.email, roles: data.roles } });
    return { id, employee_id: profileRow.employee_id };
  });

export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid(), roles: z.array(roleEnum).min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId && !data.roles.includes("admin")) throw new Error("You can't remove your own administrator role.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).not("role", "in", `(${data.roles.join(",")})`);
    await supabaseAdmin.from("user_roles").upsert(data.roles.map((role) => ({ user_id: data.user_id, role })), { onConflict: "user_id,role", ignoreDuplicates: true });
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("You can't deactivate your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ is_active: data.active }).eq("id", data.user_id);
    await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: data.active ? "none" : "876000h" });
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: data.active ? "REACTIVATE" : "DEACTIVATE", table_name: "profiles", record_id: data.user_id });
    return { ok: true };
  });
