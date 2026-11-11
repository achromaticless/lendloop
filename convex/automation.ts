import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { todayISO } from "./lib/dates";
import { fail } from "./lib/errors";
import { publicName } from "./lib/names";
import { sha256Hex, signJwt } from "./lib/signing";

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 30_000; // 30s, 1m, 2m, 4m between attempts
const WEBHOOK_TIMEOUT_MS = 10_000;
const CLAIM_TIMEOUT_MS = 30 * 60_000; // an abandoned reminder claim can be retaken

// ---------------------------------------------------------------------------
// Convex -> n8n: delivery of outbox events
// ---------------------------------------------------------------------------

/**
 * Sends one outbox event to the n8n webhook. The body carries only ids and the
 * event type; n8n asks for the recipient's details through a signed endpoint.
 * Failures are retried with exponential backoff and end in a visible "failed"
 * state instead of disappearing.
 */
export const deliver = internalAction({
  args: { outboxId: v.id("outbox") },
  handler: async (ctx, { outboxId }) => {
    const row = await ctx.runQuery(internal.automation.getOutbox, { outboxId });
    if (!row || row.deliveryStatus !== "pending") return;

    const url = process.env.N8N_WEBHOOK_URL;
    const secret = process.env.N8N_WEBHOOK_SECRET;
    if (!url || !secret) {
      await ctx.runMutation(internal.automation.recordAttempt, {
        outboxId,
        ok: false,
        error: "n8n webhook is not configured",
        giveUp: true,
      });
      return;
    }

    const body = JSON.stringify({
      eventId: outboxId,
      type: row.type,
      recipient: row.recipient,
    });
    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt(
      { iss: "lendloop", iat: now, exp: now + 300, jti: outboxId, bh: await sha256Hex(body) },
      secret,
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`n8n answered with status ${res.status}`);
      await ctx.runMutation(internal.automation.recordAttempt, { outboxId, ok: true });
    } catch (error) {
      // Never log or store the URL or the token: they are secrets.
      await ctx.runMutation(internal.automation.recordAttempt, {
        outboxId,
        ok: false,
        error: error instanceof Error ? error.message : "unknown error",
      });
    } finally {
      clearTimeout(timer);
    }
  },
});

export const getOutbox = internalQuery({
  args: { outboxId: v.id("outbox") },
  handler: async (ctx, { outboxId }) => await ctx.db.get(outboxId),
});

export const recordAttempt = internalMutation({
  args: {
    outboxId: v.id("outbox"),
    ok: v.boolean(),
    error: v.optional(v.string()),
    giveUp: v.optional(v.boolean()),
  },
  handler: async (ctx, { outboxId, ok, error, giveUp }) => {
    const row = await ctx.db.get(outboxId);
    if (!row || row.deliveryStatus !== "pending") return;
    const attempts = row.attempts + 1;

    if (ok) {
      await ctx.db.patch(outboxId, {
        deliveryStatus: "delivered",
        attempts,
        deliveredAt: Date.now(),
        lastError: undefined,
      });
      return;
    }
    if (giveUp || attempts >= MAX_ATTEMPTS) {
      await ctx.db.patch(outboxId, { deliveryStatus: "failed", attempts, lastError: error });
      return;
    }
    await ctx.db.patch(outboxId, { attempts, lastError: error });
    await ctx.scheduler.runAfter(
      BASE_BACKOFF_MS * 2 ** (attempts - 1),
      internal.automation.deliver,
      { outboxId },
    );
  },
});

// ---------------------------------------------------------------------------
// Admin visibility: failures must never be silent
// ---------------------------------------------------------------------------

export const listOutbox = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("outbox").order("desc").take(100);
    return await Promise.all(
      rows.map(async (r) => {
        const req = await ctx.db.get(r.requestId);
        const tool = req ? await ctx.db.get(req.toolId) : null;
        return {
          _id: r._id,
          type: r.type,
          recipient: r.recipient,
          toolName: tool?.name ?? "Removed tool",
          deliveryStatus: r.deliveryStatus,
          attempts: r.attempts,
          lastError: r.lastError ?? null,
          emailStatus: r.emailStatus ?? null,
        };
      }),
    );
  },
});

/** Admin: put a failed event back in the queue. */
export const retry = mutation({
  args: { outboxId: v.id("outbox") },
  handler: async (ctx, { outboxId }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(outboxId);
    if (!row) fail("NOT_FOUND", "Event not found.");
    if (row.deliveryStatus !== "failed") fail("CONFLICT", "Only failed events can be retried.");
    await ctx.db.patch(outboxId, { deliveryStatus: "pending", attempts: 0, lastError: undefined });
    await ctx.scheduler.runAfter(0, internal.automation.deliver, { outboxId });
    return null;
  },
});

// ---------------------------------------------------------------------------
// n8n -> Convex: what the HTTP endpoints (convex/http.ts) call
// ---------------------------------------------------------------------------

/**
 * Everything n8n needs to write one notification email. This is the ONLY place
 * a recipient's email address leaves the database, and only for an event that
 * exists. It never includes the pick-up note.
 */
export const notificationDetails = internalQuery({
  args: { eventId: v.id("outbox") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) return null;
    const req = await ctx.db.get(event.requestId);
    if (!req) return null;
    const tool = await ctx.db.get(req.toolId);
    const owner = await ctx.db.get(req.ownerId);
    const borrower = await ctx.db.get(req.borrowerId);
    const recipient = event.recipient === "owner" ? owner : borrower;
    const other = event.recipient === "owner" ? borrower : owner;
    if (!recipient) return null;
    return {
      eventId: event._id,
      type: event.type,
      // Lets n8n skip a duplicate run (e.g. Convex retried after a slow answer).
      alreadySent: event.emailStatus === "sent",
      recipientRole: event.recipient,
      to: recipient.email,
      toName: publicName(recipient),
      otherName: publicName(other),
      toolName: tool?.name ?? "a tool",
      startDate: req.startDate,
      endDate: req.endDate,
    };
  },
});

/** Idempotent: repeating the same result changes nothing. */
export const recordEmailResult = internalMutation({
  args: {
    eventId: v.id("outbox"),
    status: v.union(v.literal("sent"), v.literal("failed")),
  },
  handler: async (ctx, { eventId, status }) => {
    const event = await ctx.db.get(eventId);
    if (!event) return { found: false as const };
    // A confirmed "sent" is final; a late "failed" from a duplicate run must not undo it.
    if (event.emailStatus === "sent" || event.emailStatus === status) {
      return { found: true as const, changed: false };
    }
    await ctx.db.patch(eventId, { emailStatus: status, emailAt: Date.now() });
    return { found: true as const, changed: true };
  },
});

/** Approved loans whose end date has passed, without email addresses. */
export const overdueLoans = internalQuery({
  args: {},
  handler: async (ctx) => {
    const today = todayISO();
    const rows = await ctx.db
      .query("requests")
      .withIndex("by_status_end", (q) => q.eq("status", "approved").lt("endDate", today))
      .take(200);
    const out = [];
    for (const r of rows) {
      const reminder = await ctx.db
        .query("reminders")
        .withIndex("by_key", (q) => q.eq("key", `reminder:${r._id}:${today}`))
        .unique();
      if (reminder?.status === "sent") continue; // already done today
      const tool = await ctx.db.get(r.toolId);
      const daysOverdue = Math.round(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${r.endDate}T00:00:00Z`)) / 86_400_000,
      );
      out.push({
        requestId: r._id,
        toolName: tool?.name ?? "a tool",
        endDate: r.endDate,
        daysOverdue,
      });
    }
    return out;
  },
});

/**
 * n8n claims the right to send today's reminder BEFORE sending it. Only one
 * claim can win per loan per day, so a retried or duplicated run cannot send
 * a second email. A claim that was never completed can be taken again after
 * a timeout, and a failed one can be retried.
 */
export const claimReminder = internalMutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const today = todayISO();
    const req = await ctx.db.get(requestId);
    if (!req || req.status !== "approved" || req.endDate >= today) {
      return { claimed: false as const, reason: "not overdue" };
    }

    const key = `reminder:${requestId}:${today}`;
    const existing = await ctx.db
      .query("reminders")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const now = Date.now();

    let reminderId;
    if (!existing) {
      reminderId = await ctx.db.insert("reminders", {
        key,
        requestId,
        day: today,
        status: "claimed",
        claimedAt: now,
        attempts: 1,
      });
    } else if (
      existing.status === "failed" ||
      (existing.status === "claimed" && now - existing.claimedAt > CLAIM_TIMEOUT_MS)
    ) {
      await ctx.db.patch(existing._id, {
        status: "claimed",
        claimedAt: now,
        attempts: existing.attempts + 1,
        error: undefined,
      });
      reminderId = existing._id;
    } else {
      return { claimed: false as const, reason: existing.status };
    }

    const tool = await ctx.db.get(req.toolId);
    const borrower = await ctx.db.get(req.borrowerId);
    const owner = await ctx.db.get(req.ownerId);
    if (!borrower) return { claimed: false as const, reason: "borrower missing" };
    return {
      claimed: true as const,
      reminderId,
      to: borrower.email,
      toName: publicName(borrower),
      ownerName: publicName(owner),
      toolName: tool?.name ?? "a tool",
      endDate: req.endDate,
    };
  },
});

export const recordReminderResult = internalMutation({
  args: {
    reminderId: v.id("reminders"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { reminderId, status, error }) => {
    const reminder = await ctx.db.get(reminderId);
    if (!reminder) return { found: false as const };
    if (reminder.status === "sent" || reminder.status === status) {
      return { found: true as const, changed: false };
    }
    await ctx.db.patch(reminderId, {
      status,
      error: status === "failed" ? (error ?? "unknown error").slice(0, 200) : undefined,
      sentAt: status === "sent" ? Date.now() : undefined,
    });
    return { found: true as const, changed: true };
  },
});
