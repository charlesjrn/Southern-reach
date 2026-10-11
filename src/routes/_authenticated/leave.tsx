import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { can, type AppRole } from "@/lib/roles";
import { businessDays, fmtDate, label } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingRows, PageHeader, Panel, StatusBadge, errMsg } from "@/components/common";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({ meta: [{ title: "Leave — Southern Reach Agency Hub" }] }),
  component: LeavePage,
});

const LEAVE_TYPES = ["annual", "personal", "carers", "compassionate", "long_service", "unpaid", "parental", "other"] as const;

function LeavePage() {
  const { data: me } = useMe();
  const userId = me?.user.id ?? "";
  const canReview = !!me && can.approve(me.roles as AppRole[]);
  return (
    <>
      <PageHeader title="Leave" description="Request leave and track approvals." />
      <RequestForm userId={userId} />
      <MyRequests userId={userId} />
      {canReview && <ReviewQueue reviewerId={userId} />}
    </>
  );
}

function RequestForm({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.start_date || !form.end_date) return toast.error("Choose start and end dates.");
    if (form.end_date < form.start_date) return toast.error("End date must be after start date.");
    setSaving(true);
    const { error } = await supabase.from("leave_requests").insert({
      profile_id: userId,
      leave_type: form.leave_type as (typeof LEAVE_TYPES)[number],
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason.trim() || null,
      status: "submitted",
    });
    setSaving(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Leave request submitted");
    setForm({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
    qc.invalidateQueries({ queryKey: ["leave"] });
  };

  return (
    <Panel title="Request leave">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lt">Leave type</Label>
          <select id="lt" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </div>
        <div />
        <div className="space-y-1.5"><Label htmlFor="sd">From</Label><Input id="sd" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="ed">To</Label><Input id="ed" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="reason">Reason (optional)</Label><Textarea id="reason" rows={2} maxLength={1000} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
        <div className="sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit request"}</Button></div>
      </form>
    </Panel>
  );
}

function MyRequests({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["leave", "mine", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_requests").select("*").eq("profile_id", userId).order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cancel = async (id: string) => {
    const { error } = await supabase.from("leave_requests").delete().eq("id", id);
    if (error) return toast.error(errMsg(error));
    toast.success("Request cancelled");
    qc.invalidateQueries({ queryKey: ["leave"] });
  };

  return (
    <Panel title="My leave">
      {isLoading ? <LoadingRows /> : !data?.length ? <EmptyState title="No leave requests yet" /> : (
        <ul className="divide-y">
          {data.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{label(r.leave_type)} · {fmtDate(r.start_date)} to {fmtDate(r.end_date)}</p>
                <p className="text-muted-foreground">{businessDays(r.start_date, r.end_date)} business day(s){r.review_comment ? ` · ${r.review_comment}` : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={r.status} />
                {r.status === "submitted" && <Button size="sm" variant="outline" onClick={() => cancel(r.id)}>Cancel</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ReviewQueue({ reviewerId }: { reviewerId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["leave", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, profile:profiles(full_name, employee_id)")
        .eq("status", "submitted")
        .order("start_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const review = async (id: string, status: "approved" | "rejected", comment: string) => {
    const { error } = await supabase.from("leave_requests").update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_comment: comment.trim() || null,
    }).eq("id", id);
    if (error) return toast.error(errMsg(error));
    toast.success(status === "approved" ? "Leave approved" : "Leave rejected");
    qc.invalidateQueries({ queryKey: ["leave"] });
  };

  return (
    <Panel title="Awaiting approval">
      {isLoading ? <LoadingRows /> : !data?.length ? <EmptyState title="Nothing waiting for approval" /> : (
        <ul className="space-y-3">
          {data.map((r) => <ReviewRow key={r.id} r={r} onReview={review} />)}
        </ul>
      )}
    </Panel>
  );
}

function ReviewRow({ r, onReview }: { r: any; onReview: (id: string, s: "approved" | "rejected", c: string) => void }) {
  const [comment, setComment] = useState("");
  return (
    <li className="rounded-lg border p-3 text-sm">
      <p className="font-medium">{r.profile?.full_name ?? "Unknown"} <span className="text-muted-foreground">· {r.profile?.employee_id}</span></p>
      <p>{label(r.leave_type)} · {fmtDate(r.start_date)} to {fmtDate(r.end_date)} ({businessDays(r.start_date, r.end_date)} business day(s))</p>
      {r.reason && <p className="text-muted-foreground">{r.reason}</p>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <Button size="sm" onClick={() => onReview(r.id, "approved", comment)}>Approve</Button>
        <Button size="sm" variant="outline" onClick={() => onReview(r.id, "rejected", comment)}>Reject</Button>
      </div>
    </li>
  );
}
