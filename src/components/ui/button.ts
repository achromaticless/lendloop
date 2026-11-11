type Variant = "primary" | "dark" | "outline" | "danger" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold " +
  "transition duration-150 hover:-translate-y-px hover:brightness-110 " +
  "active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white",
  dark: "bg-ink text-paper",
  outline: "border-[1.5px] border-ink bg-surface text-ink hover:bg-brand-soft",
  danger: "border-[1.5px] border-danger-line bg-surface text-rose-ink hover:bg-rose-soft",
  ghost: "text-ink hover:bg-sand",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-[15px]",
  lg: "min-h-14 px-7 text-[17px]",
};

/** One button look for <a>, <Link> and <button>. */
export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}
