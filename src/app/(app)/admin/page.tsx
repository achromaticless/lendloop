"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { buttonClass } from "@/components/ui/button";
import { Pill, statusPill } from "@/components/ui/Pill";
import { formatRange } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";

export default function AdminPage() {
  const { me } = useApp();

  // Not an admin: don't even ask Convex (it would refuse anyway).
  if (me.role !== "admin") {
    return (
      <div className="flex max-w-xl flex-col items-start gap-5 rounded-[20px] border border-line bg-surface p-8">
        <h1 className="font-display text-3xl font-bold">Admins only</h1>
        <p className="text-ink-soft">This area is only available to administrators.</p>
        <Link href="/browse" className={buttonClass()}>
          Back to browse
        </Link>
      </div>
    );
  }
  return <AdminConsole />;
}

function AdminConsole() {
  const loans = useQuery(api.requests.listAll);
  const lenders = useQuery(api.users.listLenders);
  const tools = useQuery(api.tools.list, {});
  const setTrusted = useMutation(api.users.setTrusted);
  const removeTool = useMutation(api.tools.remove);

  const [removing, setRemoving] = useState<{ id: Id<"tools">; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = loans?.filter((l) => l.status === "approved").length;
  const overdue = loans?.filter((l) => l.overdue).length;
  const trusted = lenders?.filter((l) => l.trustedLender).length;

  const stats = [
    { value: loans?.length, label: "Loans in total", tone: "text-ink" },
    { value: active, label: "Active loans", tone: "text-brand" },
    { value: overdue, label: "Overdue", tone: "text-rose-ink" },
    { value: trusted, label: "Trusted lenders", tone: "text-amber-ink" },
  ];

  async function toggle(userId: Id<"users">, next: boolean) {
    setError(null);
    try {
      await setTrusted({ userId, trusted: next });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-5xl leading-none font-bold tracking-[-0.03em] sm:text-[56px]">
            Admin console
          </h1>
          <span className="rounded-full bg-[#f2b84b] px-3 py-1 text-[13px] font-bold">Admin</span>
        </div>
        <p className="text-lg text-ink-soft">
          Every loan, every listing, every lender. Changes here are checked on the server.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-medium text-rose-ink">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-6">
            <div className={`font-display text-5xl leading-none font-bold tracking-[-0.03em] ${s.tone}`}>
              {s.value ?? "…"}
            </div>
            <div className="text-[15px] text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-5">
        <h2 className="font-display text-4xl font-bold tracking-[-0.02em]">All loans</h2>
        <div className="overflow-x-auto rounded-[20px] border border-line bg-surface">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="border-b border-line text-left text-[13px] font-semibold text-muted">
                {["Tool", "Owner", "Borrower", "Dates", "Status"].map((h) => (
                  <th key={h} scope="col" className="whitespace-nowrap px-5 py-3.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loans === undefined ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-muted">
                    Loading…
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-muted">
                    No loans yet.
                  </td>
                </tr>
              ) : (
                loans.map((l) => {
                  const pill = statusPill(l.status, l.overdue);
                  return (
                    <tr key={l._id} className="border-b border-line-soft last:border-0">
                      <td className="px-5 py-4 font-semibold">{l.toolName}</td>
                      <td className="px-5 py-4">{l.ownerName}</td>
                      <td className="px-5 py-4">{l.borrowerName}</td>
                      <td className="whitespace-nowrap px-5 py-4">{formatRange(l.startDate, l.endDate)}</td>
                      <td className="px-5 py-4">
                        <Pill tone={pill.tone}>{pill.label}</Pill>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid items-start gap-10 lg:grid-cols-2">
        <section className="flex flex-col gap-5">
          <h2 className="font-display text-4xl font-bold tracking-[-0.02em]">Lenders</h2>
          <ul className="rounded-[20px] border border-line bg-surface px-6 py-2">
            {lenders === undefined ? (
              <li className="py-4 text-muted">Loading…</li>
            ) : (
              lenders.map((p) => (
                <li
                  key={p.userId}
                  className="flex items-center gap-4 border-b border-line-soft py-4 last:border-0"
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-sand text-sm font-bold"
                  >
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold">{p.name}</div>
                    <div className="text-sm text-muted">
                      {p.listings} {p.listings === 1 ? "listing" : "listings"}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={p.trustedLender}
                    onClick={() => toggle(p.userId, !p.trustedLender)}
                    className={`inline-flex min-h-11 items-center rounded-full border-[1.5px] px-[18px] text-sm font-semibold transition hover:-translate-y-px active:scale-[0.97] ${
                      p.trustedLender
                        ? "border-[#e0b85a] bg-amber-soft text-amber-ink"
                        : "border-ink bg-surface text-ink"
                    }`}
                  >
                    {p.trustedLender ? "Trusted lender" : "Mark as trusted"}
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="font-display text-4xl font-bold tracking-[-0.02em]">Listings</h2>
          <ul className="rounded-[20px] border border-line bg-surface px-6 py-2">
            {tools === undefined ? (
              <li className="py-4 text-muted">Loading…</li>
            ) : tools.length === 0 ? (
              <li className="py-4 text-muted">No listings yet.</li>
            ) : (
              tools.map((t) => (
                <li
                  key={t._id}
                  className="flex items-center gap-4 border-b border-line-soft py-4 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold">{t.name}</div>
                    <div className="text-sm text-muted">
                      {t.ownerName} · {t.category}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemoving({ id: t._id, name: t.name })}
                    className={buttonClass({ variant: "danger", className: "text-sm" })}
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <ConfirmDialog
        open={removing !== null}
        title="Remove this listing?"
        body={
          removing
            ? `"${removing.name}" will be taken off the board and any open requests for it will be cancelled.`
            : ""
        }
        confirmLabel="Remove listing"
        onConfirm={() => removeTool({ toolId: removing!.id })}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
