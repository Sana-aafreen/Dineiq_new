import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 gap-3">
            <SidebarTrigger />
            <h2 className="text-lg font-semibold text-foreground">DineIQ Admin Dashboard</h2>
          </header>
          <div className="flex-1 p-6 overflow-y-auto overflow-x-hidden min-w-0">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
