import { Link } from "@tanstack/react-router";
import { Calculator, Check, FilePlus2, FileStack, Users, type LucideIcon } from "lucide-react";

const NAV: { to: "/clients" | "/new-invoice" | "/pricer" | "/invoices"; label: string; icon: LucideIcon }[] = [
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/new-invoice", label: "New invoice", icon: FilePlus2 },
  { to: "/pricer", label: "Pricer", icon: Calculator },
  { to: "/invoices", label: "Invoices", icon: FileStack },
];

function Logo() {
  return (
    <Link to="/new-invoice" className="flex items-center gap-2.5 rounded-md" aria-label="PreFlight home">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Check className="size-[18px]" strokeWidth={3} aria-hidden="true" />
      </span>
      <span className="text-base font-semibold tracking-tight text-foreground">PreFlight</span>
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
