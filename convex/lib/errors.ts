import { ConvexError } from "convex/values";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID"
  | "CONFLICT";

/** Throw a structured error the UI can switch on (`error.data.code`). */
export function fail(code: ErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}
