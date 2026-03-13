import { useRef } from "react";
import { MenuItem } from "@/lib/data";
import DishCard from "./DishCard";
import ComboCard from "./ComboCard";
import { Sparkles, ChefHat, UtensilsCrossed, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

interface MenuSectionProps {
  title: string;
  subtitle?: string;
  items: MenuItem[];
  type: "combos" | "chef" | "standard" | "bestseller";
}

const sectionIcons = {
  combos: Sparkles,
  chef: ChefHat,
  bestseller: Flame,
  standard: UtensilsCrossed,
};

const headerStyles = {
  combos: "bg-rose-100",
  chef: "bg-amber-100",
  bestseller: "bg-emerald-100",
  standard: "bg-slate-100",
};

export default function MenuSection({ title, subtitle, items, type }: MenuSectionProps) {
  const { isVegMode } = useUser();
  const scrollRef = useRef<HTMLDivElement>(null);
  const Icon = sectionIcons[type];

  const filteredItems = isVegMode ? items.filter((item) => item.isVeg === true) : items;

  if (filteredItems.length === 0) return null;

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 320; // Approx card width
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const isHorizontal = type === "combos" || type === "chef";

  return (
    <section className="py-5 bg-transparent">
      {/* Header Area with Unique Background */}
      <div className={`mx-4 mb-4 p-4 rounded-2xl flex items-center justify-between ${headerStyles[type]}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${type === "combos" ? "bg-red-600/10" : type === "chef" ? "bg-amber-600/10" : type === "bestseller" ? "bg-emerald-600/10" : "bg-muted"
            }`}>
            <Icon className={`w-5 h-5 ${type === "combos" ? "text-red-600" : type === "chef" ? "text-amber-600" : type === "bestseller" ? "text-emerald-600" : "text-muted-foreground"
              }`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Scroll Arrows for Horizontal Sections */}
        {isHorizontal && (
          <div className="hidden md:flex gap-2">
            <button
              onClick={() => scroll("left")}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-background border shadow-sm hover:bg-muted transition-colors active:scale-95"
              aria-label="Scroll Left"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-background border shadow-sm hover:bg-muted transition-colors active:scale-95"
              aria-label="Scroll Right"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="relative">
        {type === "combos" ? (
          <div
            ref={scrollRef}
            className="flex gap-4 px-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-2 scroll-smooth"
          >
            {filteredItems.map((item) => (
              <ComboCard key={item.id} item={item} source={title} />
            ))}
          </div>
        ) : type === "chef" || type === "bestseller" ? (
          <div
            ref={scrollRef}
            className="flex gap-4 px-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-2 scroll-smooth"
          >
            {filteredItems.map((item) => (
              <div key={item.id} className="flex-shrink-0 w-[340px] md:w-[380px] snap-center">
                <DishCard item={item} source={title} />
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 space-y-3">
            {filteredItems.map((item) => (
              <DishCard key={item.id} item={item} compact source={title} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
