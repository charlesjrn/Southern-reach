import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { can, type AppRole } from "@/lib/roles";
import { businessDays, fmtAUD, fmtDate, label } from "@/lib/format";
import { exportCsv, exportPdf } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, LoadingRows, NoAccess, PageHeader, Panel, errMsg } from "@/components/common";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Southern Reach Agency Hub" }] }),
  component: ReportsPage,
});

type Row = Record<string, string | number | null>;
type ReportId = "headcount" | "hours" | "leave" | "tasks" | "projects" | "payroll";

const REPORTS: { id: ReportId; label: string; dated: boolean; payrollOnly?: boolean }[] = [
  { id: "headcount", label: "Headcount by department", dated: false },
  { id: "hours", label: "Approved timesheet hours", dated: true },
  { id: "leave", label: "Leave requests", dated: true },
  { id: "tasks", label: "Task progress", dated: false },
  { id: "projects", label: "Clients and projects", dated: false },
  { id: "payroll", label: "Payroll summary", dated: true, payrollOnly: true },
];

const fmtNum = (n: number) => Math.round(n * 100) / 100;

function ReportsPage() {
  const { data: me } = useMe();
  const roles = (me?.roles ?? []) as AppRole[];
  const [report, setReport] = useState<ReportId>("headcount");
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  if (me && !can.reports(roles)) return <NoAccess />;
  const available = REPORTS.filter((r) => !r.payrollOnly || can.payroll(roles));
  const meta = REPORTS.find((r) => r.id === report)!;

  return (
    <>
      <PageHeader title="Reports" description="Preview a report, then download it as a spreadsheet or PDF." />
      <Panel>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="rpt">Report</Label>
            <select id="rpt" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={report} onChange={(e) => setReport(e.target.value as ReportId)}>
              {available.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          {meta.dated && (
            <>
              <div className="space-y-1.5"><Label htmlFor="rfrom">From</Label><Input id="rfrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="rto">To</Label><Input id="rto" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </>
          )}
        </div>
      </Panel>
      <ReportView key={`${report}-${from}-${to}`} report={report} from={from} to={to} />
    </>
  );
}

function ReportView({ report, from, to }: { report: ReportId; from: string; to: string }) {
  const { data: rows, isLoading, error } = useQuery({
    queryKey: ["report", report, from, to],
    queryFn: () => buildReport(report, from, to),
  });
  const title = REPORTS.find((r) => r.id === report)?.label ?? "Report";
  const file = `${report}-${from}-to-${to}`;
  const download = async (kind: "csv" | "pdf") => {
    if (!rows?.length) return toast.error("Nothing to export for this report.");
    try {
      if (kind === "csv") exportCsv(rows, file);
      else await exportPdf(title, rows, file);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Panel
      title={title}
      action={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={!rows?.length} onClick={() => download("csv")}>Download CSV</Button>
          <Button size="sm" variant="outline" disabled={!rows?.length} onClick={() => download("pdf")}>Download PDF</Button>
        </div>
      }
    >
      {isLoading ? <LoadingRows /> : error ? <p className="text-sm text-destructive">{errMsg(error)}</p> : !rows?.length ? <EmptyState title="No data for this report" hint="Try a different date range." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>{Object.keys(rows[0]).map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {rows.slice(0, 200).map((r, i) => (
                <tr key={i}>{Object.values(r).map((v, j) => <td key={j} className="whitespace-nowrap px-3 py-2">{v ?? "—"}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {rows.length > 200 && <p className="mt-2 text-xs text-muted-foreground">Showing the first 200 rows. Download for the full list.</p>}
        </div>
      )}
    </Panel>
  );
}

async function buildReport(report: ReportId, from: string, to: string): Promise<Row[]> {
  switch (report) {
    case "headcount": {
      const { data, error } = await supabase.from("profiles").select("is_active, department:departments(name)");
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const p of data ?? []) {
        if (!p.is_active) continue;
        const name = (p as any).department?.name ?? "No department";
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([Department, Active]) => ({ Department, "Active staff": Active }));
    }
    case "hours": {
      const { data, error } = await supabase
        .from("timesheet_entries")
        .select("hours, work_date, timesheet:timesheets!inner(status, profile:profiles(full_name, employee_id))")
        .gte("work_date", from)
        .lte("work_date", to);
      if (error) throw error;
      const totals = new Map<string, { name: string; id: string; hours: number }>();
      for (const e of (data ?? []) as any[]) {
        if (e.timesheet?.status !== "approved") continue;
        const key = e.timesheet.profile?.employee_id ?? "?";
        const cur = totals.get(key) ?? { name: e.timesheet.profile?.full_name ?? "Unknown", id: key, hours: 0 };
        cur.hours += Number(e.hours);
        totals.set(key, cur);
      }
      return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ Employee: t.name, "Employee ID": t.id, "Approved hours": fmtNum(t.hours) }));
    }
    case "leave": {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("leave_type, start_date, end_date, status, profile:profiles(full_name, employee_id)")
        .lte("start_date", to)
        .gte("end_date", from)
        .order("start_date");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        Employee: r.profile?.full_name ?? "Unknown",
        "Employee ID": r.profile?.employee_id ?? "",
        Type: label(r.leave_type),
        From: fmtDate(r.start_date),
        To: fmtDate(r.end_date),
        "Business days": businessDays(r.start_date, r.end_date),
        Status: label(r.status),
      }));
    }
    case "tasks": {
      const { data, error } = await supabase.from("tasks").select("title, status, priority, progress, due_date, assignee:profiles!tasks_assignee_id_fkey(full_name)").order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        Task: t.title,
        Assignee: t.assignee?.full_name ?? "Unassigned",
        Status: label(t.status),
        Priority: label(t.priority),
        "Progress %": t.progress,
        Due: t.due_date ? fmtDate(t.due_date) : "—",
      }));
    }
    case "projects": {
      const { data, error } = await supabase.from("projects").select("name, status, start_date, due_date, budget, client:clients(name)").order("name");
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        Project: p.name,
        Client: p.client?.name ?? "—",
        Status: label(p.status),
        Start: p.start_date ? fmtDate(p.start_date) : "—",
        Due: p.due_date ? fmtDate(p.due_date) : "—",
        Budget: p.budget != null ? fmtAUD(p.budget) : "—",
      }));
    }
    case "payroll": {
      const { data, error } = await supabase
        .from("payroll_records")
        .select("period_start, period_end, gross_pay, super_amount, net_pay, profile:profiles(full_name, employee_id)")
        .gte("period_end", from)
        .lte("period_end", to)
        .order("period_end");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        Employee: r.profile?.full_name ?? "Unknown",
        "Employee ID": r.profile?.employee_id ?? "",
        "Period start": fmtDate(r.period_start),
        "Period end": fmtDate(r.period_end),
        Gross: fmtNum(Number(r.gross_pay)),
        Super: fmtNum(Number(r.super_amount)),
        Net: fmtNum(Number(r.net_pay)),
      }));
    }
  }
}
