import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  BarChart3,
  UtensilsCrossed,
  Users,
  Heart,
  Brain,
  ShoppingCart,
  Package,
  MessageCircle,
  Megaphone,
  Activity,
  MessageSquare,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Analytics", url: "/", icon: BarChart3 },
  { title: "Menu", url: "/menu", icon: UtensilsCrossed },
  { title: "Customer Auth", url: "/customer-auth", icon: Users },
  { title: "Customer Preferences", url: "/customer-preferences", icon: Heart },
  { title: "Customer Activities", url: "/customer-activities", icon: Activity },
  { title: "Customer Insights", url: "/customer-insights", icon: Brain },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Order Items", url: "/order-items", icon: Package },
  { title: "Chats", url: "/chats", icon: MessageCircle },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone },
  { title: "Customer Reviews", url: "/customer-reviews", icon: MessageSquare },
];

export function AppSidebar() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Sidebar className="border-r border-sidebar-border">
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary shadow-sm">
            <UtensilsCrossed className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-lg font-bold text-sidebar-foreground">DineIQ Admin</span>
            <span className="block text-[11px] font-medium text-sidebar-foreground/60">
              Online + local Wi-Fi operations
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pl-1 text-xs font-medium text-sidebar-foreground/60">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          {format(time, "PPPP | p")}
        </div>
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-2 pb-4">
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:bg-sidebar-primary"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
