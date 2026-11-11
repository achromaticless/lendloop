"use client";

import { UserButton } from "@clerk/nextjs";
import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ToolFormDialog, type EditableTool } from "@/components/dialogs/ToolFormDialog";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { errorMessage } from "@/lib/errors";

type Me = {
  name: string | null;
  needsName: boolean;
  role: "admin" | "user";
  trustedLender: boolean;
};

type AppContextValue = {
  me: Me;
  /** Open the "List a tool" dialog, or the edit dialog when a tool is given. */
  openToolForm: (tool?: EditableTool) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppShell>");
  return ctx;
}

/**
 * Wraps every signed-in page. It provisions the user's row on first visit,
 * sends people without a display name to onboarding, and renders the nav.
 * Convex still checks every call itself; this is only the experience layer.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const ensureCurrent = useMutation(api.users.ensureCurrent);
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const incoming = useQuery(api.requests.incoming, me ? {} : "skip");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [setupError, setSetupError] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; tool: EditableTool | null }>({
    open: false,
    tool: null,
  });
  const started = useRef(false);

  // Create the user row once the Convex session is ready.
  useEffect(() => {
    if (!isAuthenticated || started.current) return;
    started.current = true;
    ensureCurrent({}).catch((err) => setSetupError(errorMessage(err)));
  }, [isAuthenticated, ensureCurrent]);

  // New people choose their display name before anything else.
  const onWelcome = pathname === "/welcome";
  useEffect(() => {
    if (me?.needsName && !onWelcome) router.replace("/welcome");
  }, [me?.needsName, onWelcome, router]);

  if (setupError) {
    return (
      <div className="mx-auto max-w-lg p-10">
        <p role="alert" className="rounded-2xl bg-rose-soft p-6 text-rose-ink">
          {setupError}
        </p>
      </div>
    );
  }

  if (!me || (me.needsName && !onWelcome)) {
    return (
      <div className="flex flex-1 items-center justify-center p-10" aria-busy="true">
        <p className="text-muted">Setting up your account…</p>
      </div>
    );
  }

  const pendingIncoming = incoming?.filter((r) => r.status === "pending").length ?? 0;
  const tab = searchParams.get("tab") ?? "";

  const links: { href: string; label: string; active: boolean; badge?: number }[] = [
    { href: "/browse", label: "Browse", active: pathname === "/browse" },
    {
      href: "/dashboard?tab=listings",
      label: "My listings",
      active: pathname === "/dashboard" && (tab === "listings" || tab === ""),
    },
    {
      href: "/dashboard?tab=requests",
      label: "My requests",
      active: pathname === "/dashboard" && tab === "requests",
    },
    {
      href: "/dashboard?tab=incoming",
      label: "Incoming",
      active: pathname === "/dashboard" && tab === "incoming",
      badge: pendingIncoming,
    },
  ];
  if (me.role === "admin") {
    links.push({ href: "/admin", label: "Admin", active: pathname === "/admin" });
  }

  return (
    <AppContext.Provider
      value={{ me, openToolForm: (tool) => setForm({ open: true, tool: tool ?? null }) }}
    >
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-10">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-2">
            <Logo href="/browse" />
            {!onWelcome && (
              <nav aria-label="Main" className="flex flex-wrap gap-1.5">
                {links.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    aria-current={l.active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] transition ${
                      l.active ? "bg-ink font-semibold text-paper" : "font-medium hover:bg-sand"
                    }`}
                  >
                    {l.label}
                    {!!l.badge && (
                      <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#e5622b] px-1.5 text-xs font-bold text-ink">
                        {l.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            {!onWelcome && (
              <button
                type="button"
                onClick={() => setForm({ open: true, tool: null })}
                className={buttonClass()}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                List a tool
              </button>
            )}
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 py-10 sm:px-10 sm:py-14">
        {children}
      </main>

      <ToolFormDialog
        open={form.open}
        tool={form.tool}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
    </AppContext.Provider>
  );
}
