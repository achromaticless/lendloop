import type { Doc } from "../_generated/dataModel";

export const MAX_DISPLAY_NAME = 30;

/**
 * The only name other people ever see. It is chosen by the user, never derived
 * from their email. Until they pick one they appear as "Neighbor".
 */
export function publicName(user: Doc<"users"> | null | undefined): string {
  return user?.name?.trim() || "Neighbor";
}
