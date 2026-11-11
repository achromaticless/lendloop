// Loan dates are calendar days ("YYYY-MM-DD") and "today" is the UTC day, the
// same definition the Convex functions use.

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-14" -> "Nov 14" */
export function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** A timestamp as "just now", "5 minutes ago", "yesterday", "3 days ago". */
export function timeAgo(at: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 60) return "just now";
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86_400) return rtf.format(-Math.floor(seconds / 3600), "hour");
  return rtf.format(-Math.floor(seconds / 86_400), "day");
}

export function formatRange(start: string, end: string): string {
  return start === end ? formatDay(start) : `${formatDay(start)} to ${formatDay(end)}`;
}
