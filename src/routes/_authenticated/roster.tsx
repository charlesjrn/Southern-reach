import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { can, type AppRole } from "@/lib/roles";
import { fmtDate, fmtTime, label } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, LoadingRows, PageHeader, Panel, errMsg } from "@/components/common";

export const Route = createFileRoute("/_authenticated/roster")({
  head: () => ({ meta: [{ title: "Roster — Southern Reach Agency Hub" }] }),
  component: RosterPage,
});

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function RosterPage() {
  const { data: me } = useMe();
  const userId = me?.user.id ?? "";
  const canManage = !!me && can.manageRoster(me.roles as AppRole[]);
  return (
    <>
      <PageHeader title="Roster" description="Upcoming shifts and your availability." />
      {canManage && <ShiftForm />}
      <Shifts userId={userId} canManage={canManage} />
      <Availability userId={userId} />
    </>
  );
}

function ShiftForm() {
  const qc = useQueryClient();
  const { data: people } = useQuery({
    queryKey: ["active-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, employee_id").eq("is_active", true).order("full_name")).data ?? [],
  });
  const [form, setForm] = useState({ profile_id: "", date: "", start: "", end: "", location: "", role_label: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.profile_id || !form.date || !form.start || !form.end) return toast.error("Choose a person, date and times.");
    // Times are entered as Australian local time on the device; the browser converts them to UTC for storage.
    const starts = new Date(`${form.date}T${form.start}`);
    const ends = new Date(`${form.date}T${form.end}`);
    if (ends <= starts) return toast.error("End time must be after start time.");
    setSaving(true);
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase.from("shifts").insert({
      profile_id: form.profile_id,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      location: form.location.trim() || null,
      role_label: form.role_label.trim() || null,
      created_by: me.user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Shift added");
    setForm({ profile_id: "", date: "", start: "", end: "", location: "", role_label: "" });
    qc.invalidateQueries({ queryKey: ["shifts"] });
  };

  return (
    <Panel title="Add shift">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="person">Staff member</Label>
          <select id="person" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.profile_id} onChange={(e) => setForm({ ...form, profile_id: e.target.value })}>
            <option value="">Choose…</option>
            {people?.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.employee_id})</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="sdate">Date</Label><Input id="sdate" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="stime">Start</Label><Input id="stime" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="etime">End</Label><Input id="etime" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="loc">Location</Label><Input id="loc" maxLength={150} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="rl">Role</Label><Input id="rl" maxLength={100} value={form.role_label} onChange={(e) => setForm({ ...form, role_label: e.target.value })} /></div>
        <div className="sm:col-span-2 lg:col-span-3"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add shift"}</Button></div>
      </form>
    </Panel>
  );
}

const SYDNEY = "Australia/Sydney";
const dayFmt = new Intl.DateTimeFormat("en-AU", { timeZone: SYDNEY, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-AU", { timeZone: SYDNEY, hour: "numeric", minute: "2-digit" });

function Shifts({ userId, canManage }: { userId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(0); // each page is 14 days; 0 = starting today
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() + page * 14);
  const to = new Date(from.getTime() + 14 * 86400000);

  const { data, isLoading, error } = useQuery({
    queryKey: ["shifts", page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*, profile:profiles!shifts_profile_id_fkey(full_name, employee_id)")
        .gte("starts_at", from.toISOString())
        .lt("starts_at", to.toISOString())
        .order("starts_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = async (id: string) => {
    const { error } = await supabase.from("shifts").delete().eq("id", id);
    if (error) return toast.error(errMsg(error));
    qc.invalidateQueries({ queryKey: ["shifts"] });
  };

  const rangeLabel = `${dayFmt.format(from)} to ${dayFmt.format(new Date(to.getTime() - 86400000))}`;

  return (
    <Panel
      title="Shifts"
      action={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button size="sm" variant="outline" onClick={() => setPage(0)} disabled={page === 0}>Today</Button>
          <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">{rangeLabel} · times shown in Sydney time</p>
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">Could not load shifts: {errMsg(error)}</p>
      ) : isLoading ? <LoadingRows /> : !data?.length ? <EmptyState title="No shifts in this period" /> : (
        <ul className="divide-y text-sm">
          {data.map((s: any) => (
            <li key={s.id} className={`flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between ${s.profile_id === userId ? "font-medium" : ""}`}>
              <div>
                <p>{dayFmt.format(new Date(s.starts_at))} · {timeFmt.format(new Date(s.starts_at))} to {timeFmt.format(new Date(s.ends_at))}</p>
                <p className="text-muted-foreground">
                  {s.profile?.full_name ?? "Unknown staff member"}{s.role_label ? ` · ${s.role_label}` : ""}{s.location ? ` · ${s.location}` : ""}
                </p>
              </div>
              {canManage && <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>Delete</Button>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Availability({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [weekday, setWeekday] = useState("0");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["availability", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("availability").select("*").eq("profile_id", userId).order("weekday")).data ?? [],
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || !end || end <= start) return toast.error("Choose a start time before the end time.");
    const { error } = await supabase.from("availability").insert({ profile_id: userId, weekday: Number(weekday), start_time: start, end_time: end });
    if (error) return toast.error(errMsg(error));
    setStart("");
    setEnd("");
    qc.invalidateQueries({ queryKey: ["availability", userId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("availability").delete().eq("id", id);
    if (error) return toast.error(errMsg(error));
    qc.invalidateQueries({ queryKey: ["availability", userId] });
  };

  return (
    <Panel title="My availability">
      <form onSubmit={add} className="mb-4 grid gap-3 sm:grid-cols-[1fr_120px_120px_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="wday">Day</Label>
          <select id="wday" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="avs">From</Label><Input id="avs" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="ave">To</Label><Input id="ave" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <Button type="submit">Add availability</Button>
      </form>
      {isLoading ? <LoadingRows rows={2} /> : !data?.length ? <EmptyState title="No availability set" /> : (
        <ul className="divide-y text-sm">
          {data.map((a: any) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <span>{WEEKDAYS[a.weekday]} · {String(a.start_time).slice(0, 5)} to {String(a.end_time).slice(0, 5)}</span>
              <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
