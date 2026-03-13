import { useUser } from "@/contexts/UserContext";
import { Search, Mic, MapPin, ShoppingBag, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import SidebarMenu from "./SidebarMenu";

interface HomeHeaderProps {
  onSearch?: (query: string) => void;
  searchQuery?: string;
}

export default function HomeHeader({ onSearch, searchQuery = "" }: HomeHeaderProps) {
  // 'tableNumber' को context से निकाला
  const { guestName, isVegMode, toggleVegMode, tableNumber } = useUser();
  const { totalItems } = useCart();
  const navigate = useNavigate();

  return (
    <header className="bg-white sticky top-0 z-40 pb-3 transition-all shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)]">

      {/* Top row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">

          {/* Hamburger Menu */}
          <SidebarMenu />

          <div className="flex flex-col">
            {/* --- LOCATION BADGE (Table vs Dine In) --- */}
            <div className="flex items-center gap-1 text-[10px] font-extrabold text-[#E23744] uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded-full w-fit mb-0.5">
              <MapPin size={10} className="text-[#E23744]" fill="currentColor" />

              {/* Logic: Table Number hai to wo dikhao, nahi to 'DINE IN' */}
              {tableNumber ? `TABLE #${tableNumber}` : "DINE IN"}
            </div>

            <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none">
              Hi, {guestName?.split(" ")[0] || "Guest"} 👋
            </h1>
          </div>
        </div>

        {/* Right Side Actions - Veg Mode Toggle & Review & Cart */}
        <div className="flex items-center gap-2">
          {/* Review Button */}
          <button
            onClick={() => navigate("/review")}
            className="px-3 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            title="You Opinion about us"
          >
            <Star className="w-4 h-4 text-orange-500" fill="currentColor" />
            <span className="text-[10px] font-black text-orange-700 uppercase tracking-tight whitespace-nowrap">Rate Us/Complain</span>
          </button>

          {/* Cart Icon */}
          <button
            onClick={() => navigate("/cart")}
            className="relative w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center transition-all active:scale-95"
            title="View Your Cart"
          >
            <ShoppingBag className="w-5 h-5 text-gray-700" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#E23744] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                {totalItems}
              </span>
            )}
          </button>

          <div className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full flex flex-col items-center justify-center">
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">VEG</span>
            <Switch
              checked={isVegMode}
              onCheckedChange={toggleVegMode}
              className="h-4 w-7 data-[state=checked]:bg-green-600 border-none shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Search row */}
      <div className="px-4">
        <div className="relative shadow-sm group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#E23744]" strokeWidth={2.5} />
          <input
            type="text"
            value={searchQuery}
            placeholder="Search 'Rice', 'Pizza'..."
            onChange={(e) => {
              console.log("⌨️ Input Change:", e.target.value);
              onSearch?.(e.target.value);
            }}
            className="w-full h-[50px] pl-12 pr-12 rounded-xl bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 font-bold focus:outline-none focus:border-[#E23744] focus:ring-1 focus:ring-[#E23744] shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
            <Mic className="w-5 h-5 text-[#E23744]" />
          </button>
        </div>
      </div>
    </header>
  );
}