import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe, useStaffList } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { createStaff, setUserActive } from "@/lib/admin.functions";
import { ALL_ROLES, ROLE_LABELS, can, type AppRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingRows, NoAccess, PageHeader, Panel, StatusBadge, errMsg } from "@/components/common";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administration — Southern Reach Agency Hub" }] }),
  component: Admin,
});

function Admin() {
  const { data: me } = useMe();
  const { data, isLoading } = useStaffList();
  const qc = useQueryClient();
  if (!me) return <LoadingRows />;
  if (!can.systemAdmin(me.roles as AppRole[])) return <NoAccess />;

  const refresh = () => qc.invalidateQueries({ queryKey: ["staff-list"] });

  const toggleActive = async (id: string, active: boolean) => {
    try {
      await setUserActive({ data: { user_id: id, active } });
      toast.success(active ? "Account reactivated" : "Account deactivated");
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <PageHeader title="Administration" description="Create staff accounts, assign roles and manage access." />
      <AddStaffForm onCreated={refresh} />
      <Panel title="Staff accounts">
        {isLoading ? <LoadingRows /> : (
          <ul className="divide-y">
            {data?.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{p.full_name || "Unnamed"}</p>
                  <p className="truncate text-muted-foreground">
                    {p.employee_id} · {p.email ?? "No email on file"}{p.department?.name ? ` · ${p.department.name}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.is_active ? "active" : "inactive"} />
                  {p.id !== me?.user.id && (
                    <Button size="sm" variant="outline" onClick={() => toggleActive(p.id, !p.is_active)}>
                      {p.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
            {data?.length === 0 && <li className="py-3 text-sm text-muted-foreground">No staff accounts yet.</li>}
          </ul>
        )}
      </Panel>
    </>
  );
}

const emptyForm = { full_name: "", email: "", password: "", department_id: "" };

function AddStaffForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const [roles, setRoles] = useState<AppRole[]>(["employee"]);
  const [saving, setSaving] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("id, name").order("name")).data ?? [],
  });

  const toggleRole = (r: AppRole) =>
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 10) return toast.error("Temporary password must be at least 10 characters.");
    if (roles.length === 0) return toast.error("Choose at least one role.");
    setSaving(true);
    try {
      const created = await createStaff({
        data: {
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          department_id: form.department_id || null,
          roles,
        },
      });
      toast.success(`Account created. Employee ID: ${created.employee_id}. Share the temporary password securely.`, { duration: 15000 });
      setForm(emptyForm);
      setRoles(["employee"]);
      onCreated();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Add staff member">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new_email">Work email</Label>
          <Input id="new_email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="temp_password">Temporary password</Label>
          <Input id="temp_password" type="text" required minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="department">Department</Label>
          <select
            id="department"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.department_id}
            onChange={(e) => setForm({ ...form, department_id: e.target.value })}
          >
            <option value="">No department</option>
            {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">Roles</legend>
          <p className="mb-2 text-xs text-muted-foreground">There is one System Administrator account. New accounts are staff roles only.</p>
          <div className="flex flex-wrap gap-4">
            {ALL_ROLES.filter((r) => r !== "admin").map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} className="size-4 accent-[var(--color-primary)]" />
                {ROLE_LABELS[r]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create account"}</Button>
        </div>
      </form>
    </Panel>
  );
}
