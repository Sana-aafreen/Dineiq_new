import { MenuItem } from "@/lib/data";
import { useCart } from "@/contexts/CartContext";
import { Star, Plus, Minus, Sparkles } from "lucide-react";
import OfflineImage from "./OfflineImage";

interface ComboCardProps {
  item: MenuItem;
  source?: string;
}

export default function ComboCard({ item, source = "Combos" }: ComboCardProps) {
  const { addItem, removeItem, getItemQuantity } = useCart();
  const quantity = getItemQuantity(item.id);
  const savings = item.originalPrice ? item.originalPrice - item.price : 0;

  // Veg/NonVeg Indicator
  const VegBadge = () => (
    <div className={`w-3 h-3 border border-white rounded-[2px] flex items-center justify-center bg-transparent ${item.isVeg ? 'border-green-400' : 'border-red-400'}`}>
      <div className={`w-1 h-1 rounded-full ${item.isVeg ? 'bg-green-400' : 'bg-red-400'}`} />
    </div>
  );

  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-300 w-full flex flex-col h-full">
      {/* Image Header with Overlays */}
      <div className="relative h-[120px] overflow-hidden bg-gray-100 flex-shrink-0">
        <OfflineImage
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-85" />

        {/* Savings badge */}
        {savings > 0 && (
          <div className="absolute top-2.5 left-2.5 z-10 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase tracking-tighter">
            Save KSh {savings}
          </div>
        )}

        {/* AI badge */}
        <div className="absolute top-2.5 right-2.5 z-10 bg-white/90 backdrop-blur-sm text-gray-900 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
          AI PICK
        </div>

        {/* Title, Description and Veg Indicator on Image */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
          <div className="flex items-center gap-1.5 mb-0.5">
            <VegBadge />
            <h3 className="font-black text-white text-[13px] leading-tight line-clamp-1 drop-shadow-sm">
              {item.name}
            </h3>
          </div>
          {item.description && (
            <p className="text-[10px] text-white/70 font-medium leading-tight whitespace-nowrap overflow-x-auto hide-scrollbar drop-shadow-sm ml-4 border-l border-white/20 pl-1.5">
              {item.description}
            </p>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="px-3 py-2.5 flex-1 flex flex-col justify-center">
        <div className="flex items-center justify-between gap-1.5">
          {/* Left: Price & Rating */}
          <div className="flex flex-col min-w-0">
            <span className="text-[14px] font-black text-gray-900 leading-none">
              KSh {item.price}
            </span>
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" strokeWidth={0} />
              <span className="text-[10px] font-bold text-gray-500">{item.rating}</span>
            </div>
          </div>

          {/* Right: Add Button */}
          <div className="w-[80px] shadow-sm rounded-xl bg-white overflow-hidden border border-gray-100 flex-shrink-0">
            {quantity === 0 ? (
              <button
                onClick={() => addItem(item, false, source)}
                className="w-full bg-[#E23744] hover:bg-[#c92c37] text-white font-black text-[10px] h-8 rounded-xl uppercase tracking-wider transition-colors"
              >
                ADD ITEM
              </button>
            ) : (
              <div className="flex items-center justify-between bg-[#E23744] text-white h-8 rounded-xl px-1.5 w-full shadow-inner">
                <button
                  onClick={() => removeItem(item.id, false, source)}
                  className="p-1 hover:bg-white/20 rounded-md transition-colors"
                >
                  <Minus size={12} strokeWidth={3} />
                </button>
                <span className="font-black text-[11px]">{quantity}</span>
                <button
                  onClick={() => addItem(item, false, source)}
                  className="p-1 hover:bg-white/20 rounded-md transition-colors"
                >
                  <Plus size={12} strokeWidth={3} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
