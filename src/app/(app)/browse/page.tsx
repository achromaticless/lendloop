"use client";

import { api } from "@convex/_generated/api";
import { CATEGORIES } from "@convex/lib/validators";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/AppShell";
import { RequestDialog, type RequestableTool } from "@/components/dialogs/RequestDialog";
import { buttonClass } from "@/components/ui/button";
import { Pill } from "@/components/ui/Pill";
import { ToolCover } from "@/components/ui/ToolCover";
import { formatDay } from "@/lib/dates";

export default function BrowsePage() {
  const { openToolForm } = useApp();
  const tools = useQuery(api.tools.list, {});
  const [category, setCategory] = useState<string>("All");
  const [requesting, setRequesting] = useState<RequestableTool | null>(null);

  const shown = tools?.filter((t) => category === "All" || t.category === category);
  const countFor = (c: string) =>
    c === "All" ? (tools?.length ?? 0) : (tools?.filter((t) => t.category === c).length ?? 0);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-5xl leading-none font-bold tracking-[-0.03em] sm:text-[56px]">
          Browse tools
        </h1>
        <p className="text-lg text-ink-soft" aria-live="polite">
          {shown === undefined
            ? "Loading tools…"
            : `${shown.length} ${shown.length === 1 ? "tool" : "tools"}${
                category === "All" ? " from your neighbors" : ` in ${category}`
              }`}
        </p>
      </div>

      <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2.5">
        {["All", ...CATEGORIES].map((c) => {
          const on = c === category;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => setCategory(c)}
              className={`min-h-11 rounded-full border-[1.5px] px-[18px] text-[15px] font-semibold transition hover:-translate-y-px active:scale-[0.97] ${
                on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink"
              }`}
            >
              {c} <span className="font-medium opacity-70">{countFor(c)}</span>
            </button>
          );
        })}
      </div>

      {shown === undefined ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-96 animate-pulse rounded-[20px] bg-sand" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-start gap-5 rounded-[20px] border border-line bg-surface p-8">
          <p className="text-lg text-ink-soft">
            {category === "All"
              ? "No one has listed a tool yet. Be the first."
              : `Nothing in ${category} yet.`}
          </p>
          <button type="button" onClick={() => openToolForm()} className={buttonClass()}>
            List a tool
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((tool) => (
            <article
              key={tool._id}
              className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-surface transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,32,26,0.09)]"
            >
              <div className="relative">
                <ToolCover category={tool.category} className="h-44 w-full" />
                <Pill tone={tool.available ? "green" : "amber"} className="absolute top-3 right-3">
                  {tool.available ? "Available" : "Borrowed"}
                </Pill>
              </div>
              <div className="flex flex-1 flex-col gap-5 p-6">
                <div className="flex flex-col gap-1.5">
                  <h2 className="font-display text-2xl font-bold tracking-tight">{tool.name}</h2>
                  <p className="text-[15px] text-muted">
                    {tool.category} · {tool.condition}
                  </p>
                  <p className="text-[15px] leading-snug text-ink-soft">{tool.description}</p>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-line-soft pt-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {tool.isMine ? "You" : tool.ownerName}
                    </span>
                    {tool.ownerTrusted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2 py-0.5 text-xs font-bold text-amber-ink">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m5 12 5 5L20 7" />
                        </svg>
                        Trusted
                      </span>
                    )}
                  </div>
                  {tool.isMine ? (
                    <Link
                      href="/dashboard?tab=listings"
                      className={buttonClass({ variant: "outline", className: "flex-none text-sm" })}
                    >
                      Manage
                    </Link>
                  ) : tool.available ? (
                    <button
                      type="button"
                      onClick={() =>
                        setRequesting({
                          _id: tool._id,
                          name: tool.name,
                          category: tool.category,
                          condition: tool.condition,
                          ownerName: tool.ownerName,
                        })
                      }
                      className={buttonClass({ className: "flex-none text-sm" })}
                    >
                      Request dates
                    </button>
                  ) : (
                    <span className="flex-none text-sm font-medium text-muted">
                      Back {tool.backAt ? formatDay(tool.backAt) : "soon"}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <RequestDialog tool={requesting} onClose={() => setRequesting(null)} />
    </div>
  );
}
