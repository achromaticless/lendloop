"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  CATEGORIES,
  CONDITIONS,
  type Category,
  type Condition,
} from "@convex/lib/validators";
import { useMutation } from "convex/react";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Modal, inputClass } from "@/components/ui/Modal";
import { errorMessage } from "@/lib/errors";

export type EditableTool = {
  _id: Id<"tools">;
  name: string;
  category: Category;
  condition: Condition;
  description: string;
};

const MAX_DESCRIPTION = 280;

export function ToolFormDialog({
  open,
  tool,
  onClose,
}: {
  open: boolean;
  tool: EditableTool | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tool ? "Edit tool" : "List a tool"}
      subtitle="Neighbors see the name and category. You choose who borrows."
    >
      <ToolForm tool={tool} onDone={onClose} />
    </Modal>
  );
}

function ToolForm({ tool, onDone }: { tool: EditableTool | null; onDone: () => void }) {
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);

  const [name, setName] = useState(tool?.name ?? "");
  const [category, setCategory] = useState<Category>(tool?.category ?? "Power tools");
  const [condition, setCondition] = useState<Condition>(tool?.condition ?? "Good");
  const [description, setDescription] = useState(tool?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (tool) {
        await update({ toolId: tool._id, name, category, condition, description });
      } else {
        await create({ name, category, condition, description });
      }
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="tool-name" className="text-sm font-semibold">
          Name
        </label>
        <input
          id="tool-name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cordless drill"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="tool-category" className="text-sm font-semibold">
          Category
        </label>
        <select
          id="tool-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className={inputClass}
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Condition</legend>
        <div className="flex flex-wrap gap-2.5">
          {CONDITIONS.map((c) => (
            <label
              key={c}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] px-[18px] text-[15px] font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                condition === c
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-surface text-ink hover:border-ink"
              }`}
            >
              <input
                type="radio"
                name="condition"
                value={c}
                checked={condition === c}
                onChange={() => setCondition(c)}
                className="sr-only"
              />
              {c}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="tool-description" className="text-sm font-semibold">
          Short description
        </label>
        <textarea
          id="tool-description"
          required
          rows={3}
          maxLength={MAX_DESCRIPTION}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="18V with two batteries and a bit set."
          className={`${inputClass} min-h-0 resize-none py-3.5 leading-relaxed`}
        />
        <span className="text-[13px] text-muted">
          {description.length}/{MAX_DESCRIPTION}
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-medium text-rose-ink">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className={buttonClass({ variant: "outline", size: "lg" })}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={buttonClass({ size: "lg" })}>
          {busy ? "Saving…" : tool ? "Save changes" : "Publish listing"}
        </button>
      </div>
    </form>
  );
}
