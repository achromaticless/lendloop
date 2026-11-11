import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type RequestEventType =
  | "created"
  | "approved"
  | "declined"
  | "cancelled"
  | "returned";

/**
 * Single hook every request mutation calls when something worth notifying
 * happens. It is intentionally a no-op for now: the n8n integration will
 * enqueue a signed outbox event here, so there is exactly one place to change.
 */
export async function emitRequestEvent(
  _ctx: MutationCtx,
  _event: { type: RequestEventType; requestId: Id<"requests"> },
): Promise<void> {
  // implemented in the automation phase
}
