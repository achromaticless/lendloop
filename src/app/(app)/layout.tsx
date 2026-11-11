import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

// The whole signed-in area is client-rendered behind a session check, so there
// is no static shell to validate for instant navigation.
export const instant = false;

/** Redirects signed-out visitors to /sign-in before anything renders. */
async function Gate({ children }: { children: React.ReactNode }) {
  await auth.protect();
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-10" aria-busy="true">
          <p className="text-muted">Loading…</p>
        </div>
      }
    >
      <Gate>
        <AppShell>{children}</AppShell>
      </Gate>
    </Suspense>
  );
}
