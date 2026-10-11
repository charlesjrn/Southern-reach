import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { setUserActive, setUserRoles } from "@/lib/admin.functions";
import { can, ROLE_LABELS, type AppRole } from "@/lib/roles";
import { fmtDate, label } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, LoadingRows, NoAccess, PageHeader, Panel, SearchBox, StatusBadge, errMsg } from "@/components/common";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [{ title: "Employees — Southern Reach Agency Hub" }] }),
  component: EmployeesPage,
});

const EMPLOYMENT_TYPES = ["full_time", "part_time", "casual", "contractor"] as const;

function EmployeesPage() {
  const { data: me } = useMe();
  const roles = (me?.roles ?? []) as AppRole[];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  if (!me) return <LoadingRows />;
  if (!can.adminPortal(roles)) return <NoAccess />;

  const canEdit = can.manageStaff(roles); // admin and HR
  const seesSalary = roles.some((r) => r === "admin" || r === "hr" || r === "payroll");

  return (
    <>
      <PageHeader title="Employees" description="Staff records, departments and positions." />
      <Directory query={query} setQuery={setQuery} selectedId={selectedId} onSelect={setSelectedId} />
      {selectedId && (
        <EmployeeDetail id={selectedId} canEdit={canEdit} canDeactivate={can.systemAdmin(roles)} seesSalary={seesSalary} selfId={me?.user.id ?? ""} />
      )}
      {canEdit && <OrgStructure />}
    </>
  );
}

function Directory({ query, setQuery, selectedId, onSelect }: { query: string; setQuery: (v: string) => void; selectedId: string | null; onSelect: (id: string) => void }) {
  const { data: profiles, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, employee_id, is_active, department:departments(name), position:positions(title)")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: contacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profile_contacts");
      if (error) return [];
      return data ?? [];
    },
  });
  const emailById = new Map((contacts ?? []).map((c: any) => [c.id, c.email]));

  const q = query.trim().toLowerCase();
  const rows = (profiles ?? []).filter((p: any) =>
    !q || [p.full_name, p.employee_id, p.department?.name, p.position?.title].some((v) => String(v ?? "").toLowerCase().includes(q)),
  );

  return (
    <Panel title="Directory" action={<div className="w-56"><SearchBox value={query} onChange={setQuery} placeholder="Search name, ID, team…" /></div>}>
      {isLoading ? <LoadingRows /> : !rows.length ? <EmptyState title="No matching staff" /> : (
        <ul className="divide-y text-sm">
          {rows.map((p: any) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className={`flex w-full flex-col gap-1 py-3 text-left transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between ${selectedId === p.id ? "bg-muted/60" : ""}`}
              >
                <span>
                  <span className="font-medium">{p.full_name || "Unnamed"}</span>
                  <span className="text-muted-foreground"> · {p.employee_id}{p.department?.name ? ` · ${p.department.name}` : ""}{p.position?.title ? ` · ${p.position.title}` : ""}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground">{emailById.get(p.id) ?? ""}</span>
                  <StatusBadge status={p.is_active ? "active" : "inactive"} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function EmployeeDetail({ id, canEdit, canDeactivate, seesSalary, selfId }: { id: string; canEdit: boolean; canDeactivate: boolean; seesSalary: boolean; selfId: string }) {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, employee_id, phone, department_id, position_id, manager_id, is_active, created_at, department:departments(name), position:positions(title)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: employment } = useQuery({
    queryKey: ["employment", id],
    enabled: seesSalary,
    queryFn: async () => (await supabase.from("employment_records").select("*").eq("profile_id", id).maybeSingle()).data,
  });
  const { data: roleRows } = useQuery({
    queryKey: ["employee-roles", id],
    queryFn: async () => (await supabase.from("user_roles").select("role").eq("user_id", id)).data ?? [],
  });
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("id, name").order("name")).data ?? [],
  });
  const { data: positions } = useQuery({
    queryKey: ["positions"],
    queryFn: async () => (await supabase.from("positions").select("id, title, department_id").order("title")).data ?? [],
  });

  if (!profile) return <LoadingRows />;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["employees"] });
    qc.invalidateQueries({ queryKey: ["employee", id] });
  };

  const saveAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("profiles").update({
      department_id: (f.get("department") as string) || null,
      position_id: (f.get("position") as string) || null,
      manager_id: (f.get("manager") as string) || null,
    }).eq("id", id);
    if (error) return toast.error(errMsg(error));
    toast.success("Assignment saved");
    refresh();
  };

  const toggleActive = async () => {
    try {
      await setUserActive({ data: { user_id: id, active: !profile.is_active } });
      toast.success(profile.is_active ? "Account deactivated" : "Account reactivated");
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title={profile.full_name || "Employee"} action={<StatusBadge status={profile.is_active ? "active" : "inactive"} />}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Employee ID</dt><dd className="font-medium">{profile.employee_id}</dd></div>
          <div><dt className="text-muted-foreground">Joined</dt><dd className="font-medium">{fmtDate(profile.created_at)}</dd></div>
          <div><dt className="text-muted-foreground">Department</dt><dd className="font-medium">{profile.department?.name ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Position</dt><dd className="font-medium">{profile.position?.title ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Roles</dt><dd className="font-medium">{(roleRows ?? []).map((r: any) => ROLE_LABELS[r.role as AppRole]).join(", ") || "—"}</dd></div>
        </dl>
        {canDeactivate && id !== selfId && (
          <div className="mt-5 border-t pt-4">
            <Button variant={profile.is_active ? "outline" : "default"} onClick={toggleActive}>
              {profile.is_active ? "Deactivate account" : "Reactivate account"}
            </Button>
          </div>
        )}
      </Panel>

      {canDeactivate && id !== selfId && roleRows && (
        <Panel title="Roles">
          <RoleEditor
            key={roleRows.map((r: any) => r.role).join(",")}
            id={id}
            current={roleRows.map((r: any) => r.role as AppRole)}
            onSaved={refresh}
          />
        </Panel>
      )}
      {canEdit && (
        <Panel title="Assignment">
          <form onSubmit={saveAssignment} className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dept">Department</Label>
              <select id="dept" name="department" defaultValue={profile.department_id ?? ""} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">None</option>
                {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos">Position</Label>
              <select id="pos" name="position" defaultValue={profile.position_id ?? ""} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">None</option>
                {positions?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mgr">Manager ID</Label>
              <Input id="mgr" name="manager" defaultValue={profile.manager_id ?? ""} placeholder="Leave blank if none" />
            </div>
            <div><Button type="submit">Save assignment</Button></div>
          </form>
          {canEdit && <EmploymentForm id={id} current={employment} seesSalary={seesSalary} onSaved={refresh} />}
        </Panel>
      )}

      {!canEdit && seesSalary && employment && (
        <Panel title="Employment">
          <p className="text-sm">{label(employment.employment_type)} · Started {fmtDate(employment.start_date)} · {employment.standard_hours} hours per week</p>
        </Panel>
      )}
    </div>
  );
}

function EmploymentForm({ id, current, seesSalary, onSaved }: { id: string; current: any; seesSalary: boolean; onSaved: () => void }) {
  const [form, setForm] = useState({
    employment_type: current?.employment_type ?? "full_time",
    start_date: current?.start_date ?? "",
    end_date: current?.end_date ?? "",
    standard_hours: String(current?.standard_hours ?? 38),
    award: current?.award ?? "",
    hourly_rate: current?.hourly_rate ?? "",
    annual_salary: current?.annual_salary ?? "",
    emergency_contact_name: current?.emergency_contact_name ?? "",
    emergency_contact_phone: current?.emergency_contact_phone ?? "",
  });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("employment_records").upsert({
      profile_id: id,
      employment_type: form.employment_type as (typeof EMPLOYMENT_TYPES)[number],
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      standard_hours: Number(form.standard_hours) || 38,
      award: form.award.trim() || null,
      hourly_rate: seesSalary && form.hourly_rate !== "" ? Number(form.hourly_rate) : null,
      annual_salary: seesSalary && form.annual_salary !== "" ? Number(form.annual_salary) : null,
      emergency_contact_name: form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
    }, { onConflict: "profile_id" });
    if (error) return toast.error(errMsg(error));
    toast.success("Employment record saved");
    onSaved();
  };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <form onSubmit={save} className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2"><p className="text-sm font-semibold">Employment record</p></div>
      <div className="space-y-1.5">
        <Label htmlFor="etype">Employment type</Label>
        <select id="etype" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.employment_type} onChange={set("employment_type")}>
          {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
        </select>
      </div>
      <div className="space-y-1.5"><Label htmlFor="shrs">Standard hours per week</Label><Input id="shrs" type="number" min="0" max="80" step="0.5" value={form.standard_hours} onChange={set("standard_hours")} /></div>
      <div className="space-y-1.5"><Label htmlFor="sdt">Start date</Label><Input id="sdt" type="date" value={form.start_date} onChange={set("start_date")} /></div>
      <div className="space-y-1.5"><Label htmlFor="edt">End date</Label><Input id="edt" type="date" value={form.end_date} onChange={set("end_date")} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="award">Award or agreement</Label><Input id="award" maxLength={150} value={form.award} onChange={set("award")} /></div>
      {seesSalary && (
        <>
          <div className="space-y-1.5"><Label htmlFor="hr">Hourly rate (AUD)</Label><Input id="hr" type="number" min="0" step="0.01" value={form.hourly_rate} onChange={set("hourly_rate")} /></div>
          <div className="space-y-1.5"><Label htmlFor="sal">Annual salary (AUD)</Label><Input id="sal" type="number" min="0" step="0.01" value={form.annual_salary} onChange={set("annual_salary")} /></div>
        </>
      )}
      <div className="space-y-1.5"><Label htmlFor="ecn">Emergency contact</Label><Input id="ecn" maxLength={150} value={form.emergency_contact_name} onChange={set("emergency_contact_name")} /></div>
      <div className="space-y-1.5"><Label htmlFor="ecp">Emergency phone</Label><Input id="ecp" maxLength={30} value={form.emergency_contact_phone} onChange={set("emergency_contact_phone")} /></div>
      <div className="sm:col-span-2"><Button type="submit">Save employment record</Button></div>
    </form>
  );
}

function OrgStructure() {
  const qc = useQueryClient();
  const [dept, setDept] = useState({ name: "", description: "" });
  const [pos, setPos] = useState({ title: "", department_id: "" });
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("id, name").order("name")).data ?? [],
  });

  const addDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dept.name.trim()) return toast.error("Enter a department name.");
    const { error } = await supabase.from("departments").insert({ name: dept.name.trim(), description: dept.description.trim() || null });
    if (error) return toast.error(errMsg(error));
    setDept({ name: "", description: "" });
    qc.invalidateQueries({ queryKey: ["departments"] });
  };

  const addPos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pos.title.trim()) return toast.error("Enter a position title.");
    const { error } = await supabase.from("positions").insert({ title: pos.title.trim(), department_id: pos.department_id || null });
    if (error) return toast.error(errMsg(error));
    setPos({ title: "", department_id: "" });
    qc.invalidateQueries({ queryKey: ["positions"] });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Add department">
        <form onSubmit={addDept} className="grid gap-4">
          <div className="space-y-1.5"><Label htmlFor="dn">Name</Label><Input id="dn" maxLength={100} value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="dd">Description</Label><Input id="dd" maxLength={300} value={dept.description} onChange={(e) => setDept({ ...dept, description: e.target.value })} /></div>
          <div><Button type="submit">Add department</Button></div>
        </form>
      </Panel>
      <Panel title="Add position">
        <form onSubmit={addPos} className="grid gap-4">
          <div className="space-y-1.5"><Label htmlFor="pt">Title</Label><Input id="pt" maxLength={100} value={pos.title} onChange={(e) => setPos({ ...pos, title: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="pd">Department</Label>
            <select id="pd" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={pos.department_id} onChange={(e) => setPos({ ...pos, department_id: e.target.value })}>
              <option value="">None</option>
              {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div><Button type="submit">Add position</Button></div>
        </form>
      </Panel>
    </div>
  );
}

const STAFF_ROLE_OPTIONS = ["management", "hr", "payroll", "employee"] as const;

function RoleEditor({ id, current, onSaved }: { id: string; current: AppRole[]; onSaved: () => void }) {
  const [roles, setRoles] = useState<string[]>(current.filter((r) => r !== "admin"));
  const [saving, setSaving] = useState(false);
  const toggle = (r: string) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  const save = async () => {
    if (roles.length === 0) return toast.error("Choose at least one role.");
    setSaving(true);
    try {
      await setUserRoles({ data: { user_id: id, roles: roles as (typeof STAFF_ROLE_OPTIONS)[number][] } });
      toast.success("Roles updated");
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-4">
        {STAFF_ROLE_OPTIONS.map((r) => (
          <label key={r} className="flex items-center gap-2">
            <input type="checkbox" checked={roles.includes(r)} onChange={() => toggle(r)} className="size-4 accent-[var(--color-primary)]" />
            {ROLE_LABELS[r as AppRole]}
          </label>
        ))}
      </div>
      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save roles"}</Button>
    </div>
  );
}
