import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  Calculator,
  Check,
  ChevronDown,
  FileSearch,
  ListChecks,
  Send,
  X,
} from "lucide-react";

const pill =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform focus-visible:outline-2 focus-visible:outline-offset-2";
const mintBtn = `${pill} bg-mint text-mint-foreground shadow-[0_8px_24px_-8px_var(--mint)] hover:-translate-y-0.5 focus-visible:outline-white`;
const outlineBtn = `${pill} border border-white/70 text-white hover:bg-white/10 focus-visible:outline-white`;

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

function Logo({ className = "h-8" }: { className?: string }) {
  return <img src="/brand/preflight-logo.png" alt="" className={`${className} w-auto`} />;
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
    <header className="sticky top-3 z-40 px-4 pt-3 sm:px-6">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center justify-between rounded-full border bg-card px-4 py-2 shadow-sm sm:px-6"
      >
        <HomeLink>
          <Logo className="h-8" />
        </HomeLink>
        <div className="flex items-center gap-6">
          <a
            href="#how-it-works"
            className="hidden rounded text-sm font-medium text-muted-foreground hover:text-foreground desk:inline"
          >
            How it works
          </a>
          <a
            href="#faq"
            className="hidden rounded text-sm font-medium text-muted-foreground hover:text-foreground desk:inline"
          >
            FAQ
          </a>
          <Link
            to="/app/new-invoice"
            className={`${pill} bg-mint py-2 text-mint-foreground hover:-translate-y-0.5 focus-visible:outline-primary`}
          >
            Try the demo
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Collage() {
  return (
    <div
      className="relative mx-auto h-[300px] w-full max-w-[460px] desk:h-[420px]"
      aria-hidden="true"
    >
      <div className="absolute right-4 top-6 size-[260px] rounded-full bg-brand-deep desk:size-[340px]" />
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 460 420"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d="M30 380 C 80 120, 300 40, 440 90"
          stroke="var(--brand-muted)"
          strokeOpacity="0.5"
          strokeWidth="2"
          strokeDasharray="2 10"
          strokeLinecap="round"
        />
      </svg>
      <div
        className="lp-float absolute left-2 top-4 w-[250px] rounded-2xl border border-blocker/30 bg-blocker-tint p-4 shadow-lg desk:left-0 desk:w-[280px]"
        style={{ ["--r" as string]: "-3deg" }}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blocker-strong">
          <X className="size-4" /> Blocker
        </div>
        <p className="mt-1 text-base font-semibold text-foreground">PO number missing</p>
      </div>
      <div
        className="lp-float absolute right-0 top-[42%] w-[240px] rounded-2xl border border-warning/30 bg-warning-tint p-4 shadow-lg desk:w-[270px]"
        style={{ ["--r" as string]: "2deg", animationDelay: "-2s" }}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-warning-strong">
          <FileSearch className="size-4" /> Warning
        </div>
        <p className="mt-1 text-base font-semibold text-foreground">Description is vague</p>
      </div>
      <div
        className="lp-float absolute bottom-2 left-6 flex items-center gap-2 rounded-full bg-card px-5 py-3 shadow-lg"
        style={{ ["--r" as string]: "-1deg", animationDelay: "-4s" }}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-pass-tint text-pass-strong">
          <Check className="size-4" />
        </span>
        <span className="text-sm font-semibold text-foreground">Cleared for send</span>
        <Send className="size-4 text-primary" />
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="px-4 pt-4 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-[32px] bg-primary px-6 py-12 sm:px-12 desk:grid-cols-[1.1fr_1fr] desk:py-16">
        <div>
          <p className="inline-block rounded-full bg-brand-deep px-3 py-1 text-xs font-semibold text-brand-muted">
            Runs in PayPal Sandbox
          </p>
          <h1 className="mt-5 text-[36px] font-extrabold leading-[1.05] tracking-tight text-white desk:text-[60px]">
            Check the invoice before you send it.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-brand-muted desk:text-lg">
            PreFlight reads your client's AP rules, flags what would get your invoice rejected, then
            sends it through PayPal.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app/new-invoice" className={mintBtn}>
              Try the demo <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className={outlineBtn}>
              See how it works
            </a>
          </div>
          <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-brand-muted">
            Upload client rules <ArrowRight className="size-3.5" aria-hidden="true" /> Pre-flight
            check <ArrowRight className="size-3.5" aria-hidden="true" /> Send via PayPal
          </p>
        </div>
        <Collage />
      </div>
    </section>
  );
}

const STEPS = [
  {
    icon: ListChecks,
    title: "Read the client's rules",
    body: "Drop in their AP guide and PreFlight lists every requirement with the exact quote.",
    link: "See client rules",
    to: "/app/clients",
  },
  {
    icon: FileSearch,
    title: "Check before sending",
    body: "Describe the invoice in one line. Missing PO or wrong entity name? You'll know now, not in 30 days.",
    link: "Try a pre-flight",
    to: "/app/new-invoice",
  },
  {
    icon: Calculator,
    title: "Know what you'll net",
    body: "Enter what you want to receive and get the amount to invoice after PayPal fees.",
    link: "Open the pricer",
    to: "/app/pricer",
  },
] as const;

function HowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-16 sm:px-6">
      <Reveal className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground desk:text-4xl">
          Three steps. No surprises.
        </h2>
        <div className="mt-8 grid gap-5 desk:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.title}
              className="lp-lift flex flex-col rounded-[20px] border bg-card p-6 shadow-sm transition-transform hover:-translate-y-1"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-tint text-primary">
                <s.icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-foreground">{s.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              <Link
                to={s.to}
                className="mt-5 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary hover:underline"
              >
                {s.link} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Highlight() {
  const chips = ["PO number missing", "Wrong legal entity name", "Currency not accepted"];
  return (
    <section className="px-4 sm:px-6">
      <Reveal className="mx-auto grid max-w-6xl items-center gap-8 rounded-[32px] bg-primary px-6 py-10 sm:px-12 desk:min-h-[320px] desk:grid-cols-2">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white desk:text-4xl">
            Catch it before accounts payable does.
          </h2>
          <p className="mt-4 text-base text-brand-muted">
            Every flag comes with the quote from the client's own document, so you can see why.
          </p>
        </div>
        <div className="space-y-3 rounded-[28px] bg-brand-deep p-6">
          {chips.map((c) => (
            <div
              key={c}
              className="flex items-center gap-3 rounded-full bg-card px-4 py-3 text-sm font-semibold text-foreground"
            >
              <X className="size-4 shrink-0 text-blocker" aria-hidden="true" /> {c}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

const FAQS = [
  {
    q: "What does PreFlight check?",
    a: "PO number, exact legal entity name, accepted currencies, VAT or tax ID, payment terms and the AP email address.",
  },
  {
    q: "How does it read my client's rules?",
    a: "AI reads the AP guide or email and lists each rule with the exact quote it came from. You can edit anything it gets wrong.",
  },
  {
    q: "Is the net amount calculated by AI?",
    a: "No. The pricing math is a fixed formula in code, so the numbers are exact. AI is only used to read documents and explain.",
  },
  {
    q: "Does it move real money?",
    a: "No. It runs in PayPal Sandbox, so nothing real is charged.",
  },
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="px-4 py-16 sm:px-6">
      <Reveal className="mx-auto grid max-w-6xl gap-8 desk:grid-cols-[1fr_1.6fr]">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground desk:text-4xl">
          Quick answers
        </h2>
        <div className="space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="rounded-[20px] border bg-card shadow-sm">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-btn-${i}`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="flex w-full items-center justify-between gap-4 rounded-[20px] px-5 py-4 text-left text-base font-semibold text-foreground"
                  >
                    {f.q}
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                      <ChevronDown
                        className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
                  className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground"
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
    <section className="px-4 sm:px-6">
      <Reveal className="mx-auto max-w-6xl rounded-[32px] bg-primary px-6 py-14 text-center sm:px-12">
        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white desk:text-4xl">
          See it catch a bad invoice in 30 seconds.
        </h2>
        <Link to="/app/new-invoice" className={`${mintBtn} mt-8`}>
          Try the demo
        </Link>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-4 pb-10 pt-6 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 rounded-[32px] bg-primary px-6 py-5 sm:px-10">
        {/* No white logo file supplied: the dark-text logo sits in a white pill on indigo. */}
        <HomeLink className="rounded-full bg-white px-4 py-2">
          <Logo className="h-7" />
        </HomeLink>
        <nav aria-label="Footer" className="flex gap-6 text-sm font-medium text-brand-muted">
          <a href="#how-it-works" className="rounded hover:text-white">
            How it works
          </a>
          <a href="#faq" className="rounded hover:text-white">
            FAQ
          </a>
        </nav>
        <p className="text-sm text-brand-muted">Built for the PayPal AI Hackathon.</p>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
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
