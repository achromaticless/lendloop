/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Every Convex module (including _generated), minus tests and type-only files.
const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

const ISSUER = "https://clerk.test";
const identity = (name: string, email: string, verified = true) => ({
  tokenIdentifier: `${ISSUER}|${name}`,
  subject: name,
  issuer: ISSUER,
  email,
  emailVerified: verified,
});

const ana = identity("ana", "ana.reyes@example.com");
const tomas = identity("tomas", "tomas.lopez@example.com");
const root = identity("root", "root@example.com");

function plusDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

/** A fresh backend with three provisioned users: ana, tomas (users), root (admin). */
async function setup() {
  process.env.ADMIN_EMAILS = "root@example.com";
  const t = convexTest(schema, modules);
  const names = new Map([
    [ana, "Ana Reyes"],
    [tomas, "Tomas L."],
    [root, "Root"],
  ]);
  for (const who of [ana, tomas, root]) {
    const asUser = t.withIdentity(who);
    await asUser.mutation(api.users.ensureCurrent, {});
    await asUser.mutation(api.users.setDisplayName, { name: names.get(who)! });
  }
  return t;
}

const toolArgs = {
  name: "Cordless drill",
  category: "Power tools" as const,
  condition: "Good" as const,
  description: "18V with two batteries.",
};

beforeEach(() => {
  process.env.ADMIN_EMAILS = "root@example.com";
});
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
});

describe("authentication", () => {
  it("rejects signed-out callers on every authenticated function", async () => {
    const t = await setup();
    await expect(t.mutation(api.tools.create, toolArgs)).rejects.toThrow();
    await expect(t.query(api.tools.list, {})).rejects.toThrow();
    await expect(t.query(api.requests.mine, {})).rejects.toThrow();
    await expect(t.query(api.requests.listAll, {})).rejects.toThrow();
  });

  it("refuses to provision a user whose email is not verified", async () => {
    process.env.ADMIN_EMAILS = "sneaky@example.com";
    const t = convexTest(schema, modules);
    const sneaky = identity("sneaky", "sneaky@example.com", false);
    await expect(
      t.withIdentity(sneaky).mutation(api.users.ensureCurrent, {}),
    ).rejects.toThrow();
  });

  it("grants admin only to verified emails listed in ADMIN_EMAILS", async () => {
    const t = await setup();
    expect((await t.withIdentity(root).query(api.users.me, {}))?.role).toBe("admin");
    expect((await t.withIdentity(ana).query(api.users.me, {}))?.role).toBe("user");
  });
});

describe("tools", () => {
  it("public list exposes only name and category", async () => {
    const t = await setup();
    await t.withIdentity(ana).mutation(api.tools.create, toolArgs);
    const publicList = await t.query(api.tools.listPublic, {});
    expect(publicList).toEqual([{ name: "Cordless drill", category: "Power tools" }]);
  });

  it("only the owner can edit a tool", async () => {
    const t = await setup();
    const toolId = await t.withIdentity(ana).mutation(api.tools.create, toolArgs);
    await expect(
      t.withIdentity(tomas).mutation(api.tools.update, { toolId, name: "Hacked" }),
    ).rejects.toThrow();
    // Even an admin cannot edit someone else's listing.
    await expect(
      t.withIdentity(root).mutation(api.tools.update, { toolId, name: "Hacked" }),
    ).rejects.toThrow();
    await t.withIdentity(ana).mutation(api.tools.update, { toolId, name: "Drill 2" });
  });

  it("only the owner or an admin can remove a tool", async () => {
    const t = await setup();
    const toolId = await t.withIdentity(ana).mutation(api.tools.create, toolArgs);
    await expect(
      t.withIdentity(tomas).mutation(api.tools.remove, { toolId }),
    ).rejects.toThrow();
    await t.withIdentity(root).mutation(api.tools.remove, { toolId });
    expect(await t.query(api.tools.listPublic, {})).toEqual([]);
  });

  it("signed-in browse never leaks emails or ids of owners", async () => {
    const t = await setup();
    await t.withIdentity(ana).mutation(api.tools.create, toolArgs);
    const list = await t.withIdentity(tomas).query(api.tools.list, {});
    const text = JSON.stringify(list);
    expect(text).not.toContain("@");
    expect(text).not.toContain("tokenIdentifier");
    expect(list[0].ownerName).toBe("Ana Reyes");
  });
});

describe("display names", () => {
  it("never derives the public name from the email", async () => {
    const t = await setup();
    const newcomer = identity("newbie", "josueusgt@example.com");
    const asNewcomer = t.withIdentity(newcomer);
    await asNewcomer.mutation(api.users.ensureCurrent, {});
    const me = await asNewcomer.query(api.users.me, {});
    expect(me?.needsName).toBe(true);
    expect(me?.name).toBeNull();

    await asNewcomer.mutation(api.tools.create, toolArgs);
    const seenByOthers = await t.withIdentity(ana).query(api.tools.list, {});
    // Provisioned but unnamed: other people only ever see "Neighbor".
    expect(seenByOthers[0].ownerName).toBe("Neighbor");
    expect(JSON.stringify(seenByOthers)).not.toContain("josueusgt");
  });

  it("validates the chosen name", async () => {
    const t = await setup();
    const asAna = t.withIdentity(ana);
    await expect(asAna.mutation(api.users.setDisplayName, { name: "   " })).rejects.toThrow();
    await expect(
      asAna.mutation(api.users.setDisplayName, { name: "ana@example.com" }),
    ).rejects.toThrow();
    await expect(
      asAna.mutation(api.users.setDisplayName, { name: "x".repeat(31) }),
    ).rejects.toThrow();
    await asAna.mutation(api.users.setDisplayName, { name: "  Ana   R. " });
    expect((await asAna.query(api.users.me, {}))?.name).toBe("Ana R.");
  });
});

describe("pick-up notes", () => {
  const dates = { startDate: plusDays(2), endDate: plusDays(4) };
  const note = "Front porch, after 6 pm.";

  async function approvedWithNote() {
    const t = await setup();
    const toolId = await t.withIdentity(ana).mutation(api.tools.create, toolArgs);
    const requestId = await t
      .withIdentity(tomas)
      .mutation(api.requests.create, { toolId, ...dates });
    await t
      .withIdentity(ana)
      .mutation(api.requests.approve, { requestId, pickupNote: note });
    return { t, requestId };
  }

  it("is visible to the owner and the borrower only", async () => {
    const { t } = await approvedWithNote();
    const borrowerView = await t.withIdentity(tomas).query(api.requests.mine, {});
    const ownerView = await t.withIdentity(ana).query(api.requests.incoming, {});
    expect(borrowerView[0].pickupNote).toBe(note);
    expect(ownerView[0].pickupNote).toBe(note);
    // Nobody else can read it: not another user, and not the admin listing.
    expect(await t.withIdentity(root).query(api.requests.mine, {})).toHaveLength(0);
    expect(JSON.stringify(await t.withIdentity(root).query(api.requests.listAll, {}))).not.toContain(note);
  });

  it("disappears once the loan is returned", async () => {
    const { t, requestId } = await approvedWithNote();
    await t.withIdentity(ana).mutation(api.requests.markReturned, { requestId });
    const view = await t.withIdentity(tomas).query(api.requests.mine, {});
    expect(view[0].pickupNote).toBeNull();
  });

  it("is limited in length", async () => {
    const t = await setup();
    const toolId = await t.withIdentity(ana).mutation(api.tools.create, toolArgs);
    const requestId = await t
      .withIdentity(tomas)
      .mutation(api.requests.create, { toolId, ...dates });
    await expect(
      t.withIdentity(ana).mutation(api.requests.approve, { requestId, pickupNote: "x".repeat(281) }),
    ).rejects.toThrow();
  });
});

describe("abuse limits", () => {
  it("caps how many tools one person can list", async () => {
    const t = await setup();
    const asAna = t.withIdentity(ana);
    for (let i = 0; i < 50; i++) await asAna.mutation(api.tools.create, toolArgs);
    await expect(asAna.mutation(api.tools.create, toolArgs)).rejects.toThrow();
  });
});

describe("admin", () => {
  it("regular users cannot use admin functions", async () => {
    const t = await setup();
    const lenders = await t.withIdentity(root).query(api.users.listLenders, {});
    const target = lenders.find((l) => l.name === "Ana Reyes")!;
    await expect(t.withIdentity(ana).query(api.users.listLenders, {})).rejects.toThrow();
    await expect(t.withIdentity(ana).query(api.requests.listAll, {})).rejects.toThrow();
    await expect(
      t.withIdentity(ana).mutation(api.users.setTrusted, { userId: target.userId, trusted: true }),
    ).rejects.toThrow();
    await t
      .withIdentity(root)
      .mutation(api.users.setTrusted, { userId: target.userId, trusted: true });
    expect((await t.withIdentity(ana).query(api.users.me, {}))?.trustedLender).toBe(true);
  });
});

describe("requests", () => {
  async function withTool() {
    const t = await setup();
    const toolId = await t.withIdentity(ana).mutation(api.tools.create, toolArgs);
    return { t, toolId };
  }
  const dates = { startDate: plusDays(2), endDate: plusDays(4) };

  it("blocks borrowing your own tool, past dates and reversed ranges", async () => {
    const { t, toolId } = await withTool();
    await expect(
      t.withIdentity(ana).mutation(api.requests.create, { toolId, ...dates }),
    ).rejects.toThrow();
    const tm = t.withIdentity(tomas);
    await expect(
      tm.mutation(api.requests.create, { toolId, startDate: plusDays(-3), endDate: plusDays(1) }),
    ).rejects.toThrow();
    await expect(
      tm.mutation(api.requests.create, { toolId, startDate: plusDays(5), endDate: plusDays(2) }),
    ).rejects.toThrow();
    await expect(
      tm.mutation(api.requests.create, { toolId, startDate: "2026-13-40", endDate: plusDays(2) }),
    ).rejects.toThrow();
  });

  it("only the tool owner can approve, decline or mark returned", async () => {
    const { t, toolId } = await withTool();
    const requestId = await t
      .withIdentity(tomas)
      .mutation(api.requests.create, { toolId, ...dates });

    // The borrower and an admin are not the owner.
    await expect(
      t.withIdentity(tomas).mutation(api.requests.approve, { requestId }),
    ).rejects.toThrow();
    await expect(
      t.withIdentity(root).mutation(api.requests.approve, { requestId }),
    ).rejects.toThrow();

    await t.withIdentity(ana).mutation(api.requests.approve, { requestId });
    await expect(
      t.withIdentity(tomas).mutation(api.requests.markReturned, { requestId }),
    ).rejects.toThrow();
    await t.withIdentity(ana).mutation(api.requests.markReturned, { requestId });
  });

  it("enforces the state machine", async () => {
    const { t, toolId } = await withTool();
    const requestId = await t
      .withIdentity(tomas)
      .mutation(api.requests.create, { toolId, ...dates });
    // Not approved yet, so it cannot be returned.
    await expect(
      t.withIdentity(ana).mutation(api.requests.markReturned, { requestId }),
    ).rejects.toThrow();
    await t.withIdentity(ana).mutation(api.requests.decline, { requestId });
    // A declined request is final.
    await expect(
      t.withIdentity(ana).mutation(api.requests.approve, { requestId }),
    ).rejects.toThrow();
    await expect(
      t.withIdentity(tomas).mutation(api.requests.cancel, { requestId }),
    ).rejects.toThrow();
  });

  it("only the borrower can cancel, and only while pending", async () => {
    const { t, toolId } = await withTool();
    const requestId = await t
      .withIdentity(tomas)
      .mutation(api.requests.create, { toolId, ...dates });
    await expect(
      t.withIdentity(ana).mutation(api.requests.cancel, { requestId }),
    ).rejects.toThrow();
    await t.withIdentity(tomas).mutation(api.requests.cancel, { requestId });
  });

  it("does not approve two overlapping loans", async () => {
    const { t, toolId } = await withTool();
    const r1 = await t
      .withIdentity(tomas)
      .mutation(api.requests.create, { toolId, ...dates });
    const r2 = await t
      .withIdentity(root)
      .mutation(api.requests.create, { toolId, startDate: plusDays(3), endDate: plusDays(6) });
    await t.withIdentity(ana).mutation(api.requests.approve, { requestId: r1 });
    await expect(
      t.withIdentity(ana).mutation(api.requests.approve, { requestId: r2 }),
    ).rejects.toThrow();
    // And new requests over approved dates are rejected up front.
    await expect(
      t.withIdentity(root).mutation(api.requests.create, { toolId, ...dates }),
    ).rejects.toThrow();
  });

  it("people only see requests they are a party to", async () => {
    const { t, toolId } = await withTool();
    await t.withIdentity(tomas).mutation(api.requests.create, { toolId, ...dates });
    expect(await t.withIdentity(tomas).query(api.requests.mine, {})).toHaveLength(1);
    expect(await t.withIdentity(ana).query(api.requests.incoming, {})).toHaveLength(1);
    expect(await t.withIdentity(root).query(api.requests.mine, {})).toHaveLength(0);
    expect(await t.withIdentity(root).query(api.requests.incoming, {})).toHaveLength(0);
    expect(await t.withIdentity(root).query(api.requests.listAll, {})).toHaveLength(1);
    expect(JSON.stringify(await t.withIdentity(ana).query(api.requests.incoming, {}))).not.toContain("@");
  });

  it("an owner cannot remove a tool that is out on loan", async () => {
    const { t, toolId } = await withTool();
    const requestId = await t
      .withIdentity(tomas)
      .mutation(api.requests.create, { toolId, startDate: plusDays(0), endDate: plusDays(2) });
    await t.withIdentity(ana).mutation(api.requests.approve, { requestId });
    await expect(
      t.withIdentity(ana).mutation(api.tools.remove, { toolId }),
    ).rejects.toThrow();
    await t.withIdentity(root).mutation(api.tools.remove, { toolId });
  });
});
