/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import { sha256Hex, signJwt, verifyJwt } from "./lib/signing";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

const ISSUER = "https://clerk.test";
const identity = (name: string, email: string) => ({
  tokenIdentifier: `${ISSUER}|${name}`,
  subject: name,
  issuer: ISSUER,
  email,
  emailVerified: true,
});
const owner = identity("owner", "owner@example.com");
const borrower = identity("borrower", "borrower@example.com");
const admin = identity("root", "root@example.com");

const WEBHOOK_SECRET = "test-webhook-secret";
const API_SECRET = "test-api-secret";

function plusDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}
const nowSeconds = () => Math.floor(Date.now() / 1000);

async function setup() {
  const t = convexTest(schema, modules);
  for (const [who, name] of [
    [owner, "Olivia"],
    [borrower, "Bruno"],
    [admin, "Root"],
  ] as const) {
    const asUser = t.withIdentity(who);
    await asUser.mutation(api.users.ensureCurrent, {});
    await asUser.mutation(api.users.setDisplayName, { name });
  }
  const toolId = await t.withIdentity(owner).mutation(api.tools.create, {
    name: "Cordless drill",
    category: "Power tools",
    condition: "Good",
    description: "18V.",
  });
  return { t, toolId };
}

async function outboxRows(t: Awaited<ReturnType<typeof setup>>["t"]) {
  return await t.run(async (ctx) => await ctx.db.query("outbox").collect());
}

/** A token as n8n would build it for one specific request. */
async function n8nToken(opts: {
  method: string;
  path: string; // pathname + query
  body?: string;
  secret?: string;
  iat?: number;
  exp?: number;
  bodyForHash?: string;
}) {
  const iat = opts.iat ?? nowSeconds();
  return await signJwt(
    {
      iss: "n8n",
      iat,
      exp: opts.exp ?? iat + 300,
      jti: crypto.randomUUID(),
      m: opts.method,
      p: opts.path,
      bh: await sha256Hex(opts.bodyForHash ?? opts.body ?? ""),
    },
    opts.secret ?? API_SECRET,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.ADMIN_EMAILS = "root@example.com";
  process.env.N8N_API_SECRET = API_SECRET;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  for (const k of ["ADMIN_EMAILS", "N8N_API_SECRET", "N8N_WEBHOOK_URL", "N8N_WEBHOOK_SECRET"]) {
    delete process.env[k];
  }
});

// ---------------------------------------------------------------------------

describe("token verification", () => {
  const claims = (over: Record<string, unknown> = {}) => ({
    iat: nowSeconds(),
    exp: nowSeconds() + 300,
    ...over,
  });

  it("accepts a valid token and rejects every kind of bad one", async () => {
    const good = await signJwt(claims(), "s3cret");
    expect((await verifyJwt(good, "s3cret")).ok).toBe(true);

    // Wrong secret, tampered payload, expired, from the future, too long-lived.
    expect((await verifyJwt(good, "other")).ok).toBe(false);
    const [h, , s] = good.split(".");
    const forged = `${h}.${btoa(JSON.stringify(claims({ admin: true }))).replace(/=+$/, "")}.${s}`;
    expect((await verifyJwt(forged, "s3cret")).ok).toBe(false);
    expect((await verifyJwt(await signJwt(claims({ iat: 1, exp: 2 }), "s3cret"), "s3cret")).ok).toBe(false);
    expect((await verifyJwt(await signJwt(claims({ iat: nowSeconds() + 3600, exp: nowSeconds() + 3900 }), "s3cret"), "s3cret")).ok).toBe(false);
    expect((await verifyJwt(await signJwt(claims({ exp: nowSeconds() + 86_400 }), "s3cret"), "s3cret")).ok).toBe(false);
    expect((await verifyJwt("not.a.token", "s3cret")).ok).toBe(false);
  });

  it("refuses the 'none' algorithm", async () => {
    const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "");
    const unsigned = `${enc({ alg: "none", typ: "JWT" })}.${enc(claims())}.`;
    expect((await verifyJwt(unsigned, "s3cret")).ok).toBe(false);
  });
});

describe("outbox", () => {
  it("writes an event in the same transaction as the request change", async () => {
    const { t, toolId } = await setup();
    const requestId = await t
      .withIdentity(borrower)
      .mutation(api.requests.create, { toolId, startDate: plusDays(2), endDate: plusDays(3) });
    let rows = await outboxRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "created", recipient: "owner", deliveryStatus: "pending" });

    await t.withIdentity(owner).mutation(api.requests.approve, { requestId });
    await t.withIdentity(owner).mutation(api.requests.markReturned, { requestId });
    rows = await outboxRows(t);
    expect(rows.map((r) => `${r.type}->${r.recipient}`).sort()).toEqual([
      "approved->borrower",
      "created->owner",
      "returned->borrower",
    ]);
  });

  it("tells the right person when a request is cancelled", async () => {
    const { t, toolId } = await setup();
    const asBorrower = t.withIdentity(borrower);
    const r1 = await asBorrower.mutation(api.requests.create, { toolId, startDate: plusDays(2), endDate: plusDays(3) });
    await asBorrower.mutation(api.requests.cancel, { requestId: r1 });
    const r2 = await asBorrower.mutation(api.requests.create, { toolId, startDate: plusDays(5), endDate: plusDays(6) });
    // The owner removes the tool: the borrower is the one to tell.
    await t.withIdentity(owner).mutation(api.tools.remove, { toolId });
    const rows = await outboxRows(t);
    expect(rows.find((r) => r.requestId === r1 && r.type === "cancelled")?.recipient).toBe("owner");
    expect(rows.find((r) => r.requestId === r2 && r.type === "cancelled")?.recipient).toBe("borrower");
  });

  it("delivers a signed webhook that carries ids only", async () => {
    process.env.N8N_WEBHOOK_URL = "https://n8n.example/webhook/lendloop";
    process.env.N8N_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("ok", { status: 200 });
    });

    const { t, toolId } = await setup();
    await t
      .withIdentity(borrower)
      .mutation(api.requests.create, { toolId, startDate: plusDays(2), endDate: plusDays(3) });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(calls).toHaveLength(1);
    const body = calls[0].init.body as string;
    // Data minimisation: no email, no name, no dates in the payload.
    expect(body).not.toContain("@");
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(["eventId", "recipient", "type"]);

    const auth = (calls[0].init.headers as Record<string, string>).Authorization;
    const verified = await verifyJwt(auth.replace("Bearer ", ""), WEBHOOK_SECRET);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.claims.bh).toBe(await sha256Hex(body));

    expect((await outboxRows(t))[0].deliveryStatus).toBe("delivered");
  });

  it("retries with backoff and ends in a visible failed state", async () => {
    process.env.N8N_WEBHOOK_URL = "https://n8n.example/webhook/lendloop";
    process.env.N8N_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const fetchMock = vi.fn(async () => new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const { t, toolId } = await setup();
    await t
      .withIdentity(borrower)
      .mutation(api.requests.create, { toolId, startDate: plusDays(2), endDate: plusDays(3) });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    const [row] = await outboxRows(t);
    expect(row.deliveryStatus).toBe("failed");
    expect(row.attempts).toBe(5);
    expect(row.lastError).toBe("n8n answered with status 500");
    // The URL and the token must never end up in stored errors.
    expect(JSON.stringify(row)).not.toContain("n8n.example");
  });

  it("recovers: one failure then success is delivered", async () => {
    process.env.N8N_WEBHOOK_URL = "https://n8n.example/webhook/lendloop";
    process.env.N8N_WEBHOOK_SECRET = WEBHOOK_SECRET;
    let n = 0;
    vi.stubGlobal("fetch", async () => (++n === 1 ? new Response("x", { status: 502 }) : new Response("ok")));

    const { t, toolId } = await setup();
    await t
      .withIdentity(borrower)
      .mutation(api.requests.create, { toolId, startDate: plusDays(2), endDate: plusDays(3) });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [row] = await outboxRows(t);
    expect(row).toMatchObject({ deliveryStatus: "delivered", attempts: 2 });
  });

  it("fails visibly (not silently) when n8n is not configured, and admins can retry", async () => {
    const { t, toolId } = await setup();
    await t
      .withIdentity(borrower)
      .mutation(api.requests.create, { toolId, startDate: plusDays(2), endDate: plusDays(3) });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const asAdmin = t.withIdentity(admin);
    const [listed] = await asAdmin.query(api.automation.listOutbox, {});
    expect(listed).toMatchObject({ deliveryStatus: "failed", lastError: "n8n webhook is not configured" });

    // Only admins see or retry events.
    await expect(t.withIdentity(owner).query(api.automation.listOutbox, {})).rejects.toThrow();
    await expect(
      t.withIdentity(owner).mutation(api.automation.retry, { outboxId: listed._id }),
    ).rejects.toThrow();

    process.env.N8N_WEBHOOK_URL = "https://n8n.example/webhook/lendloop";
    process.env.N8N_WEBHOOK_SECRET = WEBHOOK_SECRET;
    vi.stubGlobal("fetch", async () => new Response("ok"));
    await asAdmin.mutation(api.automation.retry, { outboxId: listed._id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await outboxRows(t))[0].deliveryStatus).toBe("delivered");
  });
});

// ---------------------------------------------------------------------------

describe("n8n HTTP endpoints", () => {
  async function createdEvent() {
    const { t, toolId } = await setup();
    await t
      .withIdentity(borrower)
      .mutation(api.requests.create, { toolId, startDate: plusDays(2), endDate: plusDays(3) });
    const [row] = await outboxRows(t);
    return { t, toolId, eventId: row._id };
  }

  it("rejects unauthenticated, forged, expired and mis-bound requests", async () => {
    const { t, eventId } = await createdEvent();
    const path = `/n8n/notification?eventId=${eventId}`;
    const call = (token?: string) =>
      t.fetch(path, { method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : {} });

    expect((await call()).status).toBe(401);
    expect((await call("garbage")).status).toBe(401);
    // Right shape, wrong secret.
    expect((await call(await n8nToken({ method: "GET", path, secret: "wrong" }))).status).toBe(401);
    // Expired.
    const old = nowSeconds() - 3600;
    expect((await call(await n8nToken({ method: "GET", path, iat: old, exp: old + 300 }))).status).toBe(401);
    // Token minted for a different path (replay against another resource).
    expect((await call(await n8nToken({ method: "GET", path: "/n8n/overdue" }))).status).toBe(401);
    // Token minted for a different event id.
    expect(
      (await call(await n8nToken({ method: "GET", path: `/n8n/notification?eventId=${eventId}x` }))).status,
    ).toBe(401);
    // Unconfigured server secret: closed, not open.
    delete process.env.N8N_API_SECRET;
    expect((await call(await n8nToken({ method: "GET", path }))).status).toBe(401);
  });

  it("rejects a body that does not match the signed hash", async () => {
    const { t, eventId } = await createdEvent();
    const path = "/n8n/notification-result";
    const signedFor = JSON.stringify({ eventId, status: "sent" });
    const sent = JSON.stringify({ eventId, status: "failed" }); // tampered after signing
    const res = await t.fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await n8nToken({ method: "POST", path, body: signedFor })}`,
      },
      body: sent,
    });
    expect(res.status).toBe(401);
  });

  it("returns the recipient only to a valid caller, and never the pick-up note", async () => {
    const { t, toolId, eventId } = await createdEvent();
    const path = `/n8n/notification?eventId=${eventId}`;
    const res = await t.fetch(path, {
      method: "GET",
      headers: { Authorization: `Bearer ${await n8nToken({ method: "GET", path })}` },
    });
    expect(res.status).toBe(200);
    const details = await res.json();
    expect(details).toMatchObject({
      type: "created",
      recipientRole: "owner",
      to: "owner@example.com",
      toName: "Olivia",
      otherName: "Bruno",
      toolName: "Cordless drill",
    });

    // Approve with a note: the approval email details must not include it.
    const [req] = await t.run(async (ctx) => await ctx.db.query("requests").collect());
    await t
      .withIdentity(owner)
      .mutation(api.requests.approve, { requestId: req._id, pickupNote: "Front porch at 6" });
    const approved = (await outboxRows(t)).find((r) => r.type === "approved")!;
    const p2 = `/n8n/notification?eventId=${approved._id}`;
    const res2 = await t.fetch(p2, {
      method: "GET",
      headers: { Authorization: `Bearer ${await n8nToken({ method: "GET", path: p2 })}` },
    });
    expect(JSON.stringify(await res2.json())).not.toContain("porch");
    expect(toolId).toBeDefined();
  });

  it("records the email result idempotently", async () => {
    const { t, eventId } = await createdEvent();
    const path = "/n8n/notification-result";
    const post = async (status: "sent" | "failed") => {
      const body = JSON.stringify({ eventId, status });
      return await t.fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await n8nToken({ method: "POST", path, body })}`,
        },
        body,
      });
    };
    expect((await (await post("sent")).json()).changed).toBe(true);
    expect((await (await post("sent")).json()).changed).toBe(false); // retry: no-op
    expect((await (await post("failed")).json()).changed).toBe(false); // late duplicate cannot undo it
    expect((await outboxRows(t))[0].emailStatus).toBe("sent");
  });
});

describe("daily overdue reminders", () => {
  /** An approved loan that ended yesterday and was never returned. */
  async function overdueLoan() {
    const { t, toolId } = await setup();
    const requestId = await t.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      const ownerRow = users.find((u) => u.email === "owner@example.com")!;
      const borrowerRow = users.find((u) => u.email === "borrower@example.com")!;
      return await ctx.db.insert("requests", {
        toolId,
        ownerId: ownerRow._id,
        borrowerId: borrowerRow._id,
        startDate: plusDays(-5),
        endDate: plusDays(-1),
        status: "approved",
      });
    });
    return { t, requestId };
  }

  const signedPost = async (t: Awaited<ReturnType<typeof setup>>["t"], path: string, data: unknown) => {
    const body = JSON.stringify(data);
    return await t.fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await n8nToken({ method: "POST", path, body })}`,
      },
      body,
    });
  };
  const signedGet = async (t: Awaited<ReturnType<typeof setup>>["t"], path: string) =>
    await t.fetch(path, {
      method: "GET",
      headers: { Authorization: `Bearer ${await n8nToken({ method: "GET", path })}` },
    });

  it("lists overdue loans without email addresses", async () => {
    const { t, requestId } = await overdueLoan();
    const res = await signedGet(t, "/n8n/overdue");
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).toContain(requestId);
    expect(text).not.toContain("@");
  });

  it("lets exactly one claim win per loan per day, and returns the email only to it", async () => {
    const { t, requestId } = await overdueLoan();
    const first = await (await signedPost(t, "/n8n/reminders/claim", { requestId })).json();
    expect(first).toMatchObject({ claimed: true, to: "borrower@example.com", toolName: "Cordless drill" });

    // A retried or duplicated run gets nothing, and no email address.
    const second = await (await signedPost(t, "/n8n/reminders/claim", { requestId })).json();
    expect(second.claimed).toBe(false);
    expect(JSON.stringify(second)).not.toContain("@");

    const rows = await t.run(async (ctx) => await ctx.db.query("reminders").collect());
    expect(rows).toHaveLength(1);
  });

  it("makes the result write-back idempotent and stops re-reminding after success", async () => {
    const { t, requestId } = await overdueLoan();
    const claim = await (await signedPost(t, "/n8n/reminders/claim", { requestId })).json();
    const report = async (status: "sent" | "failed") =>
      await (await signedPost(t, "/n8n/reminders/result", { reminderId: claim.reminderId, status })).json();

    expect((await report("sent")).changed).toBe(true);
    expect((await report("sent")).changed).toBe(false);
    expect((await report("failed")).changed).toBe(false);

    // Done for today: it no longer shows up and cannot be claimed again.
    const overdue = await (await signedGet(t, "/n8n/overdue")).json();
    expect(overdue.loans).toHaveLength(0);
    expect((await (await signedPost(t, "/n8n/reminders/claim", { requestId })).json()).claimed).toBe(false);
  });

  it("allows a failed reminder to be claimed again", async () => {
    const { t, requestId } = await overdueLoan();
    const claim = await (await signedPost(t, "/n8n/reminders/claim", { requestId })).json();
    await signedPost(t, "/n8n/reminders/result", { reminderId: claim.reminderId, status: "failed", error: "smtp down" });
    const again = await (await signedPost(t, "/n8n/reminders/claim", { requestId })).json();
    expect(again.claimed).toBe(true);
    expect(again.reminderId).toBe(claim.reminderId); // same row, no duplicate
  });

  it("refuses to remind about a loan that is not overdue", async () => {
    const { t, toolId } = await setup();
    const requestId = await t
      .withIdentity(borrower)
      .mutation(api.requests.create, { toolId, startDate: plusDays(2), endDate: plusDays(3) });
    const res = await (await signedPost(t, "/n8n/reminders/claim", { requestId })).json();
    expect(res.claimed).toBe(false);
  });
});
