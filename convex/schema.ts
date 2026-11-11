import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  categoryValidator,
  conditionValidator,
  eventTypeValidator,
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

  // Transactional outbox: a row is written in the same mutation that changes a
  // request, then delivered to n8n with retries. Holds ids and states only.
  outbox: defineTable({
    key: v.string(), // idempotency key, e.g. "approved:<requestId>"
    requestId: v.id("requests"),
    type: eventTypeValidator,
    recipient: v.union(v.literal("owner"), v.literal("borrower")),
    deliveryStatus: v.union(
      v.literal("pending"),
      v.literal("delivered"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    deliveredAt: v.optional(v.number()),
    // Reported back by n8n once the email was really sent (or failed).
    emailStatus: v.optional(v.union(v.literal("sent"), v.literal("failed"))),
    emailAt: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_request", ["requestId"])
    .index("by_delivery", ["deliveryStatus"]),

  // One row per overdue loan per UTC day. The unique key makes the daily
  // reminder idempotent: a retried run cannot create or send a second one.
  reminders: defineTable({
    key: v.string(), // "reminder:<requestId>:<YYYY-MM-DD>"
    requestId: v.id("requests"),
    day: v.string(),
    status: v.union(v.literal("claimed"), v.literal("sent"), v.literal("failed")),
    claimedAt: v.number(),
    attempts: v.number(),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_request", ["requestId"]),
});
