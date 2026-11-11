"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

/**
 * A link that adapts to the session: sign-in for visitors, the app for
 * signed-in users. Renders an invisible placeholder while Clerk loads so the
 * layout does not jump.
 */
export function AuthCta({
  signedOut,
  signedIn,
  variant = "primary",
  size = "md",
  withArrow = false,
}: {
  signedOut: string;
  signedIn: string;
  variant?: "primary" | "dark" | "outline";
  size?: "md" | "lg";
  withArrow?: boolean;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const label = isSignedIn ? signedIn : signedOut;
  return (
    <Link
      href={isSignedIn ? "/browse" : "/sign-in"}
      className={buttonClass({ variant, size, className: isLoaded ? "" : "invisible" })}
    >
      {label}
      {withArrow && (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )}
    </Link>
  );
}
