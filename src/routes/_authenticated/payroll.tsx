import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { can, type AppRole } from "@/lib/roles";
import { fmtAUD, fmtDate } from "@/lib/format";
import { downloadPayslip, netPay, type PayslipData } from "@/lib/payslip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingRows, PageHeader, Panel, StatusBadge, errMsg } from "@/components/common";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Payroll & payslips — Southern Reach Agency Hub" }] }),
  component: PayrollPage,
});

const num = (v: string) => (v === "" ? 0 : Number(v));

function PayrollPage() {
  const { data: me } = useMe();
  const userId = me?.user.id ?? "";
  const payrollUser = !!me && can.payroll(me.roles as AppRole[]);
  return (
    <>
      <PageHeader title="Payroll & payslips" description={payrollUser ? "Enter pay figures and generate payslips." : "Your published payslips."} />
      {payrollUser && <PayrollEntry preparerId={userId} />}
      {payrollUser && <PayrollRecords />}
      <MyPayslips userId={userId} />
    </>
  );
}

const emptyForm = {
  profile_id: "", period_start: "", period_end: "", pay_date: "",
  ordinary_hours: "", overtime_hours: "", gross_pay: "", allowances: "", deductions: "", tax_withheld: "", super_amount: "", notes: "",
};

function PayrollEntry({ preparerId }: { preparerId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { data: people } = useQuery({
    queryKey: ["active-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, employee_id").eq("is_active", true).order("full_name")).data ?? [],
  });

  // Net pay is arithmetic on the figures entered (gross + allowances - deductions - tax). Tax itself is typed by payroll.
  const net = netPay(num(form.gross_pay), num(form.allowances), num(form.deductions), num(form.tax_withheld));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.profile_id || !form.period_start || !form.period_end) return toast.error("Choose a person and pay period.");
    if (form.period_end < form.period_start) return toast.error("Period end must be after period start.");
    setSaving(true);
    const { error } = await supabase.from("payroll_records").insert({
      profile_id: form.profile_id,
      period_start: form.period_start,
      period_end: form.period_end,
      pay_date: form.pay_date || null,
      ordinary_hours: num(form.ordinary_hours),
      overtime_hours: num(form.overtime_hours),
      gross_pay: num(form.gross_pay),
      allowances: num(form.allowances),
      deductions: num(form.deductions),
      tax_withheld: num(form.tax_withheld),
      super_amount: num(form.super_amount),
      net_pay: net,
      notes: form.notes.trim() || null,
      published: false,
      prepared_by: preparerId,
    });
    setSaving(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Pay record saved as draft");
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["payroll"] });
  };

  const field = (id: keyof typeof emptyForm, label: string, type = "number") => (
    <div className="space-y-1.5">
      <Label htmlFor={`pay-${id}`}>{label}</Label>
      <Input id={`pay-${id}`} type={type} step={type === "number" ? "0.01" : undefined} min={type === "number" ? "0" : undefined} value={form[id]} onChange={(e) => setForm({ ...form, [id]: e.target.value })} />
    </div>
  );

  return (
    <Panel title="Enter pay figures">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="pay-person">Staff member</Label>
          <select id="pay-person" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.profile_id} onChange={(e) => setForm({ ...form, profile_id: e.target.value })}>
            <option value="">Choose…</option>
            {people?.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.employee_id})</option>)}
          </select>
        </div>
        {field("period_start", "Period start", "date")}
        {field("period_end", "Period end", "date")}
        {field("pay_date", "Pay date", "date")}
        {field("ordinary_hours", "Ordinary hours")}
        {field("overtime_hours", "Overtime hours")}
        {field("gross_pay", "Gross pay (AUD)")}
        {field("allowances", "Allowances (AUD)")}
        {field("deductions", "Deductions (AUD)")}
        {field("tax_withheld", "Tax withheld (AUD)")}
        {field("super_amount", "Super (AUD)")}
        <div className="space-y-1.5">
          <Label>Net pay (calculated)</Label>
          <p className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium">{fmtAUD(net)}</p>
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="pay-notes">Notes (shown on payslip)</Label>
          <Textarea id="pay-notes" rows={2} maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save as draft"}</Button></div>
      </form>
    </Panel>
  );
}

function PayrollRecords() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["payroll", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_records")
        .select("*, profile:profiles!payroll_records_profile_id_fkey(full_name, employee_id)")
        .order("period_end", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const publish = async (id: string) => {
    const { error } = await supabase.from("payroll_records").update({ published: true }).eq("id", id);
    if (error) return toast.error(errMsg(error));
    toast.success("Payslip published to the employee");
    qc.invalidateQueries({ queryKey: ["payroll"] });
  };

  return (
    <Panel title="Pay records">
      {isLoading ? <LoadingRows /> : !data?.length ? <EmptyState title="No pay records yet" /> : (
        <ul className="divide-y text-sm">
          {data.map((r: any) => (
            <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{r.profile?.full_name} <span className="text-muted-foreground">· {r.profile?.employee_id}</span></p>
                <p className="text-muted-foreground">{fmtDate(r.period_start)} to {fmtDate(r.period_end)} · Net {fmtAUD(r.net_pay)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={r.published ? "published" : "draft"} />
                <Button size="sm" variant="outline" onClick={() => downloadPayslip(toPayslip(r))}>Download PDF</Button>
                {!r.published && <Button size="sm" onClick={() => publish(r.id)}>Publish</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function MyPayslips({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["payroll", "mine", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_records")
        .select("*, profile:profiles!payroll_records_profile_id_fkey(full_name, employee_id)")
        .eq("profile_id", userId)
        .eq("published", true)
        .order("period_end", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Panel title="My payslips">
      {isLoading ? <LoadingRows /> : !data?.length ? <EmptyState title="No payslips yet" /> : (
        <ul className="divide-y text-sm">
          {data.map((r: any) => (
            <li key={r.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">Pay period {fmtDate(r.period_start)} to {fmtDate(r.period_end)}</p>
                <p className="text-muted-foreground">Net {fmtAUD(r.net_pay)}{r.pay_date ? ` · Paid ${fmtDate(r.pay_date)}` : ""}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => downloadPayslip(toPayslip(r))}>Download PDF</Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function toPayslip(r: any): PayslipData {
  return {
    full_name: r.profile?.full_name ?? "",
    employee_id: r.profile?.employee_id ?? "",
    period_start: r.period_start,
    period_end: r.period_end,
    pay_date: r.pay_date,
    ordinary_hours: Number(r.ordinary_hours),
    overtime_hours: Number(r.overtime_hours),
    gross_pay: Number(r.gross_pay),
    allowances: Number(r.allowances),
    deductions: Number(r.deductions),
    tax_withheld: Number(r.tax_withheld),
    super_amount: Number(r.super_amount),
    net_pay: Number(r.net_pay),
    notes: r.notes,
  };
}
