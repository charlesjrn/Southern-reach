// @vitest-environment node
//
// Database permission tests. These run against a Supabase TEST project, never production.
// They are skipped unless these environment variables are set:
//   RLS_TEST_URL          the test project URL
//   RLS_TEST_ANON_KEY     the test project anon key
//   RLS_TEST_SERVICE_KEY  the test project service-role key (used only to create and clean up test users)
// Apply all migrations to the test project first.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env["RLS_TEST_URL"];
const ANON = process.env["RLS_TEST_ANON_KEY"];
const SERVICE = process.env["RLS_TEST_SERVICE_KEY"];
const enabled = Boolean(URL && ANON && SERVICE);

const RUN = Math.random().toString(36).slice(2, 8);
const PASSWORD = "Rls-Test-Password-2026!";
type Role = "admin" | "management" | "hr" | "payroll" | "employee";
type Actor = { id: string; email: string; client: SupabaseClient };
const actors: Partial<Record<string, Actor>> = {};
const createdUserIds: string[] = [];
const storagePaths: string[] = [];

const rows = (res: { data: unknown }) => (res.data as unknown[] | null) ?? [];
const who = (k: string) => {
  const a = actors[k];
  if (!a) throw new Error(`actor ${k} not created`);
  return a;
};

async function makeUser(key: string, roles: Role[]) {
  const admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
  const email = `rls-${key}-${RUN}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${key}` },
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);
  const { error: roleErr } = await admin.from("user_roles").insert(roles.map((role) => ({ user_id: data.user.id, role })));
  if (roleErr) throw roleErr;
  const client = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signErr) throw signErr;
  actors[key] = { id: data.user.id, email, client };
}

describe.skipIf(!enabled)("database permissions (test project)", () => {
  const admin = enabled ? createClient(URL!, SERVICE!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const anon = enabled ? createClient(URL!, ANON!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  let leaveOfEmployee = "";
  let leaveOfManagement = "";
  let publishedPayroll = "";

  beforeAll(async () => {
    await makeUser("admin", ["admin"]);
    await makeUser("management", ["management"]);
    await makeUser("hr", ["hr"]);
    await makeUser("payroll", ["payroll"]);
    await makeUser("employee", ["employee"]);
    await makeUser("other", ["employee"]);

    const emp = who("employee").id;
    const other = who("other").id;
    const mgmt = who("management").id;

    const { data: l1 } = await admin.from("leave_requests").insert({ profile_id: emp, leave_type: "annual", start_date: "2026-12-01", end_date: "2026-12-02", status: "submitted" }).select("id").single();
    leaveOfEmployee = l1!.id;
    const { data: l2 } = await admin.from("leave_requests").insert({ profile_id: mgmt, leave_type: "annual", start_date: "2026-12-05", end_date: "2026-12-05", status: "submitted" }).select("id").single();
    leaveOfManagement = l2!.id;

    const { data: p1 } = await admin.from("payroll_records").insert({ profile_id: emp, period_start: "2026-09-01", period_end: "2026-09-14", gross_pay: 1000, net_pay: 800, published: true }).select("id").single();
    publishedPayroll = p1!.id;
    await admin.from("payroll_records").insert({ profile_id: emp, period_start: "2026-10-01", period_end: "2026-10-14", gross_pay: 1000, net_pay: 800, published: false });
    await admin.from("payroll_records").insert({ profile_id: other, period_start: "2026-09-01", period_end: "2026-09-14", gross_pay: 900, net_pay: 700, published: true });

    const { data: ts } = await admin.from("timesheets").insert({ profile_id: other, week_start: "2026-09-07", status: "submitted" }).select("id").single();
    await admin.from("timesheet_entries").insert({ timesheet_id: ts!.id, work_date: "2026-09-07", hours: 8 });

    await admin.from("tasks").insert({ title: `Admin-only ${RUN}`, created_by: who("admin").id, assignee_id: other, status: "todo", priority: "low", progress: 0 });

    const path = `${emp}/rls-${RUN}.txt`;
    const { error: upErr } = await admin.storage.from("hr-documents").upload(path, new Blob(["own"]), { upsert: true });
    if (upErr) throw upErr;
    storagePaths.push(path);
    const otherPath = `${other}/rls-${RUN}.txt`;
    const { error: upErr2 } = await admin.storage.from("hr-documents").upload(otherPath, new Blob(["other"]), { upsert: true });
    if (upErr2) throw upErr2;
    storagePaths.push(otherPath);
  });

  afterAll(async () => {
    if (!enabled) return;
    if (storagePaths.length) await admin.storage.from("hr-documents").remove(storagePaths);
    for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
  });

  describe("anonymous visitors", () => {
    it("cannot read staff profiles", async () => {
      const res = await anon.from("profiles").select("id");
      expect(rows(res)).toHaveLength(0);
    });
    it("cannot call the contact lookup", async () => {
      const res = await anon.rpc("get_profile_contacts");
      expect(res.error || rows(res).length === 0).toBeTruthy();
    });
  });

  describe("employees", () => {
    it("see only their own leave", async () => {
      const res = await who("employee").client.from("leave_requests").select("id, profile_id");
      const ids = rows(res) as { id: string; profile_id: string }[];
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.every((r) => r.profile_id === who("employee").id)).toBe(true);
    });

    it("cannot file leave for someone else", async () => {
      const res = await who("employee").client.from("leave_requests").insert({
        profile_id: who("other").id, leave_type: "annual", start_date: "2026-12-10", end_date: "2026-12-10", status: "submitted",
      });
      expect(res.error).not.toBeNull();
    });

    it("cannot approve their own leave", async () => {
      const res = await who("employee").client.from("leave_requests").update({ status: "approved" }).eq("id", leaveOfEmployee).select("id");
      expect(res.error || rows(res).length === 0).toBeTruthy();
    });

    it("see only their own published payslips", async () => {
      const res = await who("employee").client.from("payroll_records").select("profile_id, published");
      const list = rows(res) as { profile_id: string; published: boolean }[];
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((r) => r.profile_id === who("employee").id && r.published)).toBe(true);
    });

    it("cannot read another employee's timesheet entries", async () => {
      const res = await who("employee").client.from("timesheet_entries").select("id");
      expect(rows(res)).toHaveLength(0);
    });

    it("cannot see tasks assigned to someone else", async () => {
      const res = await who("employee").client.from("tasks").select("title").eq("title", `Admin-only ${RUN}`);
      expect(rows(res)).toHaveLength(0);
    });

    it("cannot read another person's email address", async () => {
      const res = await who("employee").client.from("profiles").select("email").eq("id", who("other").id);
      expect(res.error).not.toBeNull();
    });

    it("the contact lookup returns only their own details", async () => {
      const res = await who("employee").client.rpc("get_profile_contacts");
      const list = rows(res) as { id: string }[];
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((r) => r.id === who("employee").id)).toBe(true);
    });

    it("cannot change their own email", async () => {
      const res = await who("employee").client.from("profiles").update({ email: `hack-${RUN}@example.test` }).eq("id", who("employee").id);
      expect(res.error).not.toBeNull();
    });

    it("cannot reactivate or change their own department", async () => {
      const res = await who("employee").client.from("profiles").update({ is_active: false }).eq("id", who("employee").id).select("id");
      expect(res.error || rows(res).length === 0).toBeTruthy();
    });

    it("cannot grant themselves a role", async () => {
      const res = await who("employee").client.from("user_roles").insert({ user_id: who("employee").id, role: "admin" });
      expect(res.error).not.toBeNull();
    });

    it("cannot read the audit log", async () => {
      const res = await who("employee").client.from("audit_logs").select("id");
      expect(rows(res)).toHaveLength(0);
    });

    it("cannot download another employee's HR document", async () => {
      const res = await who("employee").client.storage.from("hr-documents").download(`${who("other").id}/rls-${RUN}.txt`);
      expect(res.error).not.toBeNull();
    });

    it("can download their own HR document", async () => {
      const res = await who("employee").client.storage.from("hr-documents").download(`${who("employee").id}/rls-${RUN}.txt`);
      expect(res.error).toBeNull();
    });
  });

  describe("management", () => {
    it("cannot approve their own leave", async () => {
      const res = await who("management").client.from("leave_requests").update({ status: "approved" }).eq("id", leaveOfManagement).select("id");
      expect(res.error || rows(res).length === 0).toBeTruthy();
    });

    it("can approve an employee's leave", async () => {
      const res = await who("management").client.from("leave_requests").update({ status: "approved", reviewed_by: who("management").id }).eq("id", leaveOfEmployee).select("id");
      expect(res.error).toBeNull();
      expect(rows(res)).toHaveLength(1);
    });

    it("cannot read salary records", async () => {
      const res = await who("management").client.from("employment_records").select("hourly_rate, annual_salary");
      const list = rows(res) as { annual_salary: number | null }[];
      expect(list.every((r) => r.annual_salary === null)).toBe(true);
    });

    it("cannot read payroll records", async () => {
      const res = await who("management").client.from("payroll_records").select("id");
      expect(rows(res)).toHaveLength(0);
    });
  });

  describe("HR", () => {
    it("cannot read payroll records", async () => {
      const res = await who("hr").client.from("payroll_records").select("id");
      expect(rows(res)).toHaveLength(0);
    });

    it("cannot read the audit log", async () => {
      const res = await who("hr").client.from("audit_logs").select("id");
      expect(rows(res)).toHaveLength(0);
    });
  });

  describe("payroll officer", () => {
    it("can read all payroll records", async () => {
      const res = await who("payroll").client.from("payroll_records").select("profile_id");
      expect(rows(res).length).toBeGreaterThan(1);
    });
  });

  describe("administrator", () => {
    it("can read the audit log", async () => {
      const res = await who("admin").client.from("audit_logs").select("id").limit(5);
      expect(rows(res).length).toBeGreaterThan(0);
    });

    it("cannot change a published payslip", async () => {
      const res = await who("admin").client.from("payroll_records").update({ net_pay: 1 }).eq("id", publishedPayroll).select("id");
      expect(res.error).not.toBeNull();
    });
  });
});
