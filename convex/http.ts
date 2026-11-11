import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { sha256Hex, verifyJwt } from "./lib/signing";

/**
 * HTTP API used only by n8n. Every route requires a short-lived HS256 token
 * (Authorization: Bearer) signed with N8N_API_SECRET whose claims bind it to
 * this exact request: method (m), path and query (p) and a SHA-256 of the raw
 * body (bh). The signature is checked against the raw bytes before anything is
 * parsed. Responses contain only what n8n needs.
 */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// Same body for every authentication failure, so the response teaches nothing.
const unauthorized = () => json({ error: "unauthorized" }, 401);

async function authenticate(request: Request, rawBody: string): Promise<boolean> {
  const secret = process.env.N8N_API_SECRET;
  if (!secret) return false;

  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;

  const verified = await verifyJwt(token, secret);
  if (!verified.ok) return false;

  const url = new URL(request.url);
  const { m, p, bh } = verified.claims;
  return (
    m === request.method &&
    p === `${url.pathname}${url.search}` &&
    bh === (await sha256Hex(rawBody))
  );
}

/** Wraps a handler with authentication and JSON parsing of the verified body. */
function secured(
  handler: (args: { body: unknown; url: URL }, ctx: Parameters<Parameters<typeof httpAction>[0]>[0]) => Promise<Response>,
) {
  return httpAction(async (ctx, request) => {
    const raw = await request.text();
    if (!(await authenticate(request, raw))) return unauthorized();
    let body: unknown = null;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ error: "invalid json" }, 400);
      }
    }
    return await handler({ body, url: new URL(request.url) }, ctx);
  });
}

const isId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9]{20,40}$/.test(value);

const http = httpRouter();

// Recipient and facts for one notification. 404 for unknown events.
http.route({
  path: "/n8n/notification",
  method: "GET",
  handler: secured(async ({ url }, ctx) => {
    const eventId = url.searchParams.get("eventId");
    if (!isId(eventId)) return json({ error: "invalid event id" }, 400);
    const details = await ctx.runQuery(internal.automation.notificationDetails, {
      eventId: eventId as Id<"outbox">,
    });
    return details ? json(details) : json({ error: "not found" }, 404);
  }),
});

// n8n reports whether the email was actually sent. Safe to repeat.
http.route({
  path: "/n8n/notification-result",
  method: "POST",
  handler: secured(async ({ body }, ctx) => {
    const b = body as { eventId?: unknown; status?: unknown } | null;
    if (!b || !isId(b.eventId) || (b.status !== "sent" && b.status !== "failed")) {
      return json({ error: "invalid body" }, 400);
    }
    const result = await ctx.runMutation(internal.automation.recordEmailResult, {
      eventId: b.eventId as Id<"outbox">,
      status: b.status,
    });
    return result.found ? json(result) : json({ error: "not found" }, 404);
  }),
});

// Overdue loans for the daily run. No email addresses here.
http.route({
  path: "/n8n/overdue",
  method: "GET",
  handler: secured(async (_args, ctx) => {
    return json({ loans: await ctx.runQuery(internal.automation.overdueLoans, {}) });
  }),
});

// Claim today's reminder for one loan before sending. Only a claim that wins
// returns the borrower's email.
http.route({
  path: "/n8n/reminders/claim",
  method: "POST",
  handler: secured(async ({ body }, ctx) => {
    const b = body as { requestId?: unknown } | null;
    if (!b || !isId(b.requestId)) return json({ error: "invalid body" }, 400);
    const result = await ctx.runMutation(internal.automation.claimReminder, {
      requestId: b.requestId as Id<"requests">,
    });
    return json(result);
  }),
});

// Outcome of a claimed reminder. Idempotent write-back.
http.route({
  path: "/n8n/reminders/result",
  method: "POST",
  handler: secured(async ({ body }, ctx) => {
    const b = body as { reminderId?: unknown; status?: unknown; error?: unknown } | null;
    if (!b || !isId(b.reminderId) || (b.status !== "sent" && b.status !== "failed")) {
      return json({ error: "invalid body" }, 400);
    }
    const result = await ctx.runMutation(internal.automation.recordReminderResult, {
      reminderId: b.reminderId as Id<"reminders">,
      status: b.status,
      error: typeof b.error === "string" ? b.error : undefined,
    });
    return result.found ? json(result) : json({ error: "not found" }, 404);
  }),
});

export default http;
