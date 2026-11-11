// Loan dates are calendar days stored as "YYYY-MM-DD" strings (no times, no
// per-user time zones). "Today" is always the current UTC day; the README states
// this so "overdue" has exactly one definition.

export const MAX_LOAN_DAYS = 30;

export function todayISO(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Inclusive number of days between two valid ISO dates. */
export function inclusiveDays(start: string, end: string): number {
  const ms =
    new Date(`${end}T00:00:00Z`).getTime() -
    new Date(`${start}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Inclusive range overlap. ISO strings compare correctly as plain strings. */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
