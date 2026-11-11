"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Modal, inputClass } from "@/components/ui/Modal";
import { ToolCover } from "@/components/ui/ToolCover";
import { addDaysISO, formatRange, todayISO } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";

export type RequestableTool = {
  _id: Id<"tools">;
  name: string;
  category: string;
  condition: string;
  ownerName: string;
};

const MAX_DAYS = 30;

export function RequestDialog({
  tool,
  onClose,
}: {
  tool: RequestableTool | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={tool !== null}
      onClose={onClose}
      title="Request dates"
      subtitle="Pick the days you need it."
    >
      {tool && <RequestForm tool={tool} onClose={onClose} />}
    </Modal>
  );
}

function RequestForm({ tool, onClose }: { tool: RequestableTool; onClose: () => void }) {
  const create = useMutation(api.requests.create);
  const today = todayISO();
  const [start, setStart] = useState(addDaysISO(today, 1));
  const [end, setEnd] = useState(addDaysISO(today, 3));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await create({ toolId: tool._id, startDate: start, endDate: end });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <p role="status" className="rounded-2xl bg-brand-soft p-5 text-base leading-relaxed text-brand-ink">
          Request sent for {formatRange(start, end)}. {tool.ownerName} will get an email, and you will
          hear back by email.
        </p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={buttonClass({ variant: "outline", size: "lg" })}>
            Close
          </button>
          <Link
            href="/dashboard?tab=requests"
            onClick={onClose}
            className={buttonClass({ size: "lg" })}
          >
            View my requests
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-2xl bg-paper p-4">
        <ToolCover category={tool.category} size="thumb" className="h-[60px] w-20 flex-none rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold">{tool.name}</div>
          <div className="text-sm text-muted">
            {tool.category} · {tool.condition} · from {tool.ownerName}
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="req-start" className="text-sm font-semibold">
            From
          </label>
          <input
            id="req-start"
            type="date"
            required
            min={today}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (e.target.value > end) setEnd(e.target.value);
            }}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="req-end" className="text-sm font-semibold">
            Until
          </label>
          <input
            id="req-end"
            type="date"
            required
            min={start}
            max={addDaysISO(start, MAX_DAYS - 1)}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <p className="rounded-2xl border border-line p-4 text-sm leading-relaxed text-ink-soft">
        {formatRange(start, end)}. The owner gets an email and decides. Loans last up to {MAX_DAYS}{" "}
        days.
      </p>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-medium text-rose-ink">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className={buttonClass({ variant: "outline", size: "lg" })}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={buttonClass({ size: "lg" })}>
          {busy ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}
