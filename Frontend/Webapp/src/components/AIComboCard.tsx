import { useCart } from "@/contexts/CartContext";
import { Plus, Minus, Sparkles, Star, TrendingUp } from "lucide-react";

interface ComboItem {
    name: string;
    quantity: number;
    price: number;
    category?: string;
}

interface Combo {
    Item_ID: string;
    Item_Name: string;
    name?: string;
    Item_Description: string;
    description?: string;
    Items?: ComboItem[];
    items?: ComboItem[];
    Combo_Items?: ComboItem[];
    Current_Price: number;
    price?: number;
    Original_Price: number;
    Discount_Percent: number;
    Savings: number;
    Is_Veg?: boolean;
    isVeg?: boolean;
    Is_Personalized?: boolean;
    Insight?: string;
    Image_URL?: string;
    personalization_score?: number;
}

interface ComboCardProps {
    combo: Combo;
}

export default function AIComboCard({ combo }: ComboCardProps) {
    const { addItem, removeItem, getItemQuantity } = useCart();

    const price = combo.Current_Price || combo.price || 0;
    const originalPrice = combo.Original_Price || price;

    const cartItem: any = {
        id: combo.Item_ID,
        name: combo.Item_Name || combo.name || 'AI Combo',
        price: price,
        originalPrice: originalPrice,
        image: combo.Image_URL || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
        description: combo.Item_Description || combo.description || '',
        isVeg: combo.Is_Veg !== undefined ? combo.Is_Veg : (combo.isVeg !== undefined ? combo.isVeg : true),
        category: "Combos",
        isCombo: true,
        // We avoid putting comboItems list here if we want it to be treated as a SINGLE item in CartContext.
        // However, if we WANT deconstruction, we provide it.
        // For AI Combos, let's keep it as a bundle by NOT providing the string array of names in the format CartContext expects for deconstruction.
        rating: 4.8,
        ratingCount: 85
    };

    const quantity = getItemQuantity(combo.Item_ID);

    return (
        <div className="bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl border border-gray-100 flex-shrink-0 w-[340px] md:w-[380px] snap-center group">
            {/* Image Section */}
            <div className="relative h-48 overflow-hidden bg-gray-100">
                <img
                    src={cartItem.image}
                    alt={cartItem.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Badges */}
                <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-10">
                    {/* Savings Badge */}
                    {combo.Savings > 0 && (
                        <div className="bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            <span>SAVE KSh {combo.Savings}</span>
                        </div>
                    )}

                    {/* AI Pick Badge */}
                    <div className="bg-orange-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 fill-current" />
                        <span>AI Pick</span>
                    </div>
                </div>

                {/* Veg Badge */}
                <div className="absolute bottom-3 left-3 z-20">
                    <div className={`w-5 h-5 border-[2px] rounded-sm flex items-center justify-center p-[2px] bg-white ${(cartItem.isVeg) ? 'border-green-600' : 'border-red-500'}`}>
                        <div className={`w-full h-full rounded-full ${(cartItem.isVeg) ? 'bg-green-600' : 'bg-red-500'}`} />
                    </div>
                </div>

                {/* Match Score */}
                {combo.personalization_score && (
                    <div className="absolute bottom-3 left-10 z-10">
                        <div className="bg-green-600 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full shadow-lg">
                            {combo.personalization_score}% Match
                        </div>
                    </div>
                )}

                {/* Rating */}
                <div className="absolute bottom-3 right-3 z-10">
                    <div className="bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-bold px-2 py-1 rounded-full shadow flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span>4.8</span>
                    </div>
                </div>

                {/* Dark Gradient Overlay for text legibility if needed */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 pointer-events-none" />
            </div>

            {/* Content Section */}
            <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-900 text-base leading-tight line-clamp-1 flex-1">
                        {cartItem.name}
                    </h3>
                </div>

                {/* Description - Items list */}
                <p className="text-xs text-gray-500 mb-3 line-clamp-2 h-8">
                    {cartItem.description}
                </p>

                {/* AI Insight */}
                {combo.Insight && (
                    <div className="mb-4 p-3 bg-orange-50 rounded-xl border border-orange-100 italic">
                        <div className="flex items-start gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-orange-600 mt-0.5 flex-shrink-0" />
                            <p className="text-[11px] text-orange-800 leading-normal">
                                {combo.Insight}
                            </p>
                        </div>
                    </div>
                )}

                {/* Price & Action */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <div className="flex flex-col">
                        {originalPrice > price && (
                            <span className="text-[10px] text-gray-400 line-through">KSh {originalPrice}</span>
                        )}
                        <span className="text-lg font-bold text-gray-900">KSh {price}</span>
                    </div>

                    {/* Action Button Row */}
                    <div className="flex items-center justify-end">
                        <div className="w-[110px] shadow-sm rounded-xl bg-white overflow-hidden border border-gray-100">
                            {quantity === 0 ? (
                                <button
                                    onClick={() => addItem(cartItem, false, "AI Combos")}
                                    className="w-full bg-[#E23744] hover:bg-[#c92c37] text-white font-black text-[11px] h-10 rounded-xl uppercase tracking-wider transition-colors shadow-md"
                                >
                                    ADD Item
                                </button>
                            ) : (
                                <div className="flex items-center justify-between bg-[#E23744] text-white h-10 rounded-xl px-2 w-full shadow-inner">
                                    <button
                                        onClick={() => removeItem(cartItem.id, false, "AI Combos")}
                                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                    >
                                        <Minus size={14} strokeWidth={3} />
                                    </button>
                                    <span className="font-black text-sm text-white">{quantity}</span>
                                    <button
                                        onClick={() => addItem(cartItem, false, "AI Combos")}
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
        </div>
    );
}
