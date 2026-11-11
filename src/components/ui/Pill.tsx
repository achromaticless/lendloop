export type PillTone = "green" | "amber" | "sky" | "rose" | "neutral";

const tones: Record<PillTone, string> = {
  green: "bg-brand-soft text-brand-ink",
  amber: "bg-amber-soft text-amber-ink",
  sky: "bg-sky-soft text-sky-ink",
  rose: "bg-rose-soft text-rose-ink",
  neutral: "bg-line-soft text-ink-soft",
};

/** Status label. Meaning is carried by the text, colour is only reinforcement. */
export function Pill({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: PillTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function statusPill(status: string, overdue = false): { tone: PillTone; label: string } {
  if (overdue) return { tone: "rose", label: "Overdue" };
  switch (status) {
    case "pending":
      return { tone: "amber", label: "Pending" };
    case "approved":
      return { tone: "green", label: "Approved" };
    case "declined":
      return { tone: "neutral", label: "Declined" };
    case "cancelled":
      return { tone: "neutral", label: "Cancelled" };
    case "returned":
      return { tone: "neutral", label: "Returned" };
    default:
      return { tone: "neutral", label: status };
  }
}
