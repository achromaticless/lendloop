import { Pill, type PillTone } from "@/components/ui/Pill";
import { ToolCover } from "@/components/ui/ToolCover";

/** One row in the dashboard lists: a tool, a status and its actions. */
export function LoanRow({
  category,
  title,
  subtitle,
  pill,
  actions,
  note,
}: {
  category: string;
  title: string;
  subtitle: string;
  pill: { tone: PillTone; label: string };
  actions?: React.ReactNode;
  note?: { label: string; text: string } | null;
}) {
  return (
    <article className="flex flex-col gap-5 rounded-[20px] border border-line bg-surface p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,32,26,0.09)] sm:p-6">
      <div className="flex flex-wrap items-center gap-5">
        <ToolCover category={category} size="thumb" className="h-[72px] w-24 flex-none rounded-[14px]" />
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <h3 className="font-display text-2xl font-bold tracking-tight">{title}</h3>
          <p className="text-[15px] text-muted">{subtitle}</p>
        </div>
        <Pill tone={pill.tone}>{pill.label}</Pill>
        {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
      </div>
      {note && (
        <div className="flex items-start gap-3 rounded-xl bg-brand-soft px-4 py-3.5">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0F4A35"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-0.5 flex-none"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-brand-ink">{note.label}</span>
            <span className="text-[15px] leading-snug">{note.text}</span>
          </div>
        </div>
      )}
    </article>
  );
}
