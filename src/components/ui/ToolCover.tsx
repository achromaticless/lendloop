import { categoryStyle } from "@/lib/categories";

/**
 * Cover for a tool. Today every tool uses the category placeholder; when photo
 * upload lands, pass `photoUrl` and the photo replaces it.
 */
export function ToolCover({
  category,
  photoUrl,
  size = "card",
  className = "",
}: {
  category: string;
  photoUrl?: string | null;
  size?: "card" | "thumb";
  className?: string;
}) {
  const s = categoryStyle(category);
  const iconSize = size === "card" ? 64 : 34;

  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={`object-cover ${className}`} />;
  }

  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center ${className}`}
      style={{
        background: `radial-gradient(circle at 86% 14%, ${s.soft} 0 26%, transparent 26.5%), radial-gradient(circle at 8% 104%, ${s.soft} 0 24%, transparent 24.5%), ${s.bg}`,
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke={s.fg}
        strokeWidth={size === "card" ? 1.3 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={s.icon} />
      </svg>
    </div>
  );
}
