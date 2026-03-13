import { MenuItem } from "@/lib/data";
import { useCart } from "@/contexts/CartContext";
import { Star, Plus, Minus, Heart } from "lucide-react";

interface DishCardProps {
  item: MenuItem;
  compact?: boolean;
  source?: string;
}

export default function DishCard({ item, compact = false, source = "Menu" }: DishCardProps) {
  const { addItem, removeItem, getItemQuantity } = useCart();
  const quantity = getItemQuantity(item.id);

  // Veg/NonVeg Indicator (FSSAI style)
  const VegBadge = ({ size = "sm" }: { size?: "sm" | "lg" }) => {
    const sz = size === "sm" ? "w-3.5 h-3.5" : "w-4.5 h-4.5";
    const dotSz = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
    return (
      <div className={`${sz} border-[1.5px] rounded-[3px] flex items-center justify-center bg-white ${item.isVeg ? 'border-green-600' : 'border-red-500'}`}>
        <div className={`${dotSz} rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-500'}`} />
      </div>
    );
  };

  // 1. STANDARD COMPACT LAYOUT (Horizontal List)
  if (compact) {
    return (
      <div id={`menu-item-${item.id}`} className={`flex items-stretch gap-4 bg-white rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-white relative overflow-visible ${compact ? "p-3" : "p-4"}`}>
        {/* Left: Image */}
        <div className="relative flex-shrink-0">
          <div className="w-[80px] h-[80px] md:w-[90px] md:h-[90px] rounded-2xl overflow-hidden shadow-sm bg-gray-100">
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="absolute top-1 right-1 bg-white/90 p-1.5 rounded-full shadow-sm backdrop-blur-[2px] z-10 active:scale-90 transition-transform"
          >
            <Heart size={12} className="text-gray-400" />
          </button>
        </div>

        {/* Middle: Info */}
        <div className="flex-1 min-w-0 flex flex-col py-0.5">
          <div className="flex items-center gap-1.5 mb-1">
            <VegBadge size="sm" />
            {item.isBestseller && (
              <span className="bg-[#FFF4F2] text-[#FF5200] text-[8px] font-extrabold px-1.5 py-0.5 rounded-[4px] tracking-wide uppercase">
                Bestseller
              </span>
            )}
          </div>
          <h3 className="font-black text-gray-800 leading-tight mb-0.5 text-sm line-clamp-1">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-[10px] text-gray-400 font-medium line-clamp-2 leading-relaxed mb-1">
              {item.description}
            </p>
          )}
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-sm font-bold text-gray-900">KSh {item.price}</span>
            {item.originalPrice && (
              <span className="text-[10px] text-gray-400 font-medium line-through">
                KSh {item.originalPrice}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 bg-green-700 text-white px-1 py-[1px] rounded-[3px] text-[10px] font-bold shadow-sm">
              {item.rating} <Star className="w-2 h-2 fill-current" strokeWidth={0} />
            </div>
            <span className="text-[10px] text-gray-500 font-semibold">({item.ratingCount})</span>
          </div>
        </div>

        {/* Right: Add Button (Bottom-Aligned) */}
        <div className="flex-shrink-0 flex flex-col items-center justify-end min-w-[110px] self-stretch pl-2">
          <div className="w-full shadow-md rounded-xl bg-white overflow-hidden mb-1">
            {quantity === 0 ? (
              <button
                onClick={() => addItem(item, false, source)}
                className="w-full bg-[#E23744] hover:bg-[#c92c37] text-white font-black text-[11px] h-10 rounded-xl uppercase tracking-wider transition-colors"
              >
                ADD Item
              </button>
            ) : (
              <div className="flex items-center justify-between bg-[#E23744] text-white h-10 rounded-xl px-2 w-full shadow-inner">
                <button
                  onClick={() => removeItem(item.id, false, source)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Minus size={14} strokeWidth={3} />
                </button>
                <span className="font-black text-sm">{quantity}</span>
                <button
                  onClick={() => addItem(item, false, source)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            )}
          </div>
          {quantity === 0 && (
            <p className="text-[8px] text-gray-400 font-semibold uppercase tracking-tighter text-center">
              customisable
            </p>
          )}
        </div>
      </div>
    );
  }

  // 2. CHEF'S SPECIAL LAYOUT (Vertical Card - DineIQ AI Combo Style)
  return (
    <div className="group relative bg-white rounded-3xl overflow-hidden border border-gray-100 hover:shadow-xl hover:border-orange-100 transition-all duration-300 w-full flex flex-col h-full">
      {/* Image Header with Overlays */}
      <div className="relative h-48 md:h-52 overflow-hidden bg-gray-100 flex-shrink-0">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

        {/* Overlays */}
        <button
          onClick={(e) => { e.stopPropagation(); }}
          className="absolute top-3 left-3 z-10 bg-white/90 p-1.5 rounded-full shadow-lg backdrop-blur-md active:scale-90 transition-transform"
        >
          <Heart size={16} className="text-gray-400" />
        </button>

        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-green-600 text-white text-[11px] font-black px-2 py-1 rounded-lg shadow-lg">
          <Star className="w-3 h-3 fill-white" strokeWidth={0} />
          {item.rating}
        </div>

        <div className="absolute bottom-3 left-3 z-10">
          <span className="text-xl md:text-2xl font-black text-white drop-shadow-md">
            KSh {item.price}
          </span>
          {item.originalPrice && (
            <span className="block text-xs text-white/80 line-through font-medium -mt-1 pl-1">
              KSh {item.originalPrice}
            </span>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <VegBadge size="sm" />
            {item.isBestseller && (
              <span className="bg-yellow-50 text-yellow-700 text-[9px] font-extrabold px-2 py-0.5 rounded-md tracking-wider uppercase">
                Bestseller
              </span>
            )}
          </div>

          <h3 className="font-black text-gray-900 text-lg leading-tight mb-2 line-clamp-1">
            {item.name}
          </h3>

          {item.description && (
            <p className="text-xs text-gray-400 font-medium leading-relaxed line-clamp-2">
              {item.description}
            </p>
          )}
        </div>

        {/* Action Button Row */}
        <div className="mt-4 flex items-center justify-end">
          <div className="w-[110px] shadow-sm rounded-xl bg-white overflow-hidden border border-gray-100">
            {quantity === 0 ? (
              <button
                onClick={() => addItem(item, false, source)}
                className="w-full bg-[#E23744] hover:bg-[#c92c37] text-white font-black text-[11px] h-10 rounded-xl uppercase tracking-wider transition-colors shadow-md"
              >
                ADD Item
              </button>
            ) : (
              <div className="flex items-center justify-between bg-[#E23744] text-white h-10 rounded-xl px-2 w-full shadow-inner">
                <button
                  onClick={() => removeItem(item.id, false, source)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Minus size={14} strokeWidth={3} />
                </button>
                <span className="font-black text-sm">{quantity}</span>
                <button
                  onClick={() => addItem(item, false, source)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}