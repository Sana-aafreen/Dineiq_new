import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Menu,
  User,
  ClipboardList,
  MapPin,
  LogOut,
  ChevronRight,
  Phone,
  Crown,
} from "lucide-react";

interface SidebarMenuProps {
  children?: React.ReactNode;
}

export default function SidebarMenu({ children }: SidebarMenuProps) {
  const navigate = useNavigate();
  const { guestName, phoneNumber, tableNumber, logout, orders } = useUser();
  const [open, setOpen] = useState(false);

  const menuItems = [
    {
      icon: User,
      label: "My Profile",
      path: "/profile",
    },
    {
      icon: ClipboardList,
      label: "Order History",
      path: "/orders",
      badge: orders.length > 0 ? String(orders.length) : undefined,
    },
    {
      icon: MapPin,
      label: "Track Order",
      path: "/track-order",
    },
  ];

  const handleNavigation = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/login");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || (
          <button className="w-10 h-10 rounded-full bg-[#E23744] flex items-center justify-center shadow-sm active:scale-95 transition-all">
            <span className="text-white font-black text-lg leading-none">
              {guestName?.charAt(0).toUpperCase() || "G"}
            </span>
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] p-0 bg-card">
        <SheetHeader className="p-0">
          {/* Profile Header */}
          <div className="gradient-primary p-6 pb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="text-left">
                <SheetTitle className="text-white text-lg font-bold">
                  {guestName}
                </SheetTitle>
                <div className="flex items-center gap-1 text-white/80 text-sm">
                  <Phone className="w-3 h-3" />
                  <span>+91 {phoneNumber || "Not set"}</span>
                </div>
              </div>
            </div>
            {/* Gold Member Badge */}
            <div className="mt-4 bg-white/10 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-gold" />
                <span className="text-white font-medium text-sm">Gold Member</span>
              </div>
              <span className="text-gold text-sm font-bold">Table #{tableNumber}</span>
            </div>
          </div>
        </SheetHeader>

        {/* Menu Items */}
        <div className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.path)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-secondary hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
