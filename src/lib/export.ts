type Row = Record<string, string | number | null | undefined>;

function esc(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0] ?? {});
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(rows: Row[], filename: string) {
  download(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }), filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export async function exportPdf(title: string, rows: Row[], filename: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`Southern Reach Marketing — ${title}`, 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}`, 14, 22);
  const headers = Object.keys(rows[0] ?? {});
  autoTable(doc, {
    startY: 27,
    head: [headers],
    body: rows.map((r) => headers.map((h) => (r[h] == null ? "" : String(r[h])))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [49, 24, 66] },
  });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
