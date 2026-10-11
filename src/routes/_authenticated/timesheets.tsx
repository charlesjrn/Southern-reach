import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { can, type AppRole } from "@/lib/roles";
import { fmtDate, weekStart } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, LoadingRows, PageHeader, Panel, StatusBadge, errMsg } from "@/components/common";

export const Route = createFileRoute("/_authenticated/timesheets")({
  head: () => ({ meta: [{ title: "Timesheets — Southern Reach Agency Hub" }] }),
  component: TimesheetsPage,
});

function TimesheetsPage() {
  const { data: me } = useMe();
  const userId = me?.user.id ?? "";
  const canReview = !!me && can.approve(me.roles as AppRole[]);
  return (
    <>
      <PageHeader title="Timesheets" description="Record your hours for the week and submit for approval." />
      <MyTimesheet userId={userId} />
      {canReview && <TimesheetReview reviewerId={userId} />}
    </>
  );
}

function MyTimesheet({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [week, setWeek] = useState(weekStart());

  const { data: sheet, isLoading } = useQuery({
    queryKey: ["timesheet", userId, week],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("timesheets").select("*").eq("profile_id", userId).eq("week_start", week).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: entries } = useQuery({
    queryKey: ["timesheet-entries", sheet?.id],
    enabled: !!sheet?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("timesheet_entries").select("*").eq("timesheet_id", sheet!.id).order("work_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["timesheet", userId, week] });
    qc.invalidateQueries({ queryKey: ["timesheet-entries"] });
  };

  const createSheet = async () => {
    const { error } = await supabase.from("timesheets").insert({ profile_id: userId, week_start: week, status: "draft" });
    if (error) return toast.error(errMsg(error));
    refresh();
  };

  const submit = async () => {
    if (!entries?.length) return toast.error("Add at least one entry before submitting.");
    const { error } = await supabase.from("timesheets").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", sheet!.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Timesheet submitted");
    refresh();
  };

  const total = (entries ?? []).reduce((sum, e) => sum + Number(e.hours), 0);
  const isDraft = sheet?.status === "draft";

  return (
    <Panel
      title="My timesheet"
      action={
        <div className="flex items-center gap-2">
          <Label htmlFor="week" className="sr-only">Week starting</Label>
          <Input id="week" type="date" className="w-40" value={week} onChange={(e) => setWeek(weekStart(new Date(e.target.value + "T00:00:00")))} />
        </div>
      }
    >
      {isLoading ? <LoadingRows /> : !sheet ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">No timesheet for the week starting {fmtDate(week)}.</p>
          <Button onClick={createSheet}>Start timesheet</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>Week starting {fmtDate(sheet.week_start)} · <strong>{total.toFixed(2)} hours</strong></p>
            <StatusBadge status={sheet.status} />
          </div>
          {sheet.review_comment && <p className="rounded-md bg-muted px-3 py-2 text-sm">Reviewer note: {sheet.review_comment}</p>}
          {isDraft && <EntryForm timesheetId={sheet.id} weekStartDate={sheet.week_start} onSaved={refresh} />}
          <ul className="divide-y text-sm">
            {entries?.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2">
                <span>{fmtDate(e.work_date)} · {Number(e.hours).toFixed(2)} h{e.description ? ` · ${e.description}` : ""}</span>
                {isDraft && (
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const { error } = await supabase.from("timesheet_entries").delete().eq("id", e.id);
                    if (error) return toast.error(errMsg(error));
                    refresh();
                  }}>Remove</Button>
                )}
              </li>
            ))}
          </ul>
          {isDraft && <Button onClick={submit} disabled={!entries?.length}>Submit for approval</Button>}
        </div>
      )}
    </Panel>
  );
}

function EntryForm({ timesheetId, weekStartDate, onSaved }: { timesheetId: string; weekStartDate: string; onSaved: () => void }) {
  const [workDate, setWorkDate] = useState(weekStartDate);
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(hours);
    if (!workDate || !(h > 0 && h <= 24)) return toast.error("Enter a date and between 0 and 24 hours.");
    setSaving(true);
    const { error } = await supabase.from("timesheet_entries").insert({ timesheet_id: timesheetId, work_date: workDate, hours: h, description: description.trim() || null });
    setSaving(false);
    if (error) return toast.error(errMsg(error));
    setHours("");
    setDescription("");
    onSaved();
  };

  return (
    <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_120px_2fr_auto] sm:items-end">
      <div className="space-y-1.5"><Label htmlFor="wd">Date</Label><Input id="wd" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="hrs">Hours</Label><Input id="hrs" type="number" step="0.25" min="0" max="24" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="desc">Description</Label><Input id="desc" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <Button type="submit" disabled={saving}>Add entry</Button>
    </form>
  );
}

function TimesheetReview({ reviewerId }: { reviewerId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["timesheets", "submitted"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timesheets")
        .select("*, profile:profiles!timesheets_profile_id_fkey(full_name, employee_id)")
        .eq("status", "submitted")
        .order("week_start");
      if (error) throw error;
      return data ?? [];
    },
  });

  const decide = async (id: string, status: "approved" | "rejected", note: string) => {
    const { error } = await supabase.from("timesheets").update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_comment: note.trim() || null,
    }).eq("id", id);
    if (error) return toast.error(errMsg(error));
    toast.success(status === "approved" ? "Timesheet approved" : "Timesheet returned");
    qc.invalidateQueries({ queryKey: ["timesheets"] });
  };

  return (
    <Panel title="Timesheets awaiting approval">
      {isLoading ? <LoadingRows /> : !data?.length ? <EmptyState title="Nothing waiting for approval" /> : (
        <ul className="space-y-3">
          {data.map((t: any) => <TimesheetRow key={t.id} t={t} onDecide={decide} />)}
        </ul>
      )}
    </Panel>
  );
}

function TimesheetRow({ t, onDecide }: { t: any; onDecide: (id: string, s: "approved" | "rejected", n: string) => void }) {
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const { data: entries } = useQuery({
    queryKey: ["timesheet-entries", t.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("timesheet_entries").select("*").eq("timesheet_id", t.id).order("work_date");
      if (error) throw error;
      return data ?? [];
    },
  });
  const total = (entries ?? []).reduce((s, e) => s + Number(e.hours), 0);
  return (
    <li className="rounded-lg border p-3 text-sm">
      <p className="font-medium">{t.profile?.full_name ?? "Unknown"} <span className="text-muted-foreground">· {t.profile?.employee_id} · week of {fmtDate(t.week_start)}</span></p>
      <button type="button" className="mt-1 text-xs text-primary hover:underline" onClick={() => setOpen((o) => !o)}>{open ? "Hide hours" : "Show hours"}</button>
      {open && (
        <div className="mt-2 space-y-1 text-muted-foreground">
          {entries?.map((e) => <p key={e.id}>{fmtDate(e.work_date)} · {Number(e.hours).toFixed(2)} h{e.description ? ` · ${e.description}` : ""}</p>)}
          <p className="font-medium text-foreground">Total {total.toFixed(2)} hours</p>
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Note to employee (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" onClick={() => onDecide(t.id, "approved", note)}>Approve</Button>
        <Button size="sm" variant="outline" onClick={() => onDecide(t.id, "rejected", note)}>Return</Button>
      </div>
    </li>
  );
}
