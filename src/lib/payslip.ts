import { jsPDF } from "jspdf";
import { fmtAUD, fmtDate } from "@/lib/format";

export type PayslipData = {
  full_name: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  pay_date: string | null;
  ordinary_hours: number;
  overtime_hours: number;
  gross_pay: number;
  allowances: number;
  deductions: number;
  tax_withheld: number;
  super_amount: number;
  net_pay: number;
  notes?: string | null;
};

/** Builds a payslip PDF from the figures entered by payroll. Nothing is calculated for tax. */
export function downloadPayslip(p: PayslipData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 20;
  let y = 24;

  doc.setFont("helvetica", "bold").setFontSize(16).text("Southern Reach Marketing", left, y);
  y += 7;
  doc.setFont("helvetica", "normal").setFontSize(11).text("Payslip", left, y);
  y += 12;

  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "bold").text(label, left, y);
    doc.setFont("helvetica", "normal").text(value, left + 55, y);
    y += 7;
  };
  row("Employee", p.full_name || "—");
  row("Employee ID", p.employee_id);
  row("Pay period", `${fmtDate(p.period_start)} to ${fmtDate(p.period_end)}`);
  row("Pay date", p.pay_date ? fmtDate(p.pay_date) : "—");

  y += 5;
  doc.setFont("helvetica", "bold").text("Hours", left, y);
  y += 7;
  row("Ordinary hours", String(p.ordinary_hours));
  row("Overtime hours", String(p.overtime_hours));

  y += 5;
  doc.setFont("helvetica", "bold").text("Earnings and deductions", left, y);
  y += 7;
  row("Gross pay", fmtAUD(p.gross_pay));
  row("Allowances", fmtAUD(p.allowances));
  row("Deductions", fmtAUD(p.deductions));
  row("Tax withheld", fmtAUD(p.tax_withheld));
  row("Superannuation (employer)", fmtAUD(p.super_amount));

  y += 4;
  doc.setDrawColor(180).line(left, y, 190, y);
  y += 8;
  doc.setFontSize(13);
  row("Net pay", fmtAUD(p.net_pay));
  doc.setFontSize(11);

  if (p.notes) {
    y += 6;
    doc.setFont("helvetica", "bold").text("Notes", left, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.splitTextToSize(p.notes, 170).forEach((line: string) => {
      doc.text(line, left, y);
      y += 6;
    });
  }

  doc.setFontSize(8).setTextColor(120);
  doc.text("Confidential. Tax withheld is entered by payroll and is not a tax statement.", left, 285);
  doc.save(`payslip-${p.employee_id}-${p.period_end}.pdf`);
}

/** Net pay as entered by payroll: gross + allowances - deductions - tax withheld. Arithmetic only. */
export function netPay(gross: number, allowances: number, deductions: number, tax: number) {
  return Math.round((gross + allowances - deductions - tax) * 100) / 100;
}
