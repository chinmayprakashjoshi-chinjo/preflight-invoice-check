import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/AppSidebar";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F4F6FB] text-slate-900 desk:flex-row font-sans">
      <AppSidebar />
      <main className="min-w-0 flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
