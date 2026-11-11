import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type RequestEventType =
  | "created"
  | "approved"
  | "declined"
  | "cancelled"
  | "returned";

export type EventRecipient = "owner" | "borrower";

/**
 * The single hook every request mutation calls when someone should be told.
 *
 * It writes an outbox row in the SAME transaction as the state change (so an
 * event exists if and only if the change committed) and schedules delivery to
 * n8n. The caller decides who must be notified: a cancellation by the
 * borrower tells the owner, a cancellation caused by removing a tool tells the
 * borrower.
 *
 * The key is naturally unique: each type happens at most once per request.
 */
export async function emitRequestEvent(
  ctx: MutationCtx,
  event: { type: RequestEventType; requestId: Id<"requests">; recipient: EventRecipient },
): Promise<void> {
  const key = `${event.type}:${event.requestId}`;
  const existing = await ctx.db
    .query("outbox")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (existing) return;

  const outboxId = await ctx.db.insert("outbox", {
    key,
    requestId: event.requestId,
    type: event.type,
    recipient: event.recipient,
    deliveryStatus: "pending",
    attempts: 0,
  });
  await ctx.scheduler.runAfter(0, internal.automation.deliver, { outboxId });
}
