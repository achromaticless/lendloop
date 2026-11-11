import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireUser } from "./lib/auth";
import { todayISO } from "./lib/dates";
import { fail } from "./lib/errors";
import { emitRequestEvent } from "./lib/events";
import { publicName } from "./lib/names";
import { categoryValidator, conditionValidator } from "./lib/validators";

const MAX_NAME = 80;
const MAX_DESCRIPTION = 280;
const MAX_TOOLS_PER_USER = 50; // basic abuse guard

function cleanText(label: string, value: string, max: number): string {
  const text = value.trim();
  if (!text) fail("INVALID", `${label} is required.`);
  if (text.length > max) {
    fail("INVALID", `${label} must be at most ${max} characters.`);
  }
  return text;
}

/** Whether a tool is out on loan today, and until when. */
async function loanStatus(ctx: QueryCtx, toolId: Id<"tools">, today: string) {
  const approved = await ctx.db
    .query("requests")
    .withIndex("by_tool_status", (q) =>
      q.eq("toolId", toolId).eq("status", "approved"),
    )
    .take(100);
  // An approved loan that has started and was never returned keeps the tool
  // unavailable, even when it is overdue.
  const current = approved.filter((r) => r.startDate <= today);
  if (current.length === 0) return { available: true as const };
  const backAt = current.map((r) => r.endDate).sort().at(-1)!;
  return { available: false as const, backAt };
}

/**
 * PUBLIC (no sign-in): exactly name and category, only for tools that are
 * available right now. Nothing about owners, not even ids.
 */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const today = todayISO();
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_deleted", (q) => q.eq("deletedAt", undefined))
      .order("desc")
      .take(100);
    const available = await Promise.all(
      tools.map(async (t) => ((await loanStatus(ctx, t._id, today)).available ? t : null)),
    );
    return available
      .filter((t) => t !== null)
      .map((t) => ({ name: t.name, category: t.category }));
  },
});

/** Signed-in browse: all tools with availability, optionally by category. */
export const list = query({
  args: { category: v.optional(categoryValidator) },
  handler: async (ctx, { category }) => {
    const me = await requireUser(ctx);
    const today = todayISO();
    const tools = category
      ? await ctx.db
          .query("tools")
          .withIndex("by_category", (q) =>
            q.eq("category", category).eq("deletedAt", undefined),
          )
          .order("desc")
          .take(200)
      : await ctx.db
          .query("tools")
          .withIndex("by_deleted", (q) => q.eq("deletedAt", undefined))
          .order("desc")
          .take(200);

    const owners = new Map<Id<"users">, Doc<"users"> | null>();
    return await Promise.all(
      tools.map(async (t) => {
        if (!owners.has(t.ownerId)) owners.set(t.ownerId, await ctx.db.get(t.ownerId));
        const owner = owners.get(t.ownerId);
        const status = await loanStatus(ctx, t._id, today);
        return {
          _id: t._id,
          name: t.name,
          category: t.category,
          condition: t.condition,
          description: t.description,
          ownerName: publicName(owner),
          ownerTrusted: owner?.trustedLender ?? false,
          isMine: t.ownerId === me._id,
          ...status,
        };
      }),
    );
  },
});

/** The caller's own listings. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const today = todayISO();
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) =>
        q.eq("ownerId", me._id).eq("deletedAt", undefined),
      )
      .order("desc")
      .take(200);
    return await Promise.all(
      tools.map(async (t) => ({
        _id: t._id,
        name: t.name,
        category: t.category,
        condition: t.condition,
        description: t.description,
        ...(await loanStatus(ctx, t._id, today)),
      })),
    );
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const owned = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) =>
        q.eq("ownerId", me._id).eq("deletedAt", undefined),
      )
      .take(MAX_TOOLS_PER_USER);
    if (owned.length >= MAX_TOOLS_PER_USER) {
      fail("CONFLICT", `You can list up to ${MAX_TOOLS_PER_USER} tools.`);
    }
    return await ctx.db.insert("tools", {
      ownerId: me._id, // always the caller, never an argument
      name: cleanText("Name", args.name, MAX_NAME),
      category: args.category,
      condition: args.condition,
      description: cleanText("Description", args.description, MAX_DESCRIPTION),
    });
  },
});

/** Owner only. Admins may remove listings but not edit other people's. */
export const update = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.optional(v.string()),
    category: v.optional(categoryValidator),
    condition: v.optional(conditionValidator),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { toolId, ...changes }) => {
    const me = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.deletedAt !== undefined) fail("NOT_FOUND", "Tool not found.");
    if (tool.ownerId !== me._id) fail("FORBIDDEN", "You can only edit your own tools.");

    const patch: Partial<Doc<"tools">> = {};
    if (changes.name !== undefined) patch.name = cleanText("Name", changes.name, MAX_NAME);
    if (changes.description !== undefined) {
      patch.description = cleanText("Description", changes.description, MAX_DESCRIPTION);
    }
    if (changes.category !== undefined) patch.category = changes.category;
    if (changes.condition !== undefined) patch.condition = changes.condition;
    await ctx.db.patch(toolId, patch);
    return null;
  },
});

/**
 * Owner or admin. Soft delete so loan history survives. Pending requests are
 * cancelled; an owner cannot remove a tool that is still out on loan (an admin
 * can, and those loans are cancelled).
 */
export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const me = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.deletedAt !== undefined) fail("NOT_FOUND", "Tool not found.");
    const isOwner = tool.ownerId === me._id;
    if (!isOwner && me.role !== "admin") {
      fail("FORBIDDEN", "You can only remove your own tools.");
    }

    const open = await openRequests(ctx, toolId);
    const approved = open.filter((r) => r.status === "approved");
    if (approved.length > 0 && !(me.role === "admin")) {
      fail("CONFLICT", "This tool is on loan. Mark it as returned first.");
    }

    for (const r of open) {
      await ctx.db.patch(r._id, { status: "cancelled", decidedAt: Date.now() });
      await emitRequestEvent(ctx, { type: "cancelled", requestId: r._id });
    }
    await ctx.db.patch(toolId, { deletedAt: Date.now() });
    return null;
  },
});

async function openRequests(ctx: MutationCtx, toolId: Id<"tools">) {
  const [pending, approved] = await Promise.all(
    (["pending", "approved"] as const).map((status) =>
      ctx.db
        .query("requests")
        .withIndex("by_tool_status", (q) =>
          q.eq("toolId", toolId).eq("status", status),
        )
        .take(100),
    ),
  );
  return [...pending, ...approved];
}
