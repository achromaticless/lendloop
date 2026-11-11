import Link from "next/link";

export function LogoMark({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={className}
    >
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </svg>
  );
}

export function Logo({
  href = "/",
  tone = "light",
}: {
  href?: string;
  tone?: "light" | "dark";
}) {
  return (
    <Link href={href} aria-label="LendLoop home" className="flex items-center gap-2.5">
      <LogoMark className={tone === "dark" ? "text-mint" : "text-brand"} />
      <span
        className={`font-display text-2xl font-bold tracking-tight ${
          tone === "dark" ? "text-paper" : "text-ink"
        }`}
      >
        LendLoop
      </span>
    </Link>
  );
}
