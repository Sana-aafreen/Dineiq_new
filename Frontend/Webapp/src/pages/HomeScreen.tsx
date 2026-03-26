import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import HomeHeader from "@/components/HomeHeader";
import HeroBanner from "@/components/HeroBanner";
import OfferCarousel from "@/components/OfferCarousel";
import CategoryScroll from "@/components/CategoryScroll";
import MenuSection from "@/components/MenuSection";
import CartBar from "@/components/CartBar";
import AIButton from "@/components/AIButton";
import { saveLog } from "@/utils/logger";
import { offlineApi as api } from "@/utils/offlineApi";
import { getOfflineMediaCoverage } from "@/lib/offlineOrderStore";
import { MenuItem, Category } from "@/lib/data";
import { extractDynamicCategories, getMenuItemImage } from "@/lib/categoryUtils";
import { Ticket, Percent, Gift, Sparkles, RefreshCw, Bell, UtensilsCrossed, Clock, ShoppingBag, Receipt } from "lucide-react";
import AIComboCard from "@/components/AIComboCard";

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   DESIGN TOKENS
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const Z = {
  red: "#E23744",
  redDark: "#C0303C",
  redLight: "#FFF1F2",
  redMid: "#FDDCDE",
  amber: "#F59E0B",
  dark: "#1C1C1C",
  charcoal: "#3D3D3D",
  mid: "#696969",
  muted: "#9E9E9E",
  line: "#EFEFEF",
  lineLight: "#F7F7F7",
  surface: "#F8F8F8",
  white: "#FFFFFF",
  green: "#1BA672",
  greenBg: "#EBF9F4",
  blue: "#3B82F6",
  blueBg: "#EFF6FF",
  purple: "#8B5CF6",
};


// Flag for AI vs Smart Combos
const GENERATE_AI_COMBOS = true;

export default function HomeScreen() {
  const navigate = useNavigate();
  const { isLoggedIn, user, tableNumber: ctxTable, setFullMenu } = useUser();

  const [offers, setOffers] = useState([]);
  const [combos, setCombos] = useState<MenuItem[]>([]);
  const [chefSpecials, setChefSpecials] = useState<MenuItem[]>([]);
  const [bestsellers, setBestsellers] = useState<MenuItem[]>([]);
  const [curatedItems, setCuratedItems] = useState<MenuItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<Category[]>([]);
  const [aiCombos, setAiCombos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [showBill, setShowBill] = useState(false);
  const [showWaiterMsg, setShowWaiterMsg] = useState(false);
  const [offlineMediaStatus, setOfflineMediaStatus] = useState<string | null>(null);
  const [offlineMediaReady, setOfflineMediaReady] = useState(false);

  const tableNo = ctxTable || localStorage.getItem("dineiq_table_number") || "1";
  const userName = user?.name || "Guest";

  // Coupon codes data
  const coupons = [
    {
      code: "DINE50",
      title: "Flat KSh 50 OFF",
      subtitle: "On orders above KSh 299",
      icon: Ticket,
      color: "from-orange-500 to-red-500"
    },
    {
      code: "COMBO30",
      title: "30% OFF",
      subtitle: "On all combo meals",
      icon: Percent,
      color: "from-green-500 to-emerald-500"
    },
    {
      code: "FIRST100",
      title: "KSh 100 OFF",
      subtitle: "First order bonus",
      icon: Gift,
      color: "from-purple-500 to-pink-500"
    }
  ];

  const updateOfflineMediaStatus = useCallback(async (menuData: any, offersData: any) => {
    const mediaUrls = new Set<string>();

    Object.values(menuData?.menu_sections || {}).forEach((items: any) => {
      if (!Array.isArray(items)) return;
      items.forEach((item: any) => {
        const imageUrl = item?.Image_URL || item?.image;
        if (imageUrl) mediaUrls.add(String(imageUrl));
      });
    });

    if (Array.isArray(offersData?.offers)) {
      offersData.offers.forEach((offer: any) => {
        if (offer?.image) mediaUrls.add(String(offer.image));
      });
    }

    const { cached, total } = await getOfflineMediaCoverage(Array.from(mediaUrls));

    if (total === 0) {
      setOfflineMediaStatus(null);
      setOfflineMediaReady(false);
      return;
    }

    setOfflineMediaReady(cached >= total);
    setOfflineMediaStatus(
      cached >= total
        ? `Offline media cached ${cached}/${total}`
        : `Caching offline media ${cached}/${total}`
    );
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login");
    } else {
      const userEmail = user?.email || "guest@dineiq.com";
      // saveLog(userEmail, "PAGE_VIEW", "User landed on Home Screen"); // Removed as per request

      const loadData = async () => {
        setIsLoading(true);

        try {
          // 1. Fetch Offers
          const offersData = await api.fetchOffers();
          if (offersData?.offers) setOffers(offersData.offers);

          // 2. Fetch Menu
          const menuData = await api.fetchMenu(userEmail);

          if (menuData?.status === "success" && menuData?.menu_sections) {
            const sections = menuData.menu_sections;
            const allItems: MenuItem[] = [];
            let chefTemp: MenuItem[] = [];
            let bestTemp: MenuItem[] = [];
            let curatedTemp: MenuItem[] = [];

            // Map backend items to frontend format
            const mapToMenuItem = (item: any, category: string): MenuItem => {
              return {
                id: String(item.Item_ID || item.id || ''),
                name: item.Item_Name || item.name || 'Unknown Item',
                description: item.Item_Description || item.description || '',
                price: parseFloat(String(item.Current_Price || item.price || 0).replace(/,/g, "")),
                category: item.Item_Category || category || 'Other',
                image: item.Image_URL || item.image || getMenuItemImage(item),
                isVeg: String(item.Is_Veg || item.isVeg).toLowerCase() === 'true',
                rating: 4.5,
                ratingCount: 10,
              };
            };

            // Process sections
            Object.entries(sections).forEach(([category, items]: [string, any[]]) => {
              const mapped = items.map(item => mapToMenuItem(item, category));
              allItems.push(...mapped);

              if (category === "Chef Special" || category === "Chef's Recommendations") chefTemp.push(...mapped);
              else if (category === "Bestseller") bestTemp.push(...mapped);
              else if (category === "Curated for You") curatedTemp.push(...mapped);
            });

            // Deduplicate all menu items
            const uniqueAllItems = Array.from(new Map(allItems.map(i => [i.id, i])).values());

            setFullMenu(uniqueAllItems);
            setMenuItems(uniqueAllItems);
            setDynamicCategories(extractDynamicCategories(sections));
            setChefSpecials(chefTemp);
            setBestsellers(bestTemp);
            setCuratedItems(curatedTemp);
            setCombos(generateSmartCombos(uniqueAllItems));

            // 3. Initialize AI Combos with Smart Combos and fetch AI in background
            const smartCombos = generateSmartCombos(uniqueAllItems);
            setAiCombos(smartCombos);

            if (GENERATE_AI_COMBOS && userEmail !== "guest@dineiq.com") {
              // Non-blocking background fetch
              api.generateCombos(3, userEmail)
                .then(aiData => {
                  if (aiData?.combos && aiData.combos.length > 0) {
                    setAiCombos(aiData.combos);
                  }
                })
                .catch(err => console.error("âŒ Failed to fetch AI combos:", err));
            }
          }

          await updateOfflineMediaStatus(menuData, offersData);
        } catch (e) {
          console.error("âŒ Error loading Home Screen data:", e);
        } finally {
          setIsLoading(false);
        }
      };

      loadData();
    }
  }, [isLoggedIn, navigate, updateOfflineMediaStatus, user]);

  useEffect(() => {
    if (!tableNo) return;
    api.fetchActiveOrder(tableNo).then((res: any) => {
      if (res?.order) setActiveOrder(res.order);
    });
    // Poll for status updates every 30s
    const interval = setInterval(() => {
      api.fetchActiveOrder(tableNo).then((res: any) => {
        if (res?.order) setActiveOrder(res.order);
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [tableNo]);

  const handleCallWaiter = async () => {
    await api.callWaiter(tableNo, userName);
    setShowWaiterMsg(true);
  };

  const handleGetBill = () => {
    if (activeOrder) setShowBill(true);
  };

  const handleOrderStatus = () => {
    const element = document.getElementById("active-order-strip");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  /* --- Navigation & Filtering Logic --- */
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { isVegMode } = useUser();

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);

    // Log category selection
    saveLog(user?.email || "Guest", "CATEGORY_CLICK", category);

    // Special Case: Chef Specials -> Jump to standalone section
    if (category === "Chef Special" || category === "Chef's Specials") {
      const element = document.getElementById("chef-recs");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // Find category object to get ID
    const catObj = dynamicCategories.find(c => c.name === category);
    if (catObj) {
      const elementId = `category-${catObj.id}`;
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleSearch = useCallback((query: string) => {
    if (query.length >= 3) {
      saveLog(user?.email || "Guest", "SEARCH_ITEM", query);
    }
    setSearchQuery(query);
  }, [user?.email]);

  // Filter items for "All Dishes" section
  const filteredMenuItems = isVegMode ? menuItems.filter(i => i.isVeg === true) : menuItems;

  const displayedItems = searchQuery
    ? filteredMenuItems.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : filteredMenuItems;


  // Generate smart combos from menu items
  const generateSmartCombos = (items: MenuItem[]): MenuItem[] => {
    const combos: MenuItem[] = [];

    // Find items by category using project-specific naming
    const starters = items.filter(i => i.category.toUpperCase().includes('STARTER'));
    const mains = items.filter(i => i.category.toUpperCase().includes('MAIN'));
    const grills = items.filter(i => i.category.toUpperCase().includes('GRILL'));
    const sides = items.filter(i => i.category.toUpperCase().includes('SIDE'));
    const burgers = items.filter(i => i.category.toUpperCase().includes('BURGER') || i.category.toUpperCase().includes('SANDWICH'));
    const pasta = items.filter(i => i.category.toUpperCase().includes('PASTA'));

    // Combo 1: Grand Grill Platter (Grill + Starter + Side)
    if (grills.length && starters.length && sides.length) {
      const totalPrice = grills[0].price + starters[0].price + sides[0].price;
      combos.push({
        id: 'combo_grill_feast',
        name: 'Grand Grill Feast',
        description: `${grills[0].name} â€¢ ${starters[0].name} â€¢ ${sides[0].name}`,
        price: Math.round(totalPrice * 0.8), // 20% off
        image: grills[0].image,
        isVeg: grills[0].isVeg === true && starters[0].isVeg === true && sides[0].isVeg === true,
        category: 'Combos',
        rating: 4.8,
        ratingCount: 142
      });
    }

    // Combo 2: Quick Harvest Lunch (Burger/Sandwich + Side)
    if (burgers.length && sides.length) {
      const totalPrice = burgers[0].price + sides[0].price;
      combos.push({
        id: 'combo_quick_lunch',
        name: 'Quick Harvest Lunch',
        description: `${burgers[0].name} â€¢ ${sides[0].name} â€¢ Refreshment`,
        price: Math.round(totalPrice * 0.85), // 15% off
        image: burgers[0].image,
        isVeg: burgers[0].isVeg === true && sides[0].isVeg === true,
        category: 'Combos',
        rating: 4.5,
        ratingCount: 89
      });
    }

    // Combo 3: Italian Feast (Pasta + Starter)
    if (pasta.length && starters.length) {
      const totalPrice = pasta[0].price + starters[0].price;
      combos.push({
        id: 'combo_italian_special',
        name: 'Italian Harvest Special',
        description: `${pasta[0].name} â€¢ ${starters[0].name}`,
        price: Math.round(totalPrice * 0.82), // 18% off
        image: pasta[0].image,
        isVeg: pasta[0].isVeg === true && starters[0].isVeg === true,
        category: 'Combos',
        rating: 4.7,
        ratingCount: 112
      });
    }

    // Combo 4: Complete Land/Sea Meal (Main + Starter)
    if (mains.length && starters.length) {
      const totalPrice = mains[0].price + starters[0].price;
      combos.push({
        id: 'combo_complete_meal',
        name: 'Complete Harvest Meal',
        description: `${mains[0].name} â€¢ ${starters[0].name} â€¢ Chef's Choice Side`,
        price: Math.round(totalPrice * 0.75), // 25% off (Higher value)
        image: mains[0].image,
        isVeg: mains[0].isVeg === true && starters[0].isVeg === true,
        category: 'Combos',
        rating: 4.9,
        ratingCount: 201
      });
    }

    return combos.slice(0, 3); // Return top 3 dynamic combos
  };

  // Re-implementing generateSmartCombos properly to avoid breaking active code
  // usage: const combosTemp = generateSmartCombos(allItems);


  const handleBannerClick = (offer: any) => {
    // Log banner click
    saveLog(user?.email || "Guest", "CHEF_SPECIAL_CARD_CLICK", offer.title);

    // Clear search if any
    setSearchQuery("");

    // Allow a brief render cycle for sections to reappear
    setTimeout(() => {
      // Logic to scroll based on offer content
      const title = offer.title?.toLowerCase() || "";
      const subtitle = offer.subtitle?.toLowerCase() || "";

      if (title.includes("welcome") || title.includes("offer") || title.includes("combo") || subtitle.includes("combo")) {
        // Welcome Offer or Combo Banner -> Jump to Combos Section
        const element = document.getElementById("ai-combos") || document.getElementById("smart-combos");
        if (element) element.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (title.includes("chef") || subtitle.includes("chef") || title.includes("special")) {
        // Jump to Chef's Specials Section
        const element = document.getElementById("chef-recs");
        if (element) element.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (title.includes("best") || title.includes("seller")) {
        // Jump to Bestsellers Section
        const element = document.getElementById("bestsellers-section");
        if (element) element.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        // Default (Check Menu) -> Jump to Curated for You section
        const curatedSection = document.getElementById("curated-section");
        if (curatedSection) {
          curatedSection.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (dynamicCategories.length > 0) {
          // Fallback to first non-special category
          const firstCat = dynamicCategories.find(c => c.name !== "Chef Special" && c.name !== "Bestseller") || dynamicCategories[0];
          const element = document.getElementById(`category-${firstCat.id}`);
          if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }, 100);
  };

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-orange-50 via-white to-amber-50 pb-32">
      <HomeHeader
        onSearch={handleSearch}
        searchQuery={searchQuery}
        offlineMediaStatus={offlineMediaStatus}
        offlineMediaReady={offlineMediaReady}
      />

      <main className="animate-fade-in flex flex-col gap-5 pt-0 md:gap-6"> {/* Removed top padding for Hero edge-to-edge */}

        {/* Only show Hero & Banners if NOT searching */}
        {!searchQuery && (
          <>
            {/* 1. Hero Banner */}
            <HeroBanner onOrderNow={() => {
              saveLog(user?.email || "Guest", "VIEW_MENU_BANNER_CLICK", "User clicked Check Menu in Hero Banner");

              const curatedSection = document.getElementById("curated-section");
              if (curatedSection) {
                curatedSection.scrollIntoView({ behavior: "smooth", block: "start" });
              } else if (dynamicCategories.length > 0) {
                // Fallback to first non-special category
                const firstCat = dynamicCategories.find(c => c.name !== "Chef Special" && c.name !== "Bestseller") || dynamicCategories[0];
                const element = document.getElementById(`category-${firstCat.id}`);
                if (element) {
                  element.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }
            }} />

            {/* 2b. Currently Dining Section - Closer to banner */}
            <div className="mt-3 px-4">
              <DineInBar
                tableNo={tableNo}
                userName={userName}
                onCallWaiter={handleCallWaiter}
                onGetBill={handleGetBill}
                onOrderStatus={handleOrderStatus}
              />
            </div>

            {activeOrder && (
              <div id="active-order-strip" className="mt-2">
                <ActiveOrderBadge order={activeOrder} />
              </div>
            )}

            {/* 2. Offers (Discount Cards) */}
            <div className="px-0 relative mt-4 z-10">
              <OfferCarousel offers={offers} onBannerClick={handleBannerClick} />
            </div>

            {/* 3. Categories (What's in your mind?) */}
            {!isLoading && (
              <div className="bg-transparent py-2">
                <CategoryScroll
                  categories={dynamicCategories.filter(category => {
                    if (category.name === "Chef Special" || category.name === "Bestseller" || category.name === "Chef's Recommendations" || category.name === "Combos") return false;
                    const categoryItems = menuItems.filter(item => item.category === category.name);
                    return !isVegMode || categoryItems.some(item => item.isVeg === true);
                  })}
                  onSelect={handleCategorySelect}
                  selectedCategory={selectedCategory || undefined}
                />
              </div>
            )}

            {/* Combined Combo Logic: Follow GENERATE_AI_COMBOS flag */}
            {GENERATE_AI_COMBOS ? (
              aiCombos.length > 0 && (
                <div id="ai-combos" className="py-2 scroll-mt-24 bg-transparent mb-4">
                  <div className="mx-4 mb-4 flex flex-col gap-2 rounded-2xl border border-indigo-100/50 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-5 h-5 text-indigo-500 fill-indigo-500" />
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">AI Harvest Combos</h2>
                      </div>
                      <p className="text-xs text-gray-500 font-medium">Personalized deals based on your history & tastes</p>
                    </div>
                  </div>

                  <div className="hide-scrollbar flex gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory scroll-smooth">
                    {aiCombos.map((combo) => (
                      <AIComboCard key={combo.Item_ID} combo={combo} />
                    ))}
                  </div>
                </div>
              )
            ) : (
              !isLoading && (isVegMode ? combos.filter(c => c.isVeg === true) : combos).length > 0 && (
                <div id="smart-combos" className="scroll-mt-24">
                  <MenuSection
                    title="🎁 Smart Combos"
                    subtitle="AI-curated combo deals - Save more!"
                    items={isVegMode ? combos.filter(c => c.isVeg === true) : combos}
                    type="combos"
                  />
                </div>
              )
            )}
          </>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading delicious menu...</p>
          </div>
        )}

        {/* SEARCH RESULTS */}
        {!isLoading && searchQuery && displayedItems.length > 0 && (
          <div className="px-3 scroll-mt-24">
            <MenuSection
              title={`Search Results for "${searchQuery}"`}
              subtitle={`${displayedItems.length} items found`}
              items={displayedItems}
              type="standard"
            />
          </div>
        )}

        {/* Chef's Specials (Standalone) */}
        {!isLoading && (isVegMode ? chefSpecials.filter(c => c.isVeg === true) : chefSpecials).length > 0 && !searchQuery && (
          <div id="chef-recs" className="scroll-mt-24">
            <MenuSection
              title="👨‍🍳 Chef's Specials"
              subtitle="Premium dishes handpicked for you"
              items={isVegMode ? chefSpecials.filter(c => c.isVeg === true) : chefSpecials}
              type="chef"
            />
          </div>
        )}

        {/* Bestsellers (Standalone) */}
        {!isLoading && (isVegMode ? bestsellers.filter(c => c.isVeg === true) : bestsellers).length > 0 && !searchQuery && (
          <div id="bestsellers-section" className="scroll-mt-24">
            <MenuSection
              title="🔥 Bestsellers"
              subtitle="Most popular picks this week"
              items={isVegMode ? bestsellers.filter(c => c.isVeg === true) : bestsellers}
              type="bestseller"
            />
          </div>
        )}

        {/* Curated for You (DYNAMIC - Vertical) */}
        {!isLoading && curatedItems.length > 0 && !searchQuery && (
          <div id="curated-section" className="scroll-mt-24 px-3">
            <MenuSection
              title="✨ Curated for You"
              subtitle="Your favorite picks sorted by frequency"
              items={isVegMode ? curatedItems.filter(c => c.isVeg === true) : curatedItems}
              type="curated"
            />
          </div>
        )}

        {/* MAIN MENU SECTIONS (Dynamic Categories - Browse Mode) */}
        {!isLoading && !searchQuery && dynamicCategories.map((category) => {
          // Skip standalone / virtual sections to avoid duplication in main menu flow
          if (category.name === "Chef Special" ||
            category.name === "Bestseller" ||
            category.name === "Chef's Recommendations" ||
            category.name === "Curated for You" ||
            (GENERATE_AI_COMBOS && category.name === "Combos")) return null;

          // Filter items for this category
          const categoryItems = menuItems.filter(item => item.category === category.name);

          // Veg Mode Check: Ensure we don't render empty sections if all items are filtered out
          const visibleItems = isVegMode ? categoryItems.filter(i => i.isVeg === true) : categoryItems;

          if (visibleItems.length === 0) return null;

          // Determine Section Type
          let sectionType: "standard" | "chef" | "combos" = "standard";
          if (category.name === "Bestseller") sectionType = "standard"; // Bestsellers usually list
          if (category.name === "Your Favorites") sectionType = "standard";

          return (
            <div key={category.id} id={`category-${category.id}`} className="px-3 scroll-mt-24">
              <MenuSection
                title={category.name}
                subtitle={category.tagline}
                items={visibleItems}
                type={sectionType}
              />
            </div>
          );
        })}

        {/* Empty State */}
        {!isLoading && searchQuery && displayedItems.length === 0 && (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🍽️</div>
            <p className="text-xl font-semibold text-gray-700">No items found</p>
            <button onClick={() => { setSearchQuery(""); }} className="text-orange-600 font-bold mt-2">Clear Search</button>
          </div>
        )}
      </main>

      <div
        className="cursor-pointer"
        onClick={() => saveLog(user?.email || "Guest", "CLICK_AI_BUTTON", "User opened AI Assistant")}
        onKeyDown={(e) => e.key === 'Enter' && saveLog(user?.email || "Guest", "CLICK_AI_BUTTON", "User opened AI Assistant")}
        role="button"
        tabIndex={0}
      >
        <AIButton />
      </div>

      {/* Overlays */}
      {showWaiterMsg && <WaiterToast onDone={() => setShowWaiterMsg(false)} />}
      {showBill && activeOrder && (
        <BillModal
          order={activeOrder}
          tableNo={Number(tableNo)}
          onClose={() => setShowBill(false)}
        />
      )}

      {/* Global Styles for ported components */}
      <style>{`
        @keyframes pulseGreen {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes cartSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .dinebar {
          background: linear-gradient(135deg, #1A1A1A 0%, #2C1A0E 100%);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          position: relative;
        }
        .dinebar::before {
          content: '';
          position: absolute; inset: 0; pointer-events: none;
          background: 
            radial-gradient(circle at 15% 50%, rgba(245,158,11,0.18) 0%, transparent 55%),
            radial-gradient(circle at 85% 20%, rgba(226,55,68,0.14) 0%, transparent 50%);
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>



      <CartBar />
    </div>
  );
}



/* ─────────────────────────────────────────────────────────
   PORTED COMPONENTS FROM SANA V2
───────────────────────────────────────────────────────── */

const WaiterToast = ({ onDone }: { onDone: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: "fixed", top: 100, left: "50%", transform: "translateX(-50%)",
      zIndex: 400, background: Z.dark, color: "#fff",
      padding: "12px 20px", borderRadius: 14,
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 8px 32px rgba(0,0,0,.24)",
      animation: "fade-in .25s ease", whiteSpace: "nowrap",
      maxWidth: "calc(100vw - 32px)",
    }}>
      <Bell style={{ width: 16, height: 16, color: Z.amber, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700 }}>Waiter is on the way! 🙌</span>
    </div>
  );
};

const DineInBar = ({
  tableNo, userName, onCallWaiter, onGetBill, onOrderStatus,
}: {
  tableNo: string | number;
  userName: string;
  onCallWaiter: () => void;
  onGetBill: () => void;
  onOrderStatus: () => void;
}) => (
  <div className="dinebar">
    <div style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      padding: "12px 16px",
      gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(245,158,11,.18)", border: "1px solid rgba(245,158,11,.3)",
        }}>
          <UtensilsCrossed style={{ width: 18, height: 18, color: Z.amber }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontSize: 10, fontWeight: 600, letterSpacing: ".12em",
            textTransform: "uppercase", color: "rgba(255,255,255,.42)",
            lineHeight: 1, marginBottom: 3,
          }}>Currently Dining</p>
          <p style={{
            fontSize: 15, fontWeight: 700, color: "#fff",
            lineHeight: 1.2,
          }}>
            {userName !== "Guest" ? userName.split(" ")[0] : "Guest"} · Table {tableNo}
          </p>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
        padding: "5px 12px", borderRadius: 99,
        background: "rgba(27,166,114,.22)", border: "1px solid rgba(27,166,114,.38)",
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: Z.green, display: "block", flexShrink: 0,
          animation: "pulseGreen 1.7s infinite",
        }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: Z.green }}>Active</span>
      </div>
    </div>

    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      borderTop: "1px solid rgba(255,255,255,.07)",
    }}>
      {[
        { Icon: Bell, label: "Call Waiter", action: onCallWaiter },
        { Icon: Clock, label: "Order Status", action: onOrderStatus },
        { Icon: ShoppingBag, label: "Get Bill", action: onGetBill },
      ].map(({ Icon, label, action }, i) => (
        <button
          key={label}
          onClick={action}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, padding: "11px 4px",
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,.55)",
            borderRight: i < 2 ? "1px solid rgba(255,255,255,.07)" : "none",
            transition: "color .15s",
          }}
        >
          <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
        </button>
      ))}
    </div>
  </div>
);

const ActiveOrderBadge = ({ order }: { order: any }) => (
  <div style={{
    margin: "0 12px",
    borderRadius: 14,
    background: "rgba(27,166,114,.13)",
    border: "1px solid rgba(27,166,114,.28)",
    padding: "10px 14px",
  }}>
    <div style={{
      display: "flex", alignItems: "center",
      justifyContent: "space-between", marginBottom: 6,
      flexWrap: "wrap", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ShoppingBag style={{ width: 13, height: 13, color: Z.green, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: Z.green }}>Order Placed</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: Z.green,
          background: "rgba(27,166,114,.15)", padding: "1px 7px", borderRadius: 99,
        }}>{order.status}</span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: Z.dark }}>
        KSh {Number(order.total).toLocaleString()}
      </span>
    </div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {order.items.slice(0, 3).map((item: any, i: number) => (
        <span key={i} style={{
          fontSize: 10, fontWeight: 600, color: Z.charcoal,
          background: Z.white, border: `1px solid ${Z.line}`,
          padding: "2px 8px", borderRadius: 99,
          maxWidth: "calc(33% - 4px)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {item.quantity}× {item.name}
        </span>
      ))}
      {order.items.length > 3 && (
        <span style={{ fontSize: 10, fontWeight: 600, color: Z.muted, padding: "2px 4px" }}>
          +{order.items.length - 3} more
        </span>
      )}
    </div>
  </div>
);

const BillModal = ({ order, tableNo, onClose }: {
  order: any; tableNo: number; onClose: () => void;
}) => {
  const taxes = Math.round(order.total * 0.05);
  const subtotal = order.total - taxes;
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,.5)", backdropFilter: "blur(3px)",
      }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301,
        background: "#fff", borderRadius: "24px 24px 0 0",
        padding: "20px 16px env(safe-area-inset-bottom, 24px)",
        boxShadow: "0 -8px 40px rgba(0,0,0,.18)",
        animation: "cartSlideUp .32s cubic-bezier(.22,1,.36,1)",
        maxHeight: "85vh", overflowY: "auto",
      }} className="hide-scrollbar">
        <div style={{
          width: 40, height: 4, borderRadius: 99,
          background: Z.line, margin: "0 auto 18px",
        }} />
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: Z.redLight,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Receipt style={{ width: 18, height: 18, color: Z.red }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: Z.dark }}>Your Bill</p>
            <p style={{
              fontSize: 11, color: Z.muted,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              Table {tableNo} · {order.timestamp}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: Z.lineLight, border: "none", cursor: "pointer",
            width: 32, height: 32, borderRadius: 99, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: Z.mid,
          }}>×</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          {order.items.map((item: any, i: number) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 0", borderBottom: `1px solid ${Z.lineLight}`, gap: 8,
            }}>
              <span style={{
                fontSize: 13, color: Z.charcoal, fontWeight: 600,
                flex: 1, minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {item.quantity}× {item.name}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: Z.dark, flexShrink: 0 }}>
                KSh {(item.price * item.quantity).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <div style={{
          background: Z.surface, borderRadius: 14,
          padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8,
        }}>
          {[
            { label: "Subtotal", val: `KSh ${subtotal.toLocaleString()}`, green: false },
            { label: "GST & Taxes (5%)", val: `KSh ${taxes.toLocaleString()}`, green: false },
            { label: "Delivery", val: "FREE", green: true },
          ].map(({ label, val, green }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 12, color: Z.muted }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: green ? Z.green : Z.charcoal }}>
                {val}
              </span>
            </div>
          ))}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            paddingTop: 10, borderTop: `1.5px solid ${Z.line}`, marginTop: 4, gap: 8,
          }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: Z.dark }}>Grand Total</span>
            <span style={{ fontSize: 17, fontWeight: 900, color: Z.red }}>
              KSh {order.total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
