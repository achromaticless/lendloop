import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

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
