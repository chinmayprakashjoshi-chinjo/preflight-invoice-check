import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  AlertOctagon,
  ArrowRight,
  Building2,
  Calculator,
  Check,
  ChevronDown,
  FileCheck2,
  FileSearch,
  ListChecks,
  Receipt,
  ShieldAlert,
  X,
} from "lucide-react";

const pill =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2";
const primaryGradientBtn = `${pill} bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-indigo-400`;
const glassOutlineBtn = `${pill} border border-white/20 bg-white/5 hover:bg-white/10 text-white backdrop-blur-md hover:-translate-y-0.5 transition-all focus-visible:outline-white`;

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-in={shown} className={`lp-reveal ${className}`}>
      {children}
    </div>
  );
}

function Logo({ iconClass = "size-7" }: { iconClass?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/brand/preflight-icon.svg" alt="PreFlight" className={`${iconClass} rounded-lg`} />
      <span className="text-xl font-bold tracking-tight text-white">PreFlight</span>
    </div>
  );
}

function HomeLink({ className = "", children }: { className?: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  return (
    <Link
      to="/"
      aria-label="PreFlight, go to home page"
      className={`cursor-pointer rounded-md transition-opacity hover:opacity-85 ${className}`}
      onClick={(e) => {
        if (pathname === "/") {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }}
    >
      {children}
    </Link>
  );
}

function Navbar() {
  return (
    <header className="sticky top-4 z-50 px-4 pt-2 sm:px-6">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-white/10 bg-slate-950/75 px-4 py-2.5 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl sm:px-6"
      >
        <HomeLink>
          <Logo />
        </HomeLink>
        <div className="flex items-center gap-7">
          <a
            href="#how-it-works"
            className="hidden text-sm font-medium text-slate-300 transition-colors hover:text-white desk:inline"
          >
            How it works
          </a>
          <a
            href="#features"
            className="hidden text-sm font-medium text-slate-300 transition-colors hover:text-white desk:inline"
          >
            Features
          </a>
          <a
            href="#faq"
            className="hidden text-sm font-medium text-slate-300 transition-colors hover:text-white desk:inline"
          >
            FAQ
          </a>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition-all hover:from-indigo-600 hover:to-purple-700 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:scale-[0.98]"
          >
            Try the demo
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </nav>
    </header>
  );
}

function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[540px]" aria-hidden="true">
      {/* Subtle ambient lighting behind card */}
      <div className="absolute -inset-3 rounded-3xl bg-[#8967D2]/15 blur-2xl opacity-75" />

      {/* Main SaaS Interface Card */}
      <div className="relative rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-6 sm:p-7 shadow-2xl shadow-[#8967D2]/15 text-slate-200 font-sans">
        {/* Authentic SaaS App Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/preflight-icon.svg"
              alt="PreFlight"
              className="size-5.5 rounded-md object-contain shrink-0"
            />
            <span className="font-lexend text-sm font-semibold text-white tracking-tight">
              PreFlight Audit
            </span>
            <span className="text-slate-600 font-normal">/</span>
            <span className="font-mono text-xs font-medium text-slate-400">INV-2026-0108</span>
          </div>
        </div>

        {/* Invoice Target Context */}
        <div className="animate-audit-entry mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/[0.04] hover:border-white/20 cursor-default">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-lexend text-base sm:text-lg font-bold text-white tracking-tight">
                Acme Corporation Ltd
              </p>
              <p className="mt-1 text-xs font-normal text-slate-400">
                Enterprise Net 30 · PO Required · USD
              </p>
            </div>
            <div className="text-right">
              <p className="font-lexend text-xs font-medium text-slate-400">Target net in pocket</p>
              <p className="font-lexend mt-0.5 text-xl sm:text-2xl font-bold text-[#ccff00] tabular tracking-tight">
                $1,200.00
              </p>
            </div>
          </div>
        </div>

        {/* Live Pre-flight Checks Stack */}
        <div className="mt-4 space-y-3">
          {/* Issue row (Error: PO missing) */}
          <div className="animate-audit-entry delay-100ms rounded-xl border border-white/10 border-l-4 border-l-red-500 bg-red-500/[0.03] p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-red-500/[0.06] hover:border-white/20 hover:shadow-[0_4px_20px_rgba(239,68,68,0.12)] cursor-default">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <X className="size-5 shrink-0 text-red-400 mt-0.5" />
                <div>
                  <p className="font-lexend text-sm sm:text-base font-semibold text-white tracking-tight">
                    Purchase order number missing
                  </p>
                  <p className="mt-1.5 text-xs sm:text-sm font-normal text-slate-300 leading-relaxed">
                    Client AP policy requires an approved PO reference on invoices over $1,000.
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-none bg-red-500/10 px-2 py-0.5 font-lexend text-[10px] font-bold uppercase tracking-wider text-red-400">
                Action required
              </span>
            </div>
            <div className="mt-3 border-l-2 border-white/15 pl-3 text-xs font-normal text-slate-400 italic">
              &ldquo;Must reference approved PO number on file.&rdquo;
            </div>
          </div>

          {/* Advisory row (Warning: Scope of work description) */}
          <div className="animate-audit-entry delay-200ms rounded-xl border border-white/10 border-l-4 border-l-[#927D84] bg-[#927D84]/[0.04] p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[#927D84]/[0.08] hover:border-white/20 hover:shadow-[0_4px_20px_rgba(146,125,132,0.15)] cursor-default">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertOctagon className="size-5 shrink-0 text-[#bfa8b1] mt-0.5" />
                <div>
                  <p className="font-lexend text-sm sm:text-base font-semibold text-white tracking-tight">
                    Scope of work description
                  </p>
                  <p className="mt-1.5 text-xs sm:text-sm font-normal text-slate-300 leading-relaxed">
                    Provide line-item deliverable breakdown for accounts payable audit trail.
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-none bg-white/5 px-2 py-0.5 font-lexend text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Recommendation
              </span>
            </div>
          </div>

          {/* Verified row (Success: Legal entity and VAT ID matched) */}
          <div className="animate-audit-entry delay-300ms rounded-xl border border-white/10 border-l-4 border-l-[#ccff00] bg-[#ccff00]/[0.03] p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[#ccff00]/[0.06] hover:border-white/20 hover:shadow-[0_4px_20px_rgba(204,255,0,0.12)] cursor-default">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Check className="size-5 shrink-0 text-[#ccff00] mt-0.5" />
                <div>
                  <p className="font-lexend text-sm sm:text-base font-semibold text-white tracking-tight">
                    Legal entity and VAT ID matched
                  </p>
                  <p className="mt-1.5 text-xs sm:text-sm font-normal text-slate-300 leading-relaxed">
                    Matched Acme Corporation Ltd against verified AP registry (US-DE entity).
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-none bg-[#ccff00]/10 px-2 py-0.5 font-lexend text-[10px] font-bold uppercase tracking-wider text-[#ccff00]">
                Verified
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Math Box */}
        <div className="animate-audit-entry delay-400ms mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-all duration-300 ease-out hover:border-white/20 cursor-default">
          <div className="flex items-center justify-between text-xs sm:text-sm font-normal text-slate-400 px-1">
            <span>PayPal Sandbox fee offset</span>
            <span className="font-lexend font-medium text-slate-200 tabular">+$43.91</span>
          </div>
          <div className="mt-3.5 flex items-center justify-between rounded-lg bg-black/40 border border-white/10 p-3 sm:p-3.5">
            <div>
              <p className="font-lexend text-sm sm:text-base font-semibold text-white tracking-tight">
                Invoice amount to dispatch
              </p>
              <p className="mt-0.5 text-xs font-normal text-[#ccff00]/90">
                Guarantees $1,200.00 landed in your bank
              </p>
            </div>
            <span className="font-lexend text-lg sm:text-xl font-bold text-white tabular tracking-tight">
              $1,243.91
            </span>
          </div>
        </div>

        {/* Neo-brutalist High-Impact Action Button */}
        <div className="animate-audit-entry delay-500ms mt-4">
          <button
            type="button"
            className="group flex w-full cursor-pointer items-center justify-between rounded-xl bg-[#8967D2] px-6 py-4 font-lexend text-sm sm:text-base font-semibold text-white shadow-lg transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_4px_15px_rgba(137,103,210,0.4)] hover:brightness-105 active:translate-y-0"
          >
            <span>Send invoice via PayPal Sandbox</span>
            <span className="rounded-md bg-black/25 border border-white/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/95 transition-colors group-hover:bg-black/35 font-lexend">
              Ready on PO fix
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
      {/* Background radial lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden">
        <div className="h-[600px] w-[900px] rounded-full bg-gradient-to-tr from-indigo-600/15 via-purple-600/15 to-pink-600/10 blur-[130px]" />
      </div>

      <div className="mx-auto grid max-w-6xl items-start gap-12 desk:grid-cols-[1.1fr_1fr]">
        <div className="desk:pt-2">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 shadow-inner backdrop-blur-md">
            <span>PayPal AI Hackathon · Live Sandbox Invoicing</span>
          </div>

          <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-6xl sm:leading-[1.08]">
            Check the invoice{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-sky-300 bg-clip-text text-transparent">
              before it goes out.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            PreFlight reads your client&rsquo;s accounts-payable rules, flags what would get your
            invoice rejected with exact document evidence, and sends verified invoices through
            PayPal.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link to="/app" className={primaryGradientBtn}>
              Try the live demo <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className={glassOutlineBtn}>
              See how it works
            </a>
          </div>

          {/* Feature checks under CTA */}
          <div className="mt-10 grid grid-cols-2 gap-3 text-xs font-medium text-slate-300 sm:flex sm:flex-wrap sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <Check className="size-3" />
              </span>
              <span>7 AP rules verified</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
                <Check className="size-3" />
              </span>
              <span>Evidence citation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
                <Check className="size-3" />
              </span>
              <span>PayPal Sandbox invoicing</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
                <Check className="size-3" />
              </span>
              <span>Net-landing guarantee</span>
            </div>
          </div>
        </div>

        <HeroMockup />
      </div>
    </section>
  );
}

const STEPS = [
  {
    step: "01",
    icon: ListChecks,
    title: "Read the client's rules",
    body: "Upload the vendor guide or AP policy PDF. PreFlight extracts legal entities, PO requirements, and accepted currencies with exact citations.",
    link: "Inspect client rules",
    to: "/app/clients",
  },
  {
    step: "02",
    icon: FileSearch,
    title: "Check before sending",
    body: "Draft in one line or edit freely. Missing PO numbers, entity mismatches, and vague deliverables are caught in milliseconds.",
    link: "Run a pre-flight check",
    to: "/app/new-invoice",
  },
  {
    step: "03",
    icon: Calculator,
    title: "Know what you'll net",
    body: "Specify the exact balance you want to receive. PreFlight reverse-calculates PayPal transaction fees and currency spreads automatically.",
    link: "Open fee pricer",
    to: "/app/pricer",
  },
] as const;

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Workflow</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Three steps. Zero surprises.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
            From client onboarding documents to funded PayPal accounts, eliminate the 30-day
            rejection cycle.
          </p>
        </div>

        <div className="mt-12 grid gap-6 desk:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.title}
              className="group relative flex flex-col rounded-2xl border border-white/10 bg-slate-900/60 p-7 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-500/40 hover:shadow-2xl hover:shadow-indigo-500/10"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/10 text-indigo-400 shadow-sm transition-transform duration-200 group-hover:scale-105">
                  <s.icon className="size-6" aria-hidden="true" />
                </span>
                <span className="font-mono text-3xl font-black text-slate-800 transition-colors group-hover:text-indigo-400/30">
                  {s.step}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-bold text-white">{s.title}</h3>
              <p className="mt-2.5 flex-1 text-sm leading-relaxed text-slate-300">{s.body}</p>
              <Link
                to={s.to}
                className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 transition-colors hover:text-indigo-300"
              >
                {s.link} <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Highlight() {
  const chips = [
    { label: "PO number missing", rule: "All invoices must include a valid PO number." },
    {
      label: "Wrong legal entity name",
      rule: "Invoices must be addressed to Acme Corporation Ltd.",
    },
    { label: "Currency not accepted", rule: "We process supplier payments in US Dollars (USD)." },
  ];

  return (
    <section id="features" className="px-4 py-12 sm:px-6">
      <Reveal className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-purple-950/70 p-8 shadow-2xl backdrop-blur-xl sm:p-12">
        <div className="grid items-center gap-10 desk:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300">
              <ShieldAlert className="size-3.5" />
              Pre-Emptive Defenses
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Catch blockers before Accounts Payable does.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
              Every flag is paired with the verbatim quotation from the client&rsquo;s own AP policy
              document. One click corrects the invoice line item or entity mismatch before
              transmission.
            </p>
          </div>

          <div className="space-y-3.5">
            {chips.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 shadow-md backdrop-blur-md transition-all hover:border-indigo-500/40"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-rose-500/20 text-rose-400 font-bold text-xs">
                    <X className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-bold text-white">{c.label}</span>
                </div>
                <p className="mt-2 text-xs italic text-slate-400 pl-7">&ldquo;{c.rule}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

const FAQS = [
  {
    q: "What rules does PreFlight inspect on an invoice?",
    a: "PreFlight checks for mandatory PO numbers, exact registered legal entity names, client-approved currencies, required VAT/tax identification numbers, payment terms matching agreements, and correct AP submission emails.",
  },
  {
    q: "How does PreFlight extract rules from client documents?",
    a: "Our AI extraction pipeline reads PDF vendor guides, contracts, or email threads. It identifies AP requirements and preserves the exact policy quotation so you can verify each rule.",
  },
  {
    q: "How does Net-Landing pricing work?",
    a: "Instead of manually guessing PayPal deduction percentages, you enter the exact dollar or euro amount you want in your account. PreFlight solves the fee equation to calculate the exact invoice amount to issue.",
  },
  {
    q: "Does PreFlight charge real credit cards or bank accounts?",
    a: "No. PreFlight runs entirely in the official PayPal REST API Sandbox environment. Invoices are dispatched to sandbox accounts without real money moving.",
  },
];

function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="px-4 py-20 sm:px-6">
      <Reveal className="mx-auto grid max-w-6xl gap-10 desk:grid-cols-[1fr_1.6fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">FAQ</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Have questions about how PreFlight integrates with PayPal and client AP policies? Here
            are quick answers.
          </p>
        </div>

        <div className="space-y-3.5">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={f.q}
                className="rounded-2xl border border-white/10 bg-slate-900/50 shadow-md backdrop-blur-md transition-colors hover:border-white/20 overflow-hidden"
              >
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-btn-${i}`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4.5 text-left text-sm font-bold text-white cursor-pointer"
                  >
                    <span>{f.q}</span>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-indigo-400 transition-transform">
                      <ChevronDown
                        className={`size-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-white" : ""}`}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                </h3>
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-btn-${i}`}
                  hidden={!isOpen}
                  className="px-6 pb-5 text-xs sm:text-sm leading-relaxed text-slate-300"
                >
                  {f.a}
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}

function Closing() {
  return (
    <section className="px-4 py-8 sm:px-6">
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 px-6 py-16 text-center shadow-2xl sm:px-12">
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <h2 className="relative mx-auto max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">
          See PreFlight catch a bad invoice in 30 seconds.
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-sm text-slate-300">
          Ready to experience frictionless accounts-payable approval and guaranteed net-landing?
        </p>
        <div className="relative mt-8">
          <Link to="/app" className={primaryGradientBtn}>
            Try the demo now <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-white/10 bg-slate-950/80 px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
        <HomeLink>
          <Logo iconClass="size-6" />
        </HomeLink>
        <nav aria-label="Footer" className="flex gap-6 text-xs font-semibold text-slate-400">
          <a href="#how-it-works" className="transition-colors hover:text-white">
            How it works
          </a>
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#faq" className="transition-colors hover:text-white">
            FAQ
          </a>
        </nav>
        <p className="text-xs text-slate-500">Built for the PayPal AI Hackathon (Sandbox Mode).</p>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080B1A] text-slate-100 selection:bg-indigo-500 selection:text-white">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Highlight />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
export default Landing;
