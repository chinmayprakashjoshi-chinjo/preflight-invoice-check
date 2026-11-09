import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/AppSidebar";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-screen w-full flex-col desk:flex-row">
      <AppSidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 desk:px-8 desk:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
