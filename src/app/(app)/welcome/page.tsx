"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppShell";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/Modal";
import { ToolCover } from "@/components/ui/ToolCover";
import { errorMessage } from "@/lib/errors";

const MAX = 30;

/** First sign-in: pick the only name other people will ever see. */
export default function WelcomePage() {
  const { me } = useApp();
  const setDisplayName = useMutation(api.users.setDisplayName);
  const router = useRouter();
  const [name, setName] = useState(me.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await setDisplayName({ name });
      router.replace("/browse");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-8 py-6">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-5xl leading-[1.02] font-bold tracking-[-0.03em]">
          How should neighbors call you?
        </h1>
        <p className="text-[17px] leading-relaxed text-ink-soft">
          This is the only name other people see. Your email stays private.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <label htmlFor="display-name" className="text-sm font-semibold">
            Display name
          </label>
          <input
            id="display-name"
            required
            autoFocus
            maxLength={MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="For example, Ana R."
            className={inputClass}
          />
          <div className="flex justify-between text-[13px] text-muted">
            <span>A first name or nickname works best.</span>
            <span>
              {name.length}/{MAX}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold">What neighbors will see</span>
          <div className="flex items-center gap-4 rounded-[20px] border border-line bg-surface p-4">
            <ToolCover category="Power tools" size="thumb" className="size-[72px] flex-none rounded-[14px]" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-xl font-bold">Cordless drill</div>
              <div className="text-sm text-muted">Power tools · Good</div>
              <div className="mt-1 text-sm font-semibold">{name.trim() || "Neighbor"}</div>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-medium text-rose-ink">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || !name.trim()} className={buttonClass({ size: "lg" })}>
          {busy ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
