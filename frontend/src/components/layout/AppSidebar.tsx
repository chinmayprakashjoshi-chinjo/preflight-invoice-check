import { Link } from "@tanstack/react-router";
import { resetDemoData } from "@/lib/api";
import {
  Calculator,
  FilePlus2,
  FileStack,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  to: "/app" | "/app/clients" | "/app/new-invoice" | "/app/pricer" | "/app/invoices";
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/clients", label: "Clients", icon: Users },
  { to: "/app/new-invoice", label: "New invoice", icon: FilePlus2 },
  { to: "/app/pricer", label: "Pricer", icon: Calculator },
  { to: "/app/invoices", label: "Invoices", icon: FileStack },
];

function Logo() {
  return (
    <Link
      to="/"
      className="flex cursor-pointer items-center gap-2.5 transition-opacity hover:opacity-90"
      aria-label="PreFlight, go to home page"
    >
      <img src="/brand/preflight-icon.svg" alt="PreFlight" className="size-7 rounded-lg" />
      <span className="text-xl font-bold tracking-tight text-white">PreFlight</span>
    </Link>
  );
}

function SandboxBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      PayPal Sandbox
    </span>
  );
}

const linkBase =
  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150";
const linkInactive = "text-slate-300 hover:bg-white/5 hover:text-white";
const linkActive = "bg-[#4F46E5] text-white font-semibold shadow-xs [&>svg]:text-white";

async function resetDemo() {
  await resetDemoData();
  // A full load clears every screen's local state and cached queries, then lands on the demo case.
  window.location.assign("/app/new-invoice");
}

export function AppSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/5 bg-[#0B0F2A] text-slate-100 desk:flex">
        <div className="flex h-18 items-center px-6">
          <Logo />
        </div>
        <nav aria-label="Main" className="flex-1 px-3.5 py-3">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400/80">
            Workspace
          </p>
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  className={linkBase}
                  activeProps={{ className: linkActive, "aria-current": "page" }}
                  inactiveProps={{ className: linkInactive }}
                >
                  <item.icon className="size-4.5 shrink-0 transition-colors" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-white/5 bg-[#080B1E]/60 p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
            PayPal Sandbox · test mode
          </div>
          <p className="mt-1 text-[11px] text-slate-400">No real money moves.</p>
          <button
            type="button"
            onClick={resetDemo}
            className="mt-3 inline-flex cursor-pointer text-xs font-medium text-slate-400 transition-colors hover:text-indigo-300 hover:underline"
          >
            Reset demo data
          </button>
        </div>
      </aside>

      {/* Compact top bar below 900px */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0F2A]/95 text-white backdrop-blur-md desk:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo />
          <SandboxBadge />
        </div>
        <nav aria-label="Main" className="overflow-x-auto px-2.5 pb-2.5 pt-1">
          <ul className="flex gap-1.5">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  className={`${linkBase} whitespace-nowrap py-1.5 px-3 text-xs`}
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
