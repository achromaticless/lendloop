import { ConvexError } from "convex/values";

/** The human message from a failed Convex call, safe to show in the UI. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string } | string | undefined;
    if (typeof data === "string") return data;
    if (data?.message) return data.message;
  }
  return "Something went wrong. Please try again.";
}
