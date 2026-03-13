import { MenuItem } from "@/lib/data";
import { useCart } from "@/contexts/CartContext";
import { Star, Plus, Minus, Sparkles } from "lucide-react";

interface ComboCardProps {
  item: MenuItem;
  source?: string;
}

export default function ComboCard({ item, source = "Combos" }: ComboCardProps) {
  const { addItem, removeItem, getItemQuantity } = useCart();
  const quantity = getItemQuantity(item.id);
  const savings = item.originalPrice ? item.originalPrice - item.price : 0;

  return (
    <div className="card-dish flex-shrink-0 w-[85vw] max-w-[300px] md:w-72 snap-center overflow-hidden">
      {/* Image */}
      <div className="relative h-36 -mx-4 -mt-4 mb-3">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover"
        />
        {/* Savings badge */}
        {savings > 0 && (
          <div className="absolute top-3 left-3 gradient-primary text-white text-xs font-bold px-2 py-1 rounded-lg shadow-md">
            Save KSh {savings}
          </div>
        )}
        {/* AI badge */}
        <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm text-foreground text-xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-gold" />
          AI Pick
        </div>
      </div>

      {/* Content */}
      <div className="flex items-start gap-2 mb-1">
        <div className={item.isVeg ? "badge-veg flex-shrink-0 mt-1" : "badge-nonveg flex-shrink-0 mt-1"} />
        <h3 className="font-bold text-foreground text-base leading-tight">{item.name}</h3>
      </div>

      {/* Description (Under name, horizontally scrollable) */}
      {item.description && (
        <div className="overflow-x-auto hide-scrollbar mb-2">
          <p className="text-[11px] text-gray-500 font-medium whitespace-nowrap">
            {item.description}
          </p>
        </div>
      )}

      {/* Combo items */}
      {item.comboItems && item.comboItems.length > 0 && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {item.comboItems.join(" • ")}
        </p>
      )}

      {/* Rating */}
      <div className="flex items-center gap-1 mb-3">
        <div className="flex items-center gap-0.5 bg-veg/10 text-veg px-1.5 py-0.5 rounded text-xs font-semibold">
          <Star className="w-3 h-3 fill-current" />
          {item.rating}
        </div>
        <span className="text-xs text-muted-foreground">({item.ratingCount})</span>
      </div>

      {/* Price + Add */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-foreground">KSh {item.price}</span>
            {item.originalPrice && (
              <span className="text-sm text-muted-foreground line-through">
                KSh {item.originalPrice}
              </span>
            )}
          </div>
          {item.goldPrice && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="badge-gold text-[10px]">GOLD</span>
              <span className="text-xs font-semibold text-gold">KSh {item.goldPrice}</span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col items-center justify-end min-w-[110px]">
          <div className="w-full shadow-sm rounded-xl bg-white overflow-hidden border border-gray-100">
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
