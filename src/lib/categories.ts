import type { Category } from "@convex/lib/validators";

/**
 * Visual identity of each tool category. The cover shown when a tool has no
 * photo uses these colours, so a missing photo still tells you what it is.
 * Icons are 24x24 stroke paths.
 */
export type CategoryStyle = { icon: string; bg: string; fg: string; soft: string };

const WRENCH =
  "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z";
const LEAF =
  "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12";
const UTENSILS =
  "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2 M7 2v20 M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7";
const TENT = "M3.5 21 14 3 M20.5 21 10 3 M15.5 21 12 15l-3.5 6 M2 21h20";
const DROP =
  "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z";
const BOX = "M21 8 12 3 3 8v8l9 5 9-5V8Z M3 8l9 5 9-5 M12 13v8";

export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  "Power tools": { icon: WRENCH, bg: "#F6E3B4", fg: "#7A5200", soft: "#EDCF86" },
  Garden: { icon: LEAF, bg: "#D5E8D0", fg: "#1F6B3A", soft: "#B9D7B1" },
  Kitchen: { icon: UTENSILS, bg: "#F8D9CC", fg: "#9A3B1A", soft: "#F0BDA8" },
  Camping: { icon: TENT, bg: "#CFE3EA", fg: "#1F5F73", soft: "#B0CFDB" },
  Cleaning: { icon: DROP, bg: "#D3E1F4", fg: "#1D4E89", soft: "#B3CBE9" },
  Other: { icon: BOX, bg: "#E6E0CF", fg: "#5B6158", soft: "#D6D0BD" },
};

export function categoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category as Category] ?? CATEGORY_STYLES.Other;
}
