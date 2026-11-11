import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireAdmin } from "./lib/auth";
import { fail } from "./lib/errors";
import { displayNameFromEmail, isAdminEmail } from "./lib/roles";

/**
 * Called by the client right after sign-in. Creates the user row on first
 * login and re-derives the role on every login. Everything here comes from
 * the verified Clerk token; the client sends no arguments.
 */
export const ensureCurrent = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) fail("UNAUTHENTICATED", "Sign in to continue.");
    if (!identity.email || identity.emailVerified !== true) {
      // The role depends on the email, so an unverified one is never trusted.
      fail("FORBIDDEN", "A verified email address is required.");
    }

    const role = isAdminEmail(identity.email, process.env.ADMIN_EMAILS)
      ? "admin"
      : "user";

    const existing = await getCurrentUser(ctx);
    if (existing) {
      if (existing.role !== role || existing.email !== identity.email) {
        await ctx.db.patch(existing._id, { role, email: identity.email });
      }
      return { role };
    }

    await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email,
      name: displayNameFromEmail(identity.email),
      role,
      trustedLender: false,
    });
    return { role };
  },
});

/** The caller's own profile. Never includes the email. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return {
      name: user.name,
      role: user.role,
      trustedLender: user.trustedLender,
    };
  },
});

/** Admin only: lenders with their listing counts, for the Trusted Lender toggle. */
export const listLenders = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").take(500);
    return await Promise.all(
      users.map(async (u) => {
        const tools = await ctx.db
          .query("tools")
          .withIndex("by_owner", (q) =>
            q.eq("ownerId", u._id).eq("deletedAt", undefined),
          )
          .take(200);
        return {
          userId: u._id,
          name: u.name,
          listings: tools.length,
          trustedLender: u.trustedLender,
        };
      }),
    );
  },
});

/** Admin only: mark or unmark a lender as Trusted. */
export const setTrusted = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    await requireAdmin(ctx);
    const target = await ctx.db.get(userId);
    if (!target) fail("NOT_FOUND", "User not found.");
    await ctx.db.patch(userId, { trustedLender: trusted });
    return null;
  },
});
