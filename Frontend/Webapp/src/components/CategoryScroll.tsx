import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { categories, Category } from "@/lib/data";

interface CategoryScrollProps {
  categories?: Category[];
  onSelect: (category: string) => void;
  selectedCategory?: string;
}

export default function CategoryScroll({ categories: dynamicCategories, onSelect, selectedCategory }: CategoryScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use dynamic categories if provided and not empty, otherwise fall back to hardcoded
  const categoriesToDisplay = dynamicCategories && dynamicCategories.length > 0 ? dynamicCategories : categories;

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 260; // Card width (240) + gap (approx)
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="py-5 bg-transparent">
      {/* Header Area with Unique Background */}
      <div className="mx-4 mb-4 p-4 rounded-2xl flex items-center justify-between bg-orange-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-600/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-orange-600"
            >
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
              <path d="M7 2v20" />
              <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">What's on your mind?</h2>
            <p className="text-sm text-muted-foreground">Explore our diverse menu categories</p>
          </div>
        </div>

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
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 px-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-2 scroll-smooth"
      >
        {categoriesToDisplay.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelect(category.name)}
            className="flex-shrink-0 w-[70vw] max-w-[220px] md:w-[240px] snap-center text-left group transition-transform active:scale-95"
          >
            <div className={`flex items-center gap-3 bg-white rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-white p-3 h-full relative overflow-visible transition-all ${selectedCategory === category.name ? 'ring-1 ring-orange-500 shadow-md' : 'hover:shadow-md'}`}>

              {/* Left: Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-extrabold text-gray-800 text-[16px] leading-tight group-hover:text-orange-600 transition-colors">
                  {category.name}
                </h3>
                <p className="text-[10px] text-gray-400 font-medium mt-1 line-clamp-1">
                  {category.tagline || 'View Options'}
                </p>
              </div>

              {/* Right: Image */}
              <div className="relative flex-shrink-0">
                <div className="w-[70px] h-[70px] rounded-2xl overflow-hidden shadow-sm bg-gray-100">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
