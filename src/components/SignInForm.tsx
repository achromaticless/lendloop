"use client";

import { useSignIn, useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/Modal";

const CODE_LENGTH = 6;
const AFTER_SIGN_IN = "/browse";

type Step = "email" | "code";

function firstMessage(error: unknown, fallback: string): string {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage ?? error.errors[0]?.message ?? fallback;
  }
  return fallback;
}

/**
 * One form for signing in and creating an account. Clerk's `signUpIfMissing`
 * always sends a code, whether or not the account exists (so it never reveals
 * which emails are registered). When the code is verified, existing people are
 * signed in and new people are transferred into a sign-up. No passwords.
 */
export function SignInForm() {
  const { signIn, fetchStatus } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  const busy = fetchStatus === "fetching";
  const code = digits.join("");

  const navigate = ({
    session,
    decorateUrl,
  }: {
    session?: { currentTask?: unknown } | null;
    decorateUrl: (url: string) => string;
  }) => {
    if (session?.currentTask) {
      setMessage("Your account needs an extra step that this app does not support yet.");
      return;
    }
    const url = decorateUrl(AFTER_SIGN_IN);
    if (url.startsWith("http")) window.location.href = url;
    else router.push(url);
  };

  async function start(e: React.SyntheticEvent) {
    e.preventDefault();
    setMessage(null);
    setNotice(null);

    const created = await signIn.create({ identifier: email.trim(), signUpIfMissing: true });
    if (created.error) {
      setMessage(firstMessage(created.error, "We could not start the sign-in. Check the email."));
      return;
    }
    const sent = await signIn.emailCode.sendCode();
    if (sent.error) {
      setMessage(firstMessage(sent.error, "We could not send the code. Try again."));
      return;
    }
    setDigits(Array(CODE_LENGTH).fill(""));
    setStep("code");
    queueMicrotask(() => boxes.current[0]?.focus());
  }

  async function transferToSignUp() {
    const created = await signUp.create({ transfer: true });
    if (created.error) {
      setMessage(firstMessage(created.error, "We could not create your account."));
      return;
    }
    if (signUp.status === "complete") {
      await signUp.finalize({ navigate });
    } else {
      setMessage("We could not finish creating your account. Please try again.");
    }
  }

  async function verify(e: React.SyntheticEvent) {
    e.preventDefault();
    setMessage(null);
    setNotice(null);

    const result = await signIn.emailCode.verifyCode({ code });
    if (result.error) {
      if (
        isClerkAPIResponseError(result.error) &&
        result.error.errors[0]?.code === "sign_up_if_missing_transfer"
      ) {
        await transferToSignUp();
        return;
      }
      setMessage(firstMessage(result.error, "That code did not work. Check it and try again."));
      return;
    }
    if (signIn.status === "complete") {
      await signIn.finalize({ navigate });
    } else {
      setMessage("We could not finish signing you in. Please try again.");
    }
  }

  async function resend() {
    setMessage(null);
    const sent = await signIn.emailCode.sendCode();
    if (sent.error) setMessage(firstMessage(sent.error, "We could not resend the code."));
    else setNotice("A new code is on its way.");
  }

  function startOver() {
    signIn.reset();
    setStep("email");
    setMessage(null);
    setNotice(null);
  }

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((x, i) => (i === index ? "" : x)));
      return;
    }
    // Typing or pasting several digits fills the following boxes.
    setDigits((d) => {
      const next = [...d];
      clean
        .slice(0, CODE_LENGTH - index)
        .split("")
        .forEach((ch, i) => {
          next[index + i] = ch;
        });
      return next;
    });
    const last = Math.min(index + clean.length, CODE_LENGTH - 1);
    boxes.current[last]?.focus();
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="flex w-full max-w-[440px] flex-col gap-7">
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-4xl leading-[1.02] font-bold tracking-[-0.03em] sm:text-[44px]">
            Check your email
          </h2>
          <p className="text-[17px] leading-relaxed text-ink-soft">
            We sent a 6-digit code to <strong className="text-ink">{email.trim()}</strong>. If you
            are new, your account is created when the code is verified.
          </p>
        </div>

        <div className="grid grid-cols-6 gap-2.5" role="group" aria-label="Verification code">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                boxes.current[i] = el;
              }}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
              }}
              onFocus={(e) => e.target.select()}
              className={`h-16 min-w-0 rounded-[14px] border-[1.5px] bg-surface text-center font-display text-3xl font-bold ${
                d ? "border-ink" : "border-line"
              }`}
            />
          ))}
        </div>

        {message && (
          <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-medium text-rose-ink">
            {message}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-ink">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || code.length < CODE_LENGTH}
          className={buttonClass({ size: "lg" })}
        >
          {busy ? "Verifying…" : "Verify and continue"}
        </button>

        <div className="flex flex-wrap justify-between gap-4">
          <button type="button" onClick={resend} disabled={busy} className="min-h-11 text-[15px] font-semibold hover:underline">
            Resend code
          </button>
          <button type="button" onClick={startOver} className="min-h-11 text-[15px] font-semibold hover:underline">
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={start} className="flex w-full max-w-[440px] flex-col gap-7">
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-4xl leading-[1.02] font-bold tracking-[-0.03em] sm:text-[44px]">
          Sign in or create your account
        </h2>
        <p className="text-[17px] leading-relaxed text-ink-soft">
          New here? Your account is created automatically once you verify your email.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="signin-email" className="text-sm font-semibold">
          Email address
        </label>
        <input
          id="signin-email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={`${inputClass} !min-h-14 text-[17px]`}
        />
      </div>

      {message && (
        <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-medium text-rose-ink">
          {message}
        </p>
      )}

      <button type="submit" disabled={busy} className={buttonClass({ size: "lg" })}>
        {busy ? "Sending code…" : "Continue"}
        {!busy && (
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
      </button>

      {/* Required only if Clerk's legacy bot protection is ever enabled. */}
      <div id="clerk-captcha" />
      <p className="text-center text-[13px] text-muted">Secured by Clerk</p>
    </form>
  );
}
