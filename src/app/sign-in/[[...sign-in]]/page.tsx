import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/components/SignInForm";
import { Logo } from "@/components/ui/Logo";
import { CATEGORY_STYLES } from "@/lib/categories";

const PERKS = [
  "Owners approve every request",
  "Email updates whenever a request changes",
  "Automatic reminders for overdue returns",
];

/**
 * One screen for both signing in and creating an account: Clerk's combined
 * flow sends a one-time code by email and creates the account on first
 * verification. There are no passwords and no social logins.
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-wrap">
      {/* Brand panel */}
      <section className="flex min-w-0 flex-[1_1_480px] flex-col justify-between gap-12 bg-ink px-6 py-10 text-paper sm:px-16 sm:py-14">
        <div className="self-start">
          <Logo tone="dark" />
        </div>
        <div className="flex max-w-[560px] flex-col gap-8">
          <h1 className="font-display text-5xl leading-[0.98] font-bold tracking-[-0.035em] lg:text-[68px]">
            Borrow what you need. <span className="text-mint">Lend what you don&apos;t.</span>
          </h1>
          <div className="flex flex-wrap gap-3" aria-hidden="true">
            {Object.entries(CATEGORY_STYLES)
              .filter(([name]) => name !== "Other")
              .map(([name, s]) => (
                <div
                  key={name}
                  className="flex size-[72px] items-center justify-center rounded-[18px]"
                  style={{
                    background: `radial-gradient(circle at 86% 14%, ${s.soft} 0 26%, transparent 26.5%), radial-gradient(circle at 8% 104%, ${s.soft} 0 24%, transparent 24.5%), ${s.bg}`,
                  }}
                >
                  <svg
                    width="34"
                    height="34"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={s.fg}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={s.icon} />
                  </svg>
                </div>
              ))}
          </div>
        </div>
        <ul className="flex flex-col gap-3.5">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-center gap-3 text-[17px] text-[#d6d2c4]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9FD3B8"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m5 12 5 5L20 7" />
              </svg>
              {perk}
            </li>
          ))}
        </ul>
      </section>

      {/* Form panel */}
      <section className="flex min-w-0 flex-[1_1_480px] flex-col gap-10 px-6 py-10 sm:px-16 sm:py-14">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold hover:underline"
        >
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
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Back to home
        </Link>
        <div className="flex flex-1 items-center justify-center">
          <Suspense>
            <SignInForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
