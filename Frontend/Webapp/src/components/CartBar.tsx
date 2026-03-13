import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { ChevronRight } from "lucide-react";

export default function CartBar() {
  const navigate = useNavigate();
  const { totalItems, totalPrice } = useCart();

  if (!totalItems) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">

      <div
        onClick={() => navigate("/cart")}
        className="
          bg-[#E23744]
          text-white
          rounded-xl
          shadow-[0_8px_30px_rgba(226,55,68,0.4)]
          px-4 py-3
          flex items-center justify-between
          cursor-pointer
          active:scale-[0.97]
          transition-all duration-150
        "
      >
        {/* Left Section */}
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase opacity-80 border border-white/30 px-2 py-[1px] rounded">
            {totalItems} {totalItems === 1 ? "Item" : "Items"}
          </span>

          <span className="text-lg font-black mt-1">
            KSh {totalPrice}
          </span>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg">
            View Cart
          </span>

          <ChevronRight className="w-5 h-5" strokeWidth={3} />
        </div>
      </div>

    </div>
  );
}