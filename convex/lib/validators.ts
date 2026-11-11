import { v } from "convex/values";

// Single source of truth for enums shared by the schema, the functions and the UI.
export const CATEGORIES = [
  "Power tools",
  "Garden",
  "Kitchen",
  "Camping",
  "Cleaning",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CONDITIONS = ["Like new", "Good", "Fair", "Worn"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const categoryValidator = v.union(
  v.literal("Power tools"),
  v.literal("Garden"),
  v.literal("Kitchen"),
  v.literal("Camping"),
  v.literal("Cleaning"),
  v.literal("Other"),
);

export const conditionValidator = v.union(
  v.literal("Like new"),
  v.literal("Good"),
  v.literal("Fair"),
  v.literal("Worn"),
);

export const roleValidator = v.union(v.literal("admin"), v.literal("user"));

export const requestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);
export const eventTypeValidator = v.union(
  v.literal("created"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);

export type RequestStatus =
  | "pending"
  | "approved"
  | "declined"
  | "cancelled"
  | "returned";
