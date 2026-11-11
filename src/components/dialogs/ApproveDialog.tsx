"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Modal, inputClass } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { ToolCover } from "@/components/ui/ToolCover";
import { formatRange } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";

export type ApprovableRequest = {
  _id: Id<"requests">;
  toolName: string;
  category: string;
  otherPartyName: string; // the borrower
  startDate: string;
  endDate: string;
};

const MAX_NOTE = 280;

export function ApproveDialog({
  request,
  onClose,
}: {
  request: ApprovableRequest | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={request !== null}
      onClose={onClose}
      title="Approve request"
      subtitle={request ? `${request.otherPartyName} asked to borrow your ${request.toolName.toLowerCase()}.` : undefined}
    >
      {request && <ApproveForm request={request} onClose={onClose} />}
    </Modal>
  );
}

function ApproveForm({ request, onClose }: { request: ApprovableRequest; onClose: () => void }) {
  const approve = useMutation(api.requests.approve);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await approve({ requestId: request._id, pickupNote: note });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-2xl bg-paper p-4">
        <ToolCover category={request.category} size="thumb" className="h-[60px] w-20 flex-none rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold">{request.toolName}</div>
          <div className="text-sm text-muted">{formatRange(request.startDate, request.endDate)}</div>
        </div>
        <Pill tone="amber">Pending</Pill>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="pickup-note" className="text-sm font-semibold">
          Pick-up note <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="pickup-note"
          rows={4}
          maxLength={MAX_NOTE}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Front porch, any evening after 6 pm."
          className={`${inputClass} min-h-0 resize-none py-3.5 leading-relaxed`}
        />
        <div className="flex justify-between gap-4 text-[13px] leading-snug text-muted">
          <span>
            Only {request.otherPartyName} sees this, and only because you approved. Share a phone
            number only if you want to.
          </span>
          <span className="whitespace-nowrap">
            {note.length}/{MAX_NOTE}
          </span>
        </div>
      </div>

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
          {busy ? "Approving…" : `Approve and notify ${request.otherPartyName}`}
        </button>
      </div>
    </form>
  );
}
