import { Link } from "@tanstack/react-router";
import { resetDemoData } from "@/lib/api";
import { Calculator, FilePlus2, FileStack, Users, type LucideIcon } from "lucide-react";

const NAV: {
  to: "/app/clients" | "/app/new-invoice" | "/app/pricer" | "/app/invoices";
  label: string;
  icon: LucideIcon;
}[] = [
  { to: "/app/clients", label: "Clients", icon: Users },
  { to: "/app/new-invoice", label: "New invoice", icon: FilePlus2 },
  { to: "/app/pricer", label: "Pricer", icon: Calculator },
  { to: "/app/invoices", label: "Invoices", icon: FileStack },
];

function Logo() {
  return (
    <Link
      to="/"
      className="flex cursor-pointer items-center rounded-md transition-opacity hover:opacity-85"
      aria-label="PreFlight, go to home page"
    >
      <img src="/brand/preflight-logo.png" alt="PreFlight" className="h-8 w-auto" />
    </Link>
  );
}

function SandboxBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-info-tint px-2.5 py-1 text-xs font-medium text-info-strong">
      <span className="size-1.5 rounded-full bg-info" aria-hidden="true" />
      PayPal Sandbox
    </span>
  );
}

const linkBase =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors";
const linkInactive = "text-muted-foreground hover:bg-muted hover:text-foreground";
const linkActive = "bg-primary-tint text-primary";

async function resetDemo() {
  await resetDemoData();
  // A full load clears every screen's local state and cached queries, then lands on the demo case.
  window.location.assign("/app/new-invoice");
}

export function AppSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar desk:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <nav aria-label="Main" className="flex-1 px-3 py-2">
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={linkBase}
                  activeProps={{ className: linkActive, "aria-current": "page" }}
                  inactiveProps={{ className: linkInactive }}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t px-5 py-4">
          <SandboxBadge />
          <p className="mt-2 text-xs text-muted-foreground">Test mode. No real money moves.</p>
          <button
            type="button"
            onClick={resetDemo}
            className="mt-3 rounded text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Reset demo data
          </button>
        </div>
      </aside>

      {/* Compact top bar below 900px */}
      <header className="sticky top-0 z-30 border-b bg-sidebar desk:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo />
          <SandboxBadge />
        </div>
        <nav aria-label="Main" className="overflow-x-auto px-2 pb-2">
          <ul className="flex gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`${linkBase} whitespace-nowrap py-1.5`}
                  activeProps={{ className: linkActive, "aria-current": "page" }}
                  inactiveProps={{ className: linkInactive }}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
    </>
  );
}
