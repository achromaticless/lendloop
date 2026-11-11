"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Pill } from "@/components/ui/Pill";
import { ToolCover } from "@/components/ui/ToolCover";

/**
 * The public, read-only list. The query it calls returns exactly a name and a
 * category for tools that are available right now, nothing about their owners.
 */
export function PublicTools() {
  const tools = useQuery(api.tools.listPublic);

  if (tools === undefined) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-[20px] bg-sand" />
        ))}
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <p className="rounded-[20px] border border-line bg-paper p-8 text-lg text-ink-soft">
        No tools are available right now. Sign in and be the first to list one.
      </p>
    );
  }

  const shown = tools.slice(0, 8);
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {shown.map((tool, i) => (
        <article
          key={`${tool.name}-${i}`}
          className="overflow-hidden rounded-[20px] border border-line bg-paper transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,32,26,0.09)]"
        >
          <ToolCover category={tool.category} className="h-40 w-full" />
          <div className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-[22px] font-bold tracking-tight">{tool.name}</h3>
              <p className="text-[15px] text-muted">{tool.category}</p>
            </div>
            <Pill tone="green" className="self-start">
              Available
            </Pill>
          </div>
        </article>
      ))}
    </div>
  );
}
