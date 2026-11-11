"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApp } from "@/components/AppShell";
import { ApproveDialog, type ApprovableRequest } from "@/components/dialogs/ApproveDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { LoanRow } from "@/components/LoanRow";
import { buttonClass } from "@/components/ui/button";
import { statusPill } from "@/components/ui/Pill";
import { formatDay, formatRange } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";

type Tab = "listings" | "requests" | "incoming";
const TABS: { id: Tab; label: string; title: string; subtitle: string }[] = [
  { id: "listings", label: "My listings", title: "My listings", subtitle: "Tools you offer to the neighborhood." },
  { id: "requests", label: "My requests", title: "My requests", subtitle: "Tools you have asked to borrow." },
  { id: "incoming", label: "Incoming requests", title: "Incoming requests", subtitle: "Neighbors asking to borrow your tools." },
];

type MyTool = FunctionReturnType<typeof api.tools.mine>[number];
type RequestItem = FunctionReturnType<typeof api.requests.mine>[number];

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = raw === "requests" || raw === "incoming" ? raw : "listings";

  const listings = useQuery(api.tools.mine);
  const requests = useQuery(api.requests.mine);
  const incoming = useQuery(api.requests.incoming);
  const counts: Record<Tab, number | undefined> = {
    listings: listings?.length,
    requests: requests?.length,
    incoming: incoming?.length,
  };
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-5xl leading-none font-bold tracking-[-0.03em] sm:text-[56px]">
          {current.title}
        </h1>
        <p className="text-lg text-ink-soft">{current.subtitle}</p>
      </div>

      <nav
        aria-label="Views"
        className="flex flex-wrap gap-2.5 border-b border-line pb-5"
      >
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <Link
              key={t.id}
              href={`/dashboard?tab=${t.id}`}
              aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-12 items-center rounded-full border-[1.5px] px-[22px] text-base font-semibold transition hover:-translate-y-px ${
                on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink"
              }`}
            >
              {t.label}
              <span className="ml-2 font-medium opacity-70">{counts[t.id] ?? "…"}</span>
            </Link>
          );
        })}
      </nav>

      {tab === "listings" && <Listings tools={listings} />}
      {tab === "requests" && <MyRequests items={requests} />}
      {tab === "incoming" && <Incoming items={incoming} />}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-[20px] bg-sand" />
      ))}
    </div>
  );
}

function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-5 rounded-[20px] border border-line bg-surface p-8">
      <p className="text-lg text-ink-soft">{text}</p>
      {action}
    </div>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-medium text-rose-ink">
      {message}
    </p>
  );
}

// ---- My listings ----

function Listings({ tools }: { tools: MyTool[] | undefined }) {
  const { openToolForm } = useApp();
  const remove = useMutation(api.tools.remove);
  const [deleting, setDeleting] = useState<MyTool | null>(null);

  if (tools === undefined) return <Skeleton />;
  if (tools.length === 0) {
    return (
      <Empty
        text="You have not listed anything yet."
        action={
          <button type="button" onClick={() => openToolForm()} className={buttonClass()}>
            List your first tool
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {tools.map((tool) => (
        <LoanRow
          key={tool._id}
          category={tool.category}
          title={tool.name}
          subtitle={`${tool.category} · ${tool.condition}${
            tool.available ? "" : ` · Out until ${formatDay(tool.backAt)}`
          }`}
          pill={tool.available ? { tone: "green", label: "Available" } : { tone: "sky", label: "On loan" }}
          actions={
            <>
              <button
                type="button"
                onClick={() => openToolForm(tool)}
                className={buttonClass({ variant: "outline" })}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setDeleting(tool)}
                className={buttonClass({ variant: "danger" })}
              >
                Delete
              </button>
            </>
          }
        />
      ))}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this listing?"
        body={
          deleting
            ? `"${deleting.name}" will disappear from the board and its pending requests will be cancelled. Loans already completed stay in the history.`
            : ""
        }
        confirmLabel="Delete listing"
        onConfirm={() => remove({ toolId: deleting!._id })}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

// ---- My requests (as borrower) ----

function MyRequests({ items }: { items: RequestItem[] | undefined }) {
  const cancel = useMutation(api.requests.cancel);
  const [error, setError] = useState<string | null>(null);

  if (items === undefined) return <Skeleton />;
  if (items.length === 0) {
    return (
      <Empty
        text="You have not asked to borrow anything yet."
        action={
          <Link href="/browse" className={buttonClass()}>
            Browse tools
          </Link>
        }
      />
    );
  }

  async function doCancel(requestId: Id<"requests">) {
    setError(null);
    try {
      await cancel({ requestId });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner message={error} />
      {items.map((r) => (
        <LoanRow
          key={r._id}
          category={r.category}
          title={r.toolName}
          subtitle={`From ${r.otherPartyName} · ${formatRange(r.startDate, r.endDate)}`}
          pill={statusPill(r.status, r.overdue)}
          actions={
            r.status === "pending" ? (
              <button
                type="button"
                onClick={() => doCancel(r._id)}
                className={buttonClass({ variant: "outline" })}
              >
                Cancel request
              </button>
            ) : undefined
          }
          note={
            r.pickupNote
              ? { label: `Pick-up note from ${r.otherPartyName}`, text: r.pickupNote }
              : null
          }
        />
      ))}
    </div>
  );
}

// ---- Incoming (as owner) ----

function Incoming({ items }: { items: RequestItem[] | undefined }) {
  const decline = useMutation(api.requests.decline);
  const markReturned = useMutation(api.requests.markReturned);
  const [approving, setApproving] = useState<ApprovableRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (items === undefined) return <Skeleton />;
  if (items.length === 0) {
    return <Empty text="No one has asked to borrow your tools yet." />;
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner message={error} />
      {items.map((r) => (
        <LoanRow
          key={r._id}
          category={r.category}
          title={r.toolName}
          subtitle={`${r.otherPartyName} · ${formatRange(r.startDate, r.endDate)}`}
          pill={statusPill(r.status, r.overdue)}
          actions={
            r.status === "pending" ? (
              <>
                <button
                  type="button"
                  onClick={() => setApproving(r)}
                  className={buttonClass()}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => run(() => decline({ requestId: r._id }))}
                  className={buttonClass({ variant: "outline" })}
                >
                  Decline
                </button>
              </>
            ) : r.status === "approved" ? (
              <button
                type="button"
                onClick={() => run(() => markReturned({ requestId: r._id }))}
                className={buttonClass()}
              >
                Mark returned
              </button>
            ) : undefined
          }
          note={
            r.pickupNote
              ? { label: `Your pick-up note (only ${r.otherPartyName} sees it)`, text: r.pickupNote }
              : null
          }
        />
      ))}
      <ApproveDialog request={approving} onClose={() => setApproving(null)} />
    </div>
  );
}
