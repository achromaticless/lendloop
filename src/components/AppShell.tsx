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
  const [menuOpen, setMenuOpen] = useState(false);
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

  const links: NavItem[] = [
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
      <header
        className="border-b border-line bg-surface"
        onKeyDown={(e) => e.key === "Escape" && setMenuOpen(false)}
      >
        <div className="mx-auto flex min-h-16 w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-10">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-2">
            <Logo href="/browse" />
            {!onWelcome && (
              <nav aria-label="Main" className="hidden flex-wrap gap-1.5 lg:flex">
                {links.map((l) => (
                  <NavLink key={l.label} link={l} />
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            {!onWelcome && (
              <ListToolButton
                className="hidden lg:inline-flex"
                onClick={() => setForm({ open: true, tool: null })}
              />
            )}
            <div className={onWelcome ? "" : "hidden lg:block"}>
              <UserButton />
            </div>
            {!onWelcome && (
              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex size-11 items-center justify-center rounded-full border-[1.5px] border-line bg-surface transition hover:bg-brand-soft lg:hidden"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d={menuOpen ? "M6 6l12 12M18 6 6 18" : "M4 8h16M4 16h16"} />
                </svg>
              </button>
            )}
          </div>
        </div>

        {menuOpen && !onWelcome && (
          <div id="mobile-menu" className="border-t border-line lg:hidden">
            <nav
              aria-label="Main"
              className="mx-auto flex w-full max-w-[1280px] flex-col gap-1.5 px-5 py-4 sm:px-10"
            >
              {links.map((l) => (
                <NavLink key={l.label} link={l} large onNavigate={() => setMenuOpen(false)} />
              ))}
            </nav>
            <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 border-t border-line-soft px-5 py-4 sm:px-10">
              <ListToolButton
                onClick={() => {
                  setMenuOpen(false);
                  setForm({ open: true, tool: null });
                }}
              />
              <div className="flex items-center gap-3">
                <span className="max-w-[10rem] truncate text-[15px] font-medium">{me.name}</span>
                <UserButton />
              </div>
            </div>
          </div>
        )}
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

type NavItem = { href: string; label: string; active: boolean; badge?: number };

function NavLink({
  link,
  large = false,
  onNavigate,
}: {
  link: NavItem;
  large?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={link.active ? "page" : undefined}
      className={`inline-flex items-center gap-2 rounded-full px-4 text-[15px] transition ${
        large ? "min-h-12" : "min-h-11"
      } ${link.active ? "bg-ink font-semibold text-paper" : "font-medium hover:bg-sand"}`}
    >
      {link.label}
      {!!link.badge && (
        <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#e5622b] px-1.5 text-xs font-bold text-ink">
          {link.badge}
        </span>
      )}
    </Link>
  );
}

function ListToolButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={buttonClass({ className })}>
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
  );
}
