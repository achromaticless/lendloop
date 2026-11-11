import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin, requireUser } from "./lib/auth";
import {
  MAX_LOAN_DAYS,
  inclusiveDays,
  isValidISODate,
  rangesOverlap,
  todayISO,
} from "./lib/dates";
import { fail } from "./lib/errors";
import { emitRequestEvent } from "./lib/events";
import { publicName } from "./lib/names";

const MAX_PICKUP_NOTE = 280;
const MAX_PENDING_PER_USER = 20; // basic abuse guard

/** Approved loans of a tool that overlap a date range (optionally ignoring one). */
async function approvedOverlapping(
  ctx: QueryCtx,
  toolId: Id<"tools">,
  start: string,
  end: string,
  ignore?: Id<"requests">,
) {
  const approved = await ctx.db
    .query("requests")
    .withIndex("by_tool_status", (q) =>
      q.eq("toolId", toolId).eq("status", "approved"),
    )
    .take(200);
  return approved.filter(
    (r) => r._id !== ignore && rangesOverlap(start, end, r.startDate, r.endDate),
  );
}

/** Loads a request, hiding existence from people who are not a party to it. */
async function loadForParty(
  ctx: QueryCtx,
  requestId: Id<"requests">,
  me: Doc<"users">,
) {
  const req = await ctx.db.get(requestId);
  if (!req || (req.ownerId !== me._id && req.borrowerId !== me._id)) {
    fail("NOT_FOUND", "Request not found.");
  }
  return req;
}

/** Borrower asks to borrow a tool for a date range. */
export const create = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { toolId, startDate, endDate }) => {
    const me = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.deletedAt !== undefined) fail("NOT_FOUND", "Tool not found.");
    if (tool.ownerId === me._id) fail("INVALID", "You cannot borrow your own tool.");

    if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
      fail("INVALID", "Dates must look like YYYY-MM-DD.");
    }
    if (startDate < todayISO()) fail("INVALID", "The start date is in the past.");
    if (endDate < startDate) fail("INVALID", "The end date is before the start date.");
    if (inclusiveDays(startDate, endDate) > MAX_LOAN_DAYS) {
      fail("INVALID", `Loans are limited to ${MAX_LOAN_DAYS} days.`);
    }

    if ((await approvedOverlapping(ctx, toolId, startDate, endDate)).length > 0) {
      fail("CONFLICT", "The tool is already booked for those dates.");
    }
    const mineOnTool = await ctx.db
      .query("requests")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", me._id))
      .take(500);
    const duplicate = mineOnTool.some(
      (r) =>
        r.toolId === toolId &&
        (r.status === "pending" || r.status === "approved") &&
        rangesOverlap(startDate, endDate, r.startDate, r.endDate),
    );
    if (duplicate) fail("CONFLICT", "You already requested this tool for those dates.");
    if (mineOnTool.filter((r) => r.status === "pending").length >= MAX_PENDING_PER_USER) {
      fail("CONFLICT", "You have too many pending requests. Wait for answers first.");
    }

    const requestId = await ctx.db.insert("requests", {
      toolId,
      ownerId: tool.ownerId, // taken from the tool, never from the client
      borrowerId: me._id,
      startDate,
      endDate,
      status: "pending",
    });
    await emitRequestEvent(ctx, { type: "created", requestId });
    return requestId;
  },
});

/**
 * Owner approves, optionally leaving a pick-up note for the borrower.
 * Re-checks overlap because other loans may have been approved meanwhile.
 */
export const approve = mutation({
  args: { requestId: v.id("requests"), pickupNote: v.optional(v.string()) },
  handler: async (ctx, { requestId, pickupNote }) => {
    const me = await requireUser(ctx);
    const note = pickupNote?.trim() || undefined;
    if (note && note.length > MAX_PICKUP_NOTE) {
      fail("INVALID", `The note can have up to ${MAX_PICKUP_NOTE} characters.`);
    }
    const req = await loadForParty(ctx, requestId, me);
    if (req.ownerId !== me._id) fail("FORBIDDEN", "Only the tool owner can approve.");
    if (req.status !== "pending") fail("CONFLICT", "Only pending requests can be approved.");
    const tool = await ctx.db.get(req.toolId);
    if (!tool || tool.deletedAt !== undefined) fail("CONFLICT", "This tool was removed.");
    if (
      (await approvedOverlapping(ctx, req.toolId, req.startDate, req.endDate, req._id))
        .length > 0
    ) {
      fail("CONFLICT", "Another loan already covers those dates.");
    }
    await ctx.db.patch(requestId, {
      status: "approved",
      pickupNote: note,
      decidedAt: Date.now(),
    });
    await emitRequestEvent(ctx, { type: "approved", requestId });
    return null;
  },
});

export const decline = mutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const me = await requireUser(ctx);
    const req = await loadForParty(ctx, requestId, me);
    if (req.ownerId !== me._id) fail("FORBIDDEN", "Only the tool owner can decline.");
    if (req.status !== "pending") fail("CONFLICT", "Only pending requests can be declined.");
    await ctx.db.patch(requestId, { status: "declined", decidedAt: Date.now() });
    await emitRequestEvent(ctx, { type: "declined", requestId });
    return null;
  },
});

/** Borrower withdraws a pending request. */
export const cancel = mutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const me = await requireUser(ctx);
    const req = await loadForParty(ctx, requestId, me);
    if (req.borrowerId !== me._id) fail("FORBIDDEN", "Only the borrower can cancel.");
    if (req.status !== "pending") fail("CONFLICT", "Only pending requests can be cancelled.");
    await ctx.db.patch(requestId, { status: "cancelled", decidedAt: Date.now() });
    await emitRequestEvent(ctx, { type: "cancelled", requestId });
    return null;
  },
});

/** Owner marks an approved loan as returned. */
export const markReturned = mutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const me = await requireUser(ctx);
    const req = await loadForParty(ctx, requestId, me);
    if (req.ownerId !== me._id) fail("FORBIDDEN", "Only the tool owner can mark it returned.");
    if (req.status !== "approved") fail("CONFLICT", "Only approved loans can be returned.");
    await ctx.db.patch(requestId, { status: "returned", returnedAt: Date.now() });
    await emitRequestEvent(ctx, { type: "returned", requestId });
    return null;
  },
});

// ---- Read models: shaped for the UI, never raw documents, never emails ----

async function shape(
  ctx: QueryCtx,
  requests: Doc<"requests">[],
  otherParty: "owner" | "borrower",
  today: string,
) {
  const users = new Map<Id<"users">, string>();
  const tools = new Map<Id<"tools">, Doc<"tools"> | null>();
  return await Promise.all(
    requests.map(async (r) => {
      const otherId = otherParty === "owner" ? r.ownerId : r.borrowerId;
      if (!users.has(otherId)) {
        users.set(otherId, publicName(await ctx.db.get(otherId)));
      }
      if (!tools.has(r.toolId)) tools.set(r.toolId, await ctx.db.get(r.toolId));
      const tool = tools.get(r.toolId);
      return {
        _id: r._id,
        toolName: tool?.name ?? "Removed tool",
        category: tool?.category ?? "Other",
        otherPartyName: users.get(otherId)!,
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
        overdue: r.status === "approved" && r.endDate < today,
        // Only the two parties ever get here, and only while the loan is live.
        pickupNote: r.status === "approved" ? (r.pickupNote ?? null) : null,
      };
    }),
  );
}

/** Requests I made as a borrower. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const rows = await ctx.db
      .query("requests")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", me._id))
      .order("desc")
      .take(200);
    return await shape(ctx, rows, "owner", todayISO());
  },
});

/** Requests other people made on my tools. */
export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const rows = await ctx.db
      .query("requests")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .order("desc")
      .take(200);
    return await shape(ctx, rows, "borrower", todayISO());
  },
});

/** Admin only: every loan in the system. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("requests").order("desc").take(500);
    const today = todayISO();
    const users = new Map<Id<"users">, string>();
    const tools = new Map<Id<"tools">, Doc<"tools"> | null>();
    return await Promise.all(
      rows.map(async (r) => {
        for (const id of [r.ownerId, r.borrowerId]) {
          if (!users.has(id)) users.set(id, publicName(await ctx.db.get(id)));
        }
        if (!tools.has(r.toolId)) tools.set(r.toolId, await ctx.db.get(r.toolId));
        return {
          _id: r._id,
          toolName: tools.get(r.toolId)?.name ?? "Removed tool",
          ownerName: users.get(r.ownerId)!,
          borrowerName: users.get(r.borrowerId)!,
          startDate: r.startDate,
          endDate: r.endDate,
          status: r.status,
          overdue: r.status === "approved" && r.endDate < today,
        };
      }),
    );
  },
});
