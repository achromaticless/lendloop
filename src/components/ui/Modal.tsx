"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Dialog built on the native <dialog>: focus is trapped, Escape closes it and
 * the page behind is inert. Children are mounted only while open, so forms
 * start fresh every time.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(620px,calc(100vw-32px))] overflow-y-auto rounded-[28px] bg-surface p-0 text-ink shadow-[0_30px_70px_rgba(20,32,26,0.25)] backdrop:bg-ink/55"
    >
      {open && (
        <div className="flex flex-col gap-7 p-6 sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2
                id={titleId}
                className="font-display text-4xl leading-[1.05] font-bold tracking-[-0.03em]"
              >
                {title}
              </h2>
              {subtitle && <p className="text-base text-ink-soft">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex size-11 flex-none items-center justify-center rounded-full border-[1.5px] border-line bg-surface hover:bg-paper"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export const inputClass =
  "min-h-13 w-full rounded-[14px] border-[1.5px] border-line bg-surface px-4 text-base text-ink focus:border-ink";
