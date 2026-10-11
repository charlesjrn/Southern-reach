export const AU_TZ = "Australia/Sydney";

export function fmtDate(v?: string | Date | null) {
  if (!v) return "—";
  const d = typeof v === "string" && v.length === 10 ? new Date(v + "T00:00:00") : new Date(v);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: typeof v === "string" && v.length === 10 ? undefined : AU_TZ });
}

export function fmtDateTime(v?: string | Date | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", timeZone: AU_TZ });
}

export function fmtTime(v?: string | Date | null) {
  if (!v) return "—";
  return new Date(v).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: AU_TZ });
}

export function fmtAUD(n?: number | string | null) {
  return Number(n ?? 0).toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

/** Monday of the week containing `d`, as YYYY-MM-DD (AU weeks start Monday). */
export function weekStart(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return isoDate(x);
}

export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inclusive count of weekdays (Mon–Fri) between two YYYY-MM-DD dates. */
export function businessDays(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  let n = 0;
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const w = d.getDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

export const label = (s?: string | null) => (s ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—");
