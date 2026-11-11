import { AuthCta } from "@/components/AuthCta";
import { PublicTools } from "@/components/PublicTools";
import { Logo } from "@/components/ui/Logo";
import { Pill } from "@/components/ui/Pill";
import { ToolCover } from "@/components/ui/ToolCover";

const container = "mx-auto w-full max-w-[1280px] px-5 sm:px-10";

const STEPS = [
  {
    n: "01",
    title: "List what you own",
    body: "Add a tool with its category, condition and a short description. Edit or remove it any time.",
  },
  {
    n: "02",
    title: "Request dates",
    body: "Pick the tool and a date range. The owner approves or declines, and you get an email either way.",
  },
  {
    n: "03",
    title: "Return it",
    body: "The owner marks the loan as returned. If a due date passes, the borrower gets a reminder automatically.",
  },
];

export default function Home() {
  return (
    <>
      <header className="border-b border-line">
        <div className={`${container} flex h-[76px] items-center justify-between gap-4`}>
          <Logo />
          <nav className="flex items-center gap-4 sm:gap-7">
            <a href="#tools" className="hidden text-[15px] font-medium hover:underline sm:inline">
              Available tools
            </a>
            <a href="#how" className="hidden text-[15px] font-medium hover:underline sm:inline">
              How it works
            </a>
            <AuthCta signedOut="Sign in" signedIn="Open the app" variant="dark" />
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section>
          <div
            className={`${container} flex flex-wrap items-center gap-16 pt-14 pb-20 sm:pt-20 sm:pb-24`}
          >
            <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-8">
              <span className="self-start rounded-full bg-sand px-3.5 py-2 text-sm font-semibold">
                Neighborhood tool lending
              </span>
              <h1 className="font-display text-5xl leading-[0.98] font-bold tracking-[-0.035em] sm:text-7xl lg:text-[84px]">
                Borrow what you need. <span className="text-brand">Lend what you don&apos;t.</span>
              </h1>
              <p className="max-w-[520px] text-xl leading-relaxed text-ink-soft">
                List the drill you use twice a year. Borrow the tent you need once. LendLoop keeps
                requests, returns and reminders in one place.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <AuthCta
                  signedOut="Sign in to lend or borrow"
                  signedIn="Go to your board"
                  size="lg"
                  withArrow
                />
                <a href="#tools" className="px-0.5 py-2 text-base font-semibold hover:underline">
                  See what&apos;s available
                </a>
              </div>
              <p className="text-[15px] text-muted">
                Owners approve every request. Email reminders go out automatically.
              </p>
            </div>

            {/* Product frame */}
            <div className="min-w-0 flex-[1_1_480px]" aria-hidden="true">
              <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_30px_60px_rgba(20,32,26,0.10)]">
                <div className="flex h-11 items-center gap-2 border-b border-line-soft bg-[#faf8f2] px-[18px]">
                  <span className="size-2.5 rounded-full bg-line" />
                  <span className="size-2.5 rounded-full bg-line" />
                  <span className="size-2.5 rounded-full bg-line" />
                  <span className="ml-3 text-[13px] text-muted">Incoming requests</span>
                </div>
                <div className="flex flex-col gap-4 p-6">
                  <div className="flex items-center gap-4 rounded-2xl border border-line-soft p-4">
                    <ToolCover category="Power tools" size="thumb" className="size-[52px] rounded-[14px]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[17px] font-semibold">Cordless drill</div>
                      <div className="text-sm text-muted">Nov 14 to Nov 16</div>
                    </div>
                    <Pill tone="amber">Pending</Pill>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brand text-[15px] font-semibold text-white">
                      Approve
                    </span>
                    <span className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-[1.5px] border-ink text-[15px] font-semibold">
                      Decline
                    </span>
                  </div>
                  <div className="h-px bg-line-soft" />
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-10 flex-none items-center justify-center rounded-full bg-ink">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#F4F1E8"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="m3 7 9 6 9-6" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-[15px] font-semibold">Email sent to the borrower</div>
                      <div className="text-sm leading-snug text-muted">
                        Your request for the cordless drill was approved. Pick-up details are in the
                        app.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Available tools */}
        <section id="tools" className="border-y border-line bg-surface">
          <div className={`${container} flex flex-col gap-12 py-20 sm:py-24`}>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="flex max-w-[640px] flex-col gap-4">
                <h2 className="font-display text-4xl leading-[1.02] font-bold tracking-[-0.03em] sm:text-[52px]">
                  Tools your neighbors are ready to lend
                </h2>
                <p className="text-lg leading-relaxed text-ink-soft">
                  Names and categories only. Owner details stay private until you sign in and send a
                  request.
                </p>
              </div>
              <AuthCta signedOut="Sign in to request one" signedIn="Browse all tools" variant="outline" />
            </div>
            <PublicTools />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="bg-ink text-paper">
          <div className={`${container} flex flex-col gap-14 py-20 sm:py-24`}>
            <h2 className="max-w-[720px] font-display text-4xl leading-[1.02] font-bold tracking-[-0.03em] sm:text-[52px]">
              One loop: list it, lend it, get it back
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="flex flex-col gap-3.5 border-t-[1.5px] border-paper pt-6">
                  <div className="font-display text-xl font-bold text-mint">{step.n}</div>
                  <h3 className="font-display text-3xl font-bold tracking-tight">{step.title}</h3>
                  <p className="text-[17px] leading-relaxed text-[#d6d2c4]">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className={`${container} flex flex-wrap items-center justify-between gap-6 py-12`}>
          <Logo />
          <p className="text-[15px] text-muted">Borrow what you need. Lend what you don&apos;t.</p>
        </div>
      </footer>
    </>
  );
}
