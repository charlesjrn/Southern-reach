import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { can, type AppRole } from "@/lib/roles";
import { fmtDate, label } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingRows, PageHeader, Panel, StatusBadge, errMsg } from "@/components/common";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Southern Reach Agency Hub" }] }),
  component: TasksPage,
});

const STATUSES = ["todo", "in_progress", "review", "done"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function TasksPage() {
  const { data: me } = useMe();
  const userId = me?.user.id ?? "";
  const leader = !!me && can.manageRoster(me.roles as AppRole[]); // admin, management, hr can assign to anyone
  const manager = !!me && (me.roles as AppRole[]).some((r) => r === "admin" || r === "management"); // may delete any task
  const [filter, setFilter] = useState<"mine" | "all">("mine");

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", filter, userId],
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase.from("tasks").select("*, assignee:profiles!tasks_assignee_id_fkey(full_name)").order("due_date", { ascending: true, nullsFirst: false });
      if (filter === "mine") q = q.eq("assignee_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader title="Tasks" description="Assign work, set deadlines and track progress." />
      <TaskForm userId={userId} leader={leader} />
      <Panel
        title={filter === "mine" ? "My tasks" : "All visible tasks"}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant={filter === "mine" ? "default" : "outline"} onClick={() => setFilter("mine")}>Mine</Button>
            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
          </div>
        }
      >
        {isLoading ? <LoadingRows /> : !tasks?.length ? <EmptyState title="No tasks here" /> : (
          <ul className="space-y-3">
            {tasks.map((t: any) => <TaskCard key={t.id} t={t} userId={userId} leader={leader} manager={manager} />)}
          </ul>
        )}
      </Panel>
    </>
  );
}

function TaskForm({ userId, leader }: { userId: string; leader: boolean }) {
  const qc = useQueryClient();
  const { data: people } = useQuery({
    queryKey: ["active-profiles"],
    enabled: leader,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name")).data ?? [],
  });
  const [form, setForm] = useState({ title: "", description: "", assignee_id: "", priority: "medium", due_date: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Give the task a title.");
    setSaving(true);
    const { error } = await supabase.from("tasks").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      assignee_id: leader && form.assignee_id ? form.assignee_id : userId,
      created_by: userId,
      priority: form.priority as (typeof PRIORITIES)[number],
      due_date: form.due_date || null,
      status: "todo",
      progress: 0,
    });
    setSaving(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Task created");
    setForm({ title: "", description: "", assignee_id: "", priority: "medium", due_date: "" });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <Panel title="New task">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="tt">Title</Label><Input id="tt" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="td">Details</Label><Textarea id="td" rows={2} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        {leader && (
          <div className="space-y-1.5">
            <Label htmlFor="ta">Assign to</Label>
            <select id="ta" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
              <option value="">Myself</option>
              {people?.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="tp">Priority</Label>
          <select id="tp" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{label(p)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="tdd">Due date</Label><Input id="tdd" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
        <div className="sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create task"}</Button></div>
      </form>
    </Panel>
  );
}

function TaskCard({ t, userId, leader, manager }: { t: any; userId: string; leader: boolean; manager: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<number>(t.progress);
  const canEdit = t.assignee_id === userId || t.created_by === userId || leader;
  const canDelete = t.created_by === userId || manager;

  const update = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from("tasks").update(patch).eq("id", t.id);
    if (error) return toast.error(errMsg(error));
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const remove = async () => {
    const { error } = await supabase.from("tasks").delete().eq("id", t.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Task deleted");
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <li className="rounded-lg border p-4 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">{t.title}</p>
          <p className="text-muted-foreground">
            {t.assignee?.full_name ? `For ${t.assignee.full_name}` : "Unassigned"}{t.due_date ? ` · Due ${fmtDate(t.due_date)}` : ""} · {label(t.priority)}
          </p>
          {t.description && <p className="mt-1 text-muted-foreground">{t.description}</p>}
        </div>
        <StatusBadge status={t.status} />
      </div>

      {canEdit && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-center">
          <select aria-label="Status" className="h-9 rounded-md border bg-background px-2 text-sm" value={t.status} onChange={(e) => update({ status: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input aria-label="Progress" type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} onMouseUp={() => update({ progress })} onTouchEnd={() => update({ progress })} className="w-full accent-[var(--color-primary)]" />
            <span className="w-10 text-right tabular-nums">{progress}%</span>
          </div>
          {canDelete && <Button size="sm" variant="ghost" onClick={remove}>Delete</Button>}
        </div>
      )}

      <button type="button" className="mt-3 text-xs text-primary hover:underline" onClick={() => setOpen((o) => !o)}>{open ? "Hide comments" : "Comments"}</button>
      {open && <Comments taskId={t.id} userId={userId} />}
    </li>
  );
}

function Comments({ taskId, userId }: { taskId: string; userId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const { data } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_comments").select("*, author:profiles(full_name)").eq("task_id", taskId).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    const { error } = await supabase.from("task_comments").insert({ task_id: taskId, author_id: userId, body: body.trim() });
    if (error) return toast.error(errMsg(error));
    setBody("");
    qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
  };

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {data?.map((c: any) => (
        <p key={c.id}><span className="font-medium">{c.author?.full_name ?? "Someone"}</span>: {c.body} <span className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</span></p>
      ))}
      <form onSubmit={post} className="flex gap-2">
        <Input aria-label="Add comment" placeholder="Add a comment" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
        <Button type="submit" size="sm">Post</Button>
      </form>
    </div>
  );
}
