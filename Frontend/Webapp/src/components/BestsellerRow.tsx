import { MenuItem } from "@/lib/data";
import { useCart } from "@/contexts/CartContext";
import { Star, Plus, Minus, TrendingUp } from "lucide-react";
import OfflineImage from "./OfflineImage";

interface BestsellerRowProps {
  item: MenuItem;
  rank: number;
  source?: string;
}

export default function BestsellerRow({ item, rank, source = "Bestsellers" }: BestsellerRowProps) {
  const { addItem, removeItem, getItemQuantity } = useCart();
  const quantity = getItemQuantity(item.id);

  // Veg/NonVeg Indicator
  const VegBadge = () => (
    <div className={`w-3.5 h-3.5 border-[1.5px] rounded-[3px] flex items-center justify-center bg-white ${item.isVeg ? 'border-green-600' : 'border-red-500'}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-500'}`} />
    </div>
  );

  const renderRank = () => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return <span className="text-[12px] font-black text-slate-300">#{rank}</span>;
  };

  return (
    <div className="flex items-center gap-4 bg-white/50 p-3 rounded-2xl border border-white/50 relative overflow-hidden active:scale-[0.98] transition-transform">
      {/* Rank Medal */}
      <div className="w-8 flex-shrink-0 flex items-center justify-center text-xl">
        {renderRank()}
      </div>

      {/* Item Image */}
      <div className="w-[64px] h-[64px] rounded-xl overflow-hidden shadow-sm bg-gray-100 flex-shrink-0">
        <OfflineImage
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <VegBadge />
          <h3 className="font-bold text-slate-800 text-sm line-clamp-1">
            {item.name}
          </h3>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <div className="flex items-center gap-0.5 text-slate-500 text-[10px] font-bold">
            <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" strokeWidth={0} />
            {item.rating}
          </div>
          <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold">
            <TrendingUp className="w-3 h-3" />
            <span>Trending</span>
          </div>
        </div>

        {item.description && (
          <p className="text-[10px] text-gray-400 font-medium whitespace-nowrap overflow-x-auto hide-scrollbar leading-relaxed mb-1">
            {item.description}
          </p>
        )}

        <div className="text-sm font-black text-slate-900">
          KSh {item.price}
        </div>
      </div>

      {/* Add Button */}
      <div className="flex-shrink-0 w-[110px]">
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
  );
}
