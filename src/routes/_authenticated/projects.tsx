import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { can, type AppRole } from "@/lib/roles";
import { fmtAUD, fmtDate, label } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingRows, NoAccess, PageHeader, Panel, StatusBadge, errMsg } from "@/components/common";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Clients & projects — Southern Reach Agency Hub" }] }),
  component: ProjectsPage,
});

const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

function ProjectsPage() {
  const { data: me } = useMe();
  if (!me) return <LoadingRows />;
  if (!can.viewProjects(me.roles as AppRole[])) return <NoAccess />;
  const canManage = can.manageProjects(me.roles as AppRole[]);
  return (
    <>
      <PageHeader title="Clients & projects" description="Client records and the campaigns and projects being delivered for them." />
      {canManage && <ClientForm />}
      <Clients canManage={canManage} />
      {canManage && <ProjectForm />}
      <Projects canManage={canManage} />
    </>
  );
}

function ClientForm() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", contact_name: "", contact_email: "" });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Enter the client name.");
    const { error } = await supabase.from("clients").insert({
      name: form.name.trim(),
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
    });
    if (error) return toast.error(errMsg(error));
    toast.success("Client added");
    setForm({ name: "", contact_name: "", contact_email: "" });
    qc.invalidateQueries({ queryKey: ["clients"] });
  };
  return (
    <Panel title="Add client">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="cn">Client name</Label><Input id="cn" maxLength={150} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="cc">Contact name</Label><Input id="cc" maxLength={150} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="ce">Contact email</Label><Input id="ce" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
        <div className="sm:col-span-3"><Button type="submit">Add client</Button></div>
      </form>
    </Panel>
  );
}

function Clients({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("name")).data ?? [],
  });
  return (
    <Panel title="Clients">
      {isLoading ? <LoadingRows /> : !data?.length ? <EmptyState title="No clients yet" hint="Add a client above, then link projects to them." /> : (
        <ul className="divide-y">
          {data.map((c) => <ClientRow key={c.id} c={c} canManage={canManage} />)}
        </ul>
      )}
    </Panel>
  );
}

function ClientRow({ c, canManage }: { c: any; canManage: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: c.name, contact_name: c.contact_name ?? "", contact_email: c.contact_email ?? "" });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Enter the client name.");
    const { data, error } = await supabase.from("clients").update({
      name: form.name.trim(),
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
    }).eq("id", c.id).select("id");
    if (error) return toast.error(errMsg(error));
    if (!data?.length) return toast.error("You don't have permission to change this client.");
    toast.success("Client updated");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${c.name}? Its projects will stay, but lose the client link.`)) return;
    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Client deleted");
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  if (editing) {
    return (
      <li className="grid gap-3 py-4 sm:grid-cols-3">
        <Input aria-label="Client name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input aria-label="Contact name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
        <Input aria-label="Contact email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
        <div className="flex gap-2 sm:col-span-3">
          <Button size="sm" onClick={save}>Save</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{c.name}</p>
        <p className="truncate text-muted-foreground">{[c.contact_name, c.contact_email].filter(Boolean).join(" · ") || "No contact details"}</p>
      </div>
      {canManage && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={remove}>Delete</Button>
        </div>
      )}
    </li>
  );
}

function ProjectForm() {
  const qc = useQueryClient();
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });
  const [form, setForm] = useState({ name: "", client_id: "", status: "planning", start_date: "", due_date: "", budget: "", description: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Enter a project name.");
    if (form.start_date && form.due_date && form.due_date < form.start_date) return toast.error("Due date must be after the start date.");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("projects").insert({
      name: form.name.trim(),
      client_id: form.client_id || null,
      status: form.status as (typeof PROJECT_STATUSES)[number],
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      budget: form.budget ? Number(form.budget) : null,
      description: form.description.trim() || null,
      owner_id: auth.user?.id ?? null,
    });
    if (error) return toast.error(errMsg(error));
    toast.success("Project added");
    setForm({ name: "", client_id: "", status: "planning", start_date: "", due_date: "", budget: "", description: "" });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  return (
    <Panel title="Add project">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="pn">Project name</Label><Input id="pn" maxLength={150} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="pc">Client</Label>
          <select id="pc" className={selectClass} value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
            <option value="">No client</option>
            {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ps">Status</Label>
          <select id="ps" className={selectClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="pbud">Budget (AUD)</Label><Input id="pbud" type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="psd">Start date</Label><Input id="psd" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="pdd">Due date</Label><Input id="pdd" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pdesc">Description</Label><Textarea id="pdesc" rows={2} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="sm:col-span-2"><Button type="submit">Add project</Button></div>
      </form>
    </Panel>
  );
}

function Projects({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*, client:clients(name)").order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Panel title="Projects">
      {isLoading ? <LoadingRows /> : !data?.length ? <EmptyState title="No projects yet" hint="Projects appear here once they're added above." /> : (
        <ul className="divide-y">
          {data.map((p: any) => <ProjectRow key={p.id} p={p} canManage={canManage} />)}
        </ul>
      )}
    </Panel>
  );
}

function ProjectRow({ p, canManage }: { p: any; canManage: boolean }) {
  const qc = useQueryClient();
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    enabled: canManage,
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: p.name,
    client_id: p.client_id ?? "",
    start_date: p.start_date ?? "",
    due_date: p.due_date ?? "",
    budget: p.budget != null ? String(p.budget) : "",
    description: p.description ?? "",
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["projects"] });

  const setStatus = async (status: string) => {
    const { data, error } = await supabase.from("projects").update({ status: status as (typeof PROJECT_STATUSES)[number] }).eq("id", p.id).select("id");
    if (error) return toast.error(errMsg(error));
    if (!data?.length) return toast.error("You don't have permission to change this project.");
    refresh();
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Enter a project name.");
    if (form.start_date && form.due_date && form.due_date < form.start_date) return toast.error("Due date must be after the start date.");
    const { data, error } = await supabase.from("projects").update({
      name: form.name.trim(),
      client_id: form.client_id || null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      budget: form.budget ? Number(form.budget) : null,
      description: form.description.trim() || null,
    }).eq("id", p.id).select("id");
    if (error) return toast.error(errMsg(error));
    if (!data?.length) return toast.error("You don't have permission to change this project.");
    toast.success("Project updated");
    setEditing(false);
    refresh();
  };

  const remove = async () => {
    if (!window.confirm(`Delete the project "${p.name}"? This can't be undone.`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Project deleted");
    refresh();
  };

  if (editing) {
    return (
      <li className="grid gap-4 py-4 text-sm sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Project name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-1.5">
          <Label>Client</Label>
          <select className={selectClass} value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
            <option value="">No client</option>
            {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Budget (AUD)</Label><Input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Textarea rows={2} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="flex gap-2 sm:col-span-2">
          <Button size="sm" onClick={save}>Save</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{p.name}</p>
        <p className="text-muted-foreground">
          {p.client?.name ?? "No client"}{p.due_date ? ` · Due ${fmtDate(p.due_date)}` : ""}{p.budget != null ? ` · Budget ${fmtAUD(p.budget)}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canManage ? (
          <>
            <select aria-label="Project status" className="h-9 rounded-md border bg-background px-2 text-sm" value={p.status} onChange={(e) => setStatus(e.target.value)}>
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={remove}>Delete</Button>
          </>
        ) : (
          <StatusBadge status={p.status} />
        )}
      </div>
    </li>
  );
}
