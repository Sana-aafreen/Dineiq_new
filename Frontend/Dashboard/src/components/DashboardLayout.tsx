import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-slate-100/80">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen min-w-0">
          <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b bg-card/95 px-3 py-2 backdrop-blur md:px-4">
            <SidebarTrigger className="h-9 w-9 rounded-xl border border-border bg-background shadow-sm" />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground md:text-lg">DineIQ Admin Dashboard</h2>
              <p className="text-xs text-muted-foreground md:hidden">
                Orders, sync state, and SQLite-backed activity
              </p>
            </div>
          </header>
          <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-3 py-4 md:p-6">
            <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900 md:mb-6">
              <span className="font-semibold">Dashboard visibility:</span>{" "}
              Orders shown here reflect SQLite-backed DineIQ data. In local Wi-Fi mode, new orders should appear here first with
              <span className="font-semibold"> pending_sync</span>, then move to
              <span className="font-semibold"> synced</span> after upstream sync succeeds.
            </div>
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
