import { useUser } from "@/contexts/UserContext";
import { Search, Mic, MicOff, MapPin, ShoppingBag, Star, User, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import SidebarMenu from "./SidebarMenu";
import { useState, useRef, useCallback } from "react";

interface HomeHeaderProps {
  onSearch?: (query: string) => void;
  searchQuery?: string;
  offlineMediaStatus?: string | null;
  offlineMediaReady?: boolean;
}

const useVoiceSearch = (onResult: (text: string) => void) => {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const toggle = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice search not supported in this browser.");
      return;
    }

    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      onResult(text);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }, [listening, onResult]);

  return { listening, toggle };
};

export default function HomeHeader({
  onSearch,
  searchQuery = "",
  offlineMediaStatus = null,
  offlineMediaReady = false,
}: HomeHeaderProps) {
  const { guestName, isVegMode, toggleVegMode, tableNumber } = useUser();
  const { totalItems } = useCart();
  const navigate = useNavigate();

  const handleVoiceResult = (text: string) => {
    console.log("Voice Result:", text);
    onSearch?.(text);
  };

  const { listening, toggle } = useVoiceSearch(handleVoiceResult);
  const displayName = guestName || "Guest";

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100/80 bg-white/95 pb-3 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] backdrop-blur transition-all">
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <SidebarMenu>
              <button className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border-2 border-[#FDDCDE] bg-gradient-to-br from-[#E23744] to-[#C0303C] text-sm font-black text-white shadow-[0_2px_8px_rgba(226,55,68,0.3)] transition-transform active:scale-95">
                {!guestName || guestName.toLowerCase() === "guest" ? (
                  <User className="h-[18px] w-[18px] text-white" />
                ) : (
                  guestName.slice(0, 2).toUpperCase()
                )}
              </button>
            </SidebarMenu>

            <div className="flex min-w-0 flex-col">
              <h1 className="mb-1 truncate text-sm font-extrabold leading-none tracking-tight text-gray-900 sm:text-base">
                Hi, {displayName}
              </h1>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gray-500">
                <MapPin size={10} className="text-[#E23744]" fill="currentColor" />
                {tableNumber ? (
                  <>
                    <span className="font-bold text-[#E23744]">Table {tableNumber}</span>
                    <span>Harvest & Ember</span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-[#E23744]">Dine In</span>
                    <span>Harvest & Ember</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 sm:flex sm:items-center">
          <button
            onClick={() => navigate("/review")}
            className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-orange-100 bg-orange-50 px-3 shadow-sm transition-all active:scale-95"
            title="Share feedback"
          >
            <Star className="h-4 w-4 text-orange-500" fill="currentColor" />
            <span className="truncate text-[10px] font-black uppercase tracking-tight text-orange-700">
              Rate Us
            </span>
          </button>

          <button
            onClick={() => navigate("/cart")}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 transition-all active:scale-95"
            title="View your cart"
          >
            <ShoppingBag className="h-5 w-5 text-gray-700" />
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#E23744] text-[10px] font-bold text-white">
                {totalItems}
              </span>
            )}
          </button>

          <div className="flex flex-col items-center justify-center rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5">
            <span className="mb-1 text-[8px] font-bold uppercase leading-none tracking-wider text-gray-400">
              VEG
            </span>
            <Switch
              checked={isVegMode}
              onCheckedChange={toggleVegMode}
              className="h-4 w-7 border-none shadow-sm data-[state=checked]:bg-green-600"
            />
          </div>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 shadow-sm transition-all active:scale-95"
            title="Notifications"
          >
            <Bell className="h-5 w-5 text-gray-700" />
          </button>
        </div>
      </div>

      <div className="px-4">
        <div className="relative flex h-[44px] items-center rounded-xl border-[1.5px] border-gray-100 bg-gray-50 transition-all focus-within:border-[#E23744] focus-within:ring-4 focus-within:ring-[#E23744]/10">
          <Search className="absolute left-3 h-[15px] w-[15px] text-gray-400" strokeWidth={2.5} />
          <input
            type="text"
            value={searchQuery}
            placeholder="Search for dishes or cuisines"
            onChange={(e) => onSearch?.(e.target.value)}
            className="h-full w-full border-none bg-transparent pl-[36px] pr-12 text-[13px] font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
          />
          <button
            onClick={toggle}
            className={`absolute right-1 flex h-9 w-9 items-center justify-center rounded-lg border-none transition-all ${
              listening ? "animate-pulse bg-[#E23744]" : "bg-transparent hover:bg-gray-200"
            }`}
          >
            {listening ? (
              <MicOff className="h-4 w-4 text-white" />
            ) : (
              <Mic className="h-4 w-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {offlineMediaStatus && (
        <div className="px-4 pt-2">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold ${
              offlineMediaReady
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                offlineMediaReady ? "bg-emerald-500" : "animate-pulse bg-amber-500"
              }`}
            />
            <span>{offlineMediaStatus}</span>
          </div>
        </div>
      )}
    </header>
  );
}
