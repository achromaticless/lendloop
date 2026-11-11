import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  categoryValidator,
  conditionValidator,
  requestStatusValidator,
  roleValidator,
} from "./lib/validators";

export default defineSchema({
  users: defineTable({
    // Clerk issuer + subject. The only key we trust to identify a person.
    tokenIdentifier: v.string(),
    email: v.string(), // never returned to other users; only to the n8n endpoint
    // Public display name, chosen by the user in onboarding (never derived
    // from the email). Missing until they pick one.
    name: v.optional(v.string()),
    role: roleValidator,
    trustedLender: v.boolean(),
  }).index("by_token", ["tokenIdentifier"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
    // Soft delete keeps loan history intact.
    deletedAt: v.optional(v.number()),
  })
    .index("by_deleted", ["deletedAt"])
    .index("by_owner", ["ownerId", "deletedAt"])
    .index("by_category", ["category", "deletedAt"]),

  requests: defineTable({
    toolId: v.id("tools"),
    // Denormalised so "incoming" and authorization checks need no join.
    ownerId: v.id("users"),
    borrowerId: v.id("users"),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
    status: requestStatusValidator,
    // Written by the owner when approving. Visible only to the two parties,
    // and only while the loan is approved.
    pickupNote: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
  })
    .index("by_tool_status", ["toolId", "status"])
    .index("by_borrower", ["borrowerId"])
    .index("by_owner", ["ownerId"])
    .index("by_status_end", ["status", "endDate"]),
});
