"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { errorMessage } from "@/lib/errors";

/** Asks before a destructive action and shows the server's error if it fails. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <ConfirmBody body={body} confirmLabel={confirmLabel} onConfirm={onConfirm} onClose={onClose} />
    </Modal>
  );
}

function ConfirmBody({
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-base leading-relaxed text-ink-soft">{body}</p>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-medium text-rose-ink">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className={buttonClass({ variant: "outline", size: "lg" })}>
          Cancel
        </button>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className={buttonClass({ size: "lg", className: "!bg-rose-ink" })}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
