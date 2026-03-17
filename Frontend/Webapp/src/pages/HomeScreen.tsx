import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useCart } from "@/contexts/CartContext";
import OfferCarousel from "@/components/OfferCarousel";
import AIButton from "@/components/AIButton";
import { saveLog } from "@/utils/logger";
import { offlineApi as api } from "@/utils/offlineApi";
import { MenuItem, Category } from "@/lib/data";
import { extractDynamicCategories, getMenuItemImage } from "@/lib/categoryUtils";
import {
  Sparkles, RefreshCw,
  ChevronRight, ChevronLeft, Star, Clock,
  UtensilsCrossed, TrendingUp, Bell,
  Crown, ArrowRight, Pause, Play,
  Volume2, VolumeX, Search, Flame, Leaf,
  ShoppingBag, Mic, MicOff, User, Plus, Minus,
  History, Heart,
  MapPin, LogOut, Settings, Package,
  ShoppingCart, Trash2, ChevronUp, ChevronDown,
  Receipt,  // ← add
} from "lucide-react";
import AIComboCard from "@/components/AIComboCard";

/* ─────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────── */
const Z = {
  red:       "#E23744",
  redDark:   "#C0303C",
  redLight:  "#FFF1F2",
  redMid:    "#FDDCDE",
  amber:     "#F59E0B",
  dark:      "#1C1C1C",
  charcoal:  "#3D3D3D",
  mid:       "#696969",
  muted:     "#9E9E9E",
  line:      "#EFEFEF",
  lineLight: "#F7F7F7",
  surface:   "#F8F8F8",
  white:     "#FFFFFF",
  green:     "#1BA672",
  greenBg:   "#EBF9F4",
  blue:      "#3B82F6",
  blueBg:    "#EFF6FF",
  purple:    "#8B5CF6",
};

const GENERATE_AI_COMBOS = false;
const SLIDE_DURATION     = 5800;

/* ─────────────────────────────────────────────────────────
   GLOBAL CSS
───────────────────────────────────────────────────────── */
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
    html { -webkit-tap-highlight-color: transparent; }
    body { font-family: 'DM Sans', sans-serif; background:${Z.surface}; color:${Z.dark}; }

    .pf  { font-family:'Playfair Display',serif; }
    .hide-sb  { scrollbar-width:none; -ms-overflow-style:none; }
    .hide-sb::-webkit-scrollbar { display:none; }

    .pk { transition:transform .12s ease; cursor:pointer; }
    .pk:active { transform:scale(.955); }

    .sep8 { height:8px; background:${Z.lineLight}; }
    .sep4 { height:4px; background:${Z.lineLight}; }

    @keyframes shimmer {
      0%   { background-position:-600px 0; }
      100% { background-position: 600px 0; }
    }
    .skel {
      background:linear-gradient(90deg,#EBEBEB 25%,#F5F5F5 50%,#EBEBEB 75%);
      background-size:600px 100%;
      animation:shimmer 1.5s infinite;
      border-radius:8px;
    }

    @keyframes fadeUp {
      from { opacity:0; transform:translateY(14px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .fu0 { animation:fadeUp .4s ease both; }
    .fu1 { animation:fadeUp .4s .07s ease both; }
    .fu2 { animation:fadeUp .4s .14s ease both; }
    .fu3 { animation:fadeUp .4s .22s ease both; }
    .fu4 { animation:fadeUp .4s .30s ease both; }

    @keyframes progress {
      from { width:0%; }
      to   { width:100%; }
    }
    @keyframes pulseGreen {
      0%,100% { opacity:1; }
      50%     { opacity:.35; }
    }
    @keyframes micPulse {
      0%,100% { box-shadow:0 0 0 0 rgba(226,55,68,.4); }
      50%     { box-shadow:0 0 0 8px rgba(226,55,68,.0); }
    }
    @keyframes bounce {
      0%,100% { transform:scale(1); }
      30%     { transform:scale(1.22); }
      60%     { transform:scale(.92); }
    }
    @keyframes slideInUp {
      from { opacity:0; transform:translateY(20px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes quantityBounce {
      0%,100% { transform:scale(1); }
      50%     { transform:scale(1.15); }
    }
    @keyframes cartSlideUp {
      from { transform:translateY(110%); opacity:0; }
      to   { transform:translateY(0); opacity:1; }
    }
    @keyframes cartItemIn {
      from { opacity:0; transform:translateX(-10px); }
      to   { opacity:1; transform:translateX(0); }
    }
    @keyframes badgePop {
      0%   { transform:scale(1); }
      40%  { transform:scale(1.6); }
      70%  { transform:scale(.88); }
      100% { transform:scale(1); }
    }

    .hero-track {
      display:flex;
      transition:transform .55s cubic-bezier(.4,0,.2,1);
      will-change:transform;
      height:100%;
    }
    .hero-slide { min-width:100%; height:100%; position:relative; overflow:hidden; }
    .hero-dot {
      width:6px; height:6px; border-radius:99px;
      background:rgba(255,255,255,.4);
      transition:width .28s ease, background .28s ease;
    }
    .hero-dot.on { width:20px; background:#fff; }
    .progress-bar {
      height:2.5px;
      background:rgba(255,255,255,.92);
      border-radius:2px;
      animation:progress var(--dur,5.8s) linear forwards;
    }
    .glass {
      background:rgba(255,255,255,.13);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
      border:1px solid rgba(255,255,255,.22);
    }
    .hero-overlay {
      background:linear-gradient(
        180deg,
        rgba(0,0,0,.08) 0%,
        rgba(0,0,0,.22) 40%,
        rgba(0,0,0,.72) 100%
      );
    }
    .pulse-g { animation:pulseGreen 1.7s infinite; }

    .veg-box {
      width:16px; height:16px; border-radius:3px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
    }
    .veg-dot { width:8px; height:8px; border-radius:50%; }

    /* ── Enhanced ADD button ── */
    .add-btn-wrap {
      position:relative;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .add-btn-empty {
      border:1.5px solid ${Z.red};
      color:${Z.red};
      background:#fff;
      font-weight:800;
      font-size:11px;
      letter-spacing:.04em;
      border-radius:10px;
      padding:5px 0;
      width:72px;
      text-align:center;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:3px;
      transition:all .18s;
      box-shadow:0 2px 8px rgba(226,55,68,.12);
    }
    .add-btn-empty:hover, .add-btn-empty:active {
      background:${Z.red};
      color:#fff;
      box-shadow:0 4px 14px rgba(226,55,68,.32);
    }
    .add-btn-qty {
      border:none;
      background:${Z.red};
      border-radius:10px;
      width:88px;
      height:32px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 6px;
      box-shadow:0 4px 14px rgba(226,55,68,.32);
      animation:slideInUp .18s ease;
    }
    .qty-btn {
      width:20px; height:20px;
      border-radius:6px;
      background:rgba(255,255,255,.22);
      display:flex; align-items:center; justify-content:center;
      color:#fff;
      font-size:13px;
      font-weight:900;
      transition:background .12s;
      border:none;
      cursor:pointer;
    }
    .qty-btn:active { background:rgba(255,255,255,.4); }
    .qty-num {
      font-size:13px; font-weight:900; color:#fff;
      animation:quantityBounce .18s ease;
    }

    /* ── Category pill nav ── */
    .cat-pill {
      white-space:nowrap;
      padding:7px 16px;
      border-radius:99px;
      font-size:12px;
      font-weight:700;
      border:1.5px solid ${Z.line};
      background:#fff;
      color:${Z.charcoal};
      transition:background .15s, color .15s, border-color .15s;
    }
    .cat-pill.on {
      background:${Z.dark};
      color:#fff;
      border-color:${Z.dark};
    }

    /* ── Filter pill ── */
    .filter-pill {
      display:flex; align-items:center; gap:5px;
      padding:7px 14px;
      border-radius:99px;
      font-size:12px; font-weight:700;
      border:1.5px solid ${Z.line};
      background:#fff;
      color:${Z.charcoal};
      transition:all .15s;
      white-space:nowrap;
    }
    .filter-pill.on {
      background:${Z.red};
      color:#fff;
      border-color:${Z.red};
      box-shadow:0 3px 10px rgba(226,55,68,.3);
    }

    /* ── Offer card ── */
    .offer-card {
      flex-shrink:0;
      width:220px;
      border-radius:16px;
      overflow:hidden;
      position:relative;
      padding:16px;
      scroll-snap-align:start;
    }

    /* ── Combo card ── */
    .combo-card {
      flex-shrink:0; width:200px;
      border-radius:16px; overflow:hidden;
      background:#fff;
      border:1px solid ${Z.line};
      box-shadow:0 2px 12px rgba(0,0,0,.07);
      scroll-snap-align:start;
    }

    /* ── Chef card ── */
    .chef-card {
      flex-shrink:0; width:260px;
      border-radius:20px; overflow:hidden;
      box-shadow:0 4px 24px rgba(0,0,0,.11);
      scroll-snap-align:start;
      background:#fff;
    }

    /* ── Category carousel card ── */
    .cat-carousel-card {
      flex-shrink:0;
      width:88px;
      border-radius:18px;
      background:#fff;
      border:1.5px solid ${Z.line};
      overflow:hidden;
      scroll-snap-align:start;
      transition:border-color .15s, box-shadow .15s, transform .15s;
      display:flex; flex-direction:column; align-items:center;
      padding:10px 6px 8px;
      gap:6px;
      box-shadow:0 2px 8px rgba(0,0,0,.04);
    }
    .cat-carousel-card.on {
      border-color:${Z.red};
      background:${Z.redLight};
      box-shadow:0 4px 14px rgba(226,55,68,.18);
      transform:translateY(-2px);
    }
    .cat-carousel-card:active { transform:scale(.96); }

    /* ── Section header ── */
    .sec-title {
      font-size:17px; font-weight:800; color:${Z.dark}; line-height:1.2;
    }
    .sec-sub {
      font-size:12px; font-weight:500; color:${Z.muted}; margin-top:2px;
    }

    /* ── Menu item row ── */
    .menu-row {
      display:flex; gap:12px; padding:16px;
      border-bottom:1px solid ${Z.lineLight};
      align-items:flex-start;
    }

    /* ── Bestseller rank ── */
    .rank-medal { font-size:20px; width:26px; text-align:center; flex-shrink:0; }

    /* ── Dine-in bar (enhanced) ── */
    .dinebar {
      background:linear-gradient(135deg,#1A1A1A 0%,#2C1A0E 100%);
      border-radius:18px;
      overflow:hidden;
      margin:12px 16px;
      position:relative;
    }
    .dinebar::before {
      content:'';
      position:absolute; inset:0; pointer-events:none;
      background:
        radial-gradient(circle at 15% 50%, rgba(245,158,11,.18) 0%, transparent 55%),
        radial-gradient(circle at 85% 20%, rgba(226,55,68,.14) 0%, transparent 50%);
    }

    /* ── Trust strip ── */
    .trust-strip {
      display:grid; grid-template-columns:1fr 1fr 1fr;
      background:#fff;
      border:1px solid ${Z.line};
      border-radius:16px;
      overflow:hidden;
      margin:0 16px;
      box-shadow:0 1px 8px rgba(0,0,0,.04);
    }
    .trust-cell {
      display:flex; flex-direction:column;
      align-items:center; padding:12px 8px; gap:3px;
    }
    .trust-cell + .trust-cell { border-left:1px solid ${Z.line}; }

    /* ── Search banner ── */
    .search-banner {
      display:flex; align-items:center; gap:10px;
      padding:12px 16px;
      background:#fff;
      border-bottom:1px solid ${Z.line};
      position:sticky; top:57px; z-index:38;
    }

    /* ── Empty state ── */
    .empty-state {
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      padding:80px 24px; gap:12px; text-align:center;
    }

    /* ── Enhanced Home Header ── */
    .hh-root {
      padding:10px 16px 8px;
      display:flex; flex-direction:column; gap:10px;
    }
    .hh-top {
      display:flex; align-items:center; justify-content:space-between;
    }
    .hh-loc {
      display:flex; flex-direction:column;
    }
    .hh-loc-top {
      display:flex; align-items:center; gap:4px;
    }
    .hh-name {
      font-size:16px; font-weight:800; color:${Z.dark}; line-height:1.2;
    }
    .hh-table {
      font-size:11px; font-weight:600; color:${Z.muted};
    }
    .hh-right {
      display:flex; align-items:center; gap:8px;
    }
    .hh-icon-btn {
      width:38px; height:38px; border-radius:12px;
      display:flex; align-items:center; justify-content:center;
      background:${Z.surface};
      border:1.5px solid ${Z.line};
      transition:all .15s;
    }
    .hh-icon-btn:active { transform:scale(.94); }
    .hh-avatar {
      width:38px; height:38px; border-radius:12px;
      background:linear-gradient(135deg,${Z.red},${Z.redDark});
      display:flex; align-items:center; justify-content:center;
      font-size:14px; font-weight:900; color:#fff;
      border:2px solid ${Z.redMid};
      box-shadow:0 2px 8px rgba(226,55,68,.3);
      cursor:pointer;
    }
    .hh-search-row {
      display:flex; align-items:center; gap:8px;
    }
    .hh-search-wrap {
      flex:1; display:flex; align-items:center; gap:8px;
      background:${Z.surface};
      border:1.5px solid ${Z.line};
      border-radius:12px;
      padding:0 12px;
      height:42px;
      transition:border-color .15s, box-shadow .15s;
    }
    .hh-search-wrap:focus-within {
      border-color:${Z.red};
      box-shadow:0 0 0 3px rgba(226,55,68,.08);
    }
    .hh-search-input {
      flex:1; border:none; background:transparent;
      font-size:13px; font-weight:500; color:${Z.dark};
      outline:none;
    }
    .hh-search-input::placeholder { color:${Z.muted}; }
    .hh-mic-btn {
      width:38px; height:38px; border-radius:12px;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0;
      transition:all .15s;
      border:none;
      cursor:pointer;
    }
    .hh-mic-btn.idle {
      background:${Z.surface};
      border:1.5px solid ${Z.line};
    }
    .hh-mic-btn.recording {
      background:${Z.red};
      border:1.5px solid ${Z.red};
      animation:micPulse 1s infinite;
    }

    /* ── Profile drawer ── */
    .profile-overlay {
      position:fixed; inset:0; z-index:200;
      background:rgba(0,0,0,.45);
      backdrop-filter:blur(2px);
      animation:fadeUp .2s ease;
    }
    .profile-drawer {
      position:fixed; top:0; left:0; bottom:0;
      width:min(320px, 88vw);
      background:#fff;
      z-index:201;
      display:flex; flex-direction:column;
      box-shadow:8px 0 40px rgba(0,0,0,.18);
      animation:slideInLeft .28s cubic-bezier(.4,0,.2,1);
    }
    @keyframes slideInLeft {
      from { transform:translateX(-100%); }
      to   { transform:translateX(0); }
    }
    .profile-header {
      background:linear-gradient(135deg,${Z.red} 0%,${Z.redDark} 100%);
      padding:52px 20px 24px;
      position:relative;
    }
    .profile-close {
      position:absolute; top:14px; right:14px;
      width:32px; height:32px; border-radius:99px;
      background:rgba(255,255,255,.2);
      display:flex; align-items:center; justify-content:center;
      cursor:pointer;
      border:none; color:#fff;
    }

    /* ── Smart combo history badge ── */
    .history-badge {
      display:inline-flex; align-items:center; gap:4px;
      font-size:10px; font-weight:700;
      padding:3px 8px; border-radius:99px;
      background:${Z.blueBg}; color:${Z.blue};
    }

    /* ── CART BAR ── */
    .cart-bar-root {
      position:fixed; bottom:0; left:0; right:0; z-index:100;
      padding:0 12px 14px;
      pointer-events:none;
    }
    .cart-bar-pill {
      pointer-events:all;
      border-radius:22px;
      overflow:hidden;
      box-shadow:
        0 -1px 0 rgba(0,0,0,.04),
        0 8px 40px rgba(226,55,68,.30),
        0 24px 64px rgba(0,0,0,.18);
      animation:cartSlideUp .42s cubic-bezier(.22,1,.36,1) both;
      max-width:540px;
      margin:0 auto;
      display:block;
    }
    .cart-collapsed {
      background:linear-gradient(135deg, ${Z.red} 0%, ${Z.redDark} 100%);
      display:flex; align-items:center; justify-content:space-between;
      padding:14px 18px;
      cursor:pointer;
    }
    .cart-sheet {
      background:#fff;
    }
    .cart-sheet-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:14px 16px 10px;
      border-bottom:1px solid ${Z.lineLight};
    }
    .cart-item-row {
      display:flex; align-items:center; gap:10px;
      padding:10px 16px;
      border-bottom:1px solid ${Z.lineLight};
      animation:cartItemIn .2s ease both;
    }
    .cart-item-row:last-child { border-bottom:none; }
    .cart-totals-row {
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 16px 8px;
      background:${Z.surface};
      border-top:1px solid ${Z.lineLight};
    }
    .cart-checkout-btn {
      width:100%; padding:15px; border:none; cursor:pointer;
      background:linear-gradient(135deg, ${Z.red} 0%, ${Z.redDark} 100%);
      color:#fff; font-size:15px; font-weight:900;
      font-family:'DM Sans', sans-serif;
      display:flex; align-items:center; justify-content:center; gap:8px;
      letter-spacing:.01em;
      transition:opacity .15s;
    }
    .cart-checkout-btn:active { opacity:.88; }
    .cart-badge {
      min-width:20px; height:20px; border-radius:99px;
      background:#fff; color:${Z.red};
      font-size:11px; font-weight:900;
      display:flex; align-items:center; justify-content:center;
      padding:0 5px;
    }
    .cart-badge-pop { animation:badgePop .35s cubic-bezier(.36,.07,.19,.97); }
    .cart-qty-ctrl {
      display:flex; align-items:center; gap:5px;
      background:${Z.red}; border-radius:10px; padding:5px 7px;
      box-shadow:0 2px 8px rgba(226,55,68,.28);
    }
    .cart-qty-btn {
      background:rgba(255,255,255,.22); border:none; cursor:pointer;
      width:20px; height:20px; border-radius:6px;
      display:flex; align-items:center; justify-content:center; color:#fff;
    }
  `}</style>
);

/* ═══════════════════════════════════════════════════════
   CART STORE
   Module-level reactive store. AddButton writes here,
   EnhancedCartBar reads here. Bridges to real UserContext
   cart if handlers are provided.
═══════════════════════════════════════════════════════ */
type CartEntry = {
  id: string; name: string; price: number;
  image: string; isVeg: boolean;
};

const _cartMap      = new Map<string, number>();
const _cartMeta     = new Map<string, CartEntry>();
const _cartListeners = new Set<() => void>();
const _cartNotify   = () => _cartListeners.forEach(fn => fn());

// Optional bridge to real context cart — set once on mount
let _extAdd:    ((item: CartEntry, qty: number) => void) | null = null;
let _extRemove: ((id: string) => void) | null = null;

export const cartStore = {
  setBridge(
    add: (item: CartEntry, qty: number) => void,
    remove: (id: string) => void
  ) { _extAdd = add; _extRemove = remove; },

  // Register item metadata so CartBar can show name/price/image
  register(entry: CartEntry) {
    if (!_cartMeta.has(entry.id)) _cartMeta.set(entry.id, entry);
  },

  get(id: string) { return _cartMap.get(id) ?? 0; },

  add(id: string) {
    const next = (_cartMap.get(id) ?? 0) + 1;
    _cartMap.set(id, next);
    const m = _cartMeta.get(id);
    if (m) _extAdd?.(m, next);
    _cartNotify();
  },

  sub(id: string) {
    const next = Math.max(0, (_cartMap.get(id) ?? 0) - 1);
    if (next === 0) { _cartMap.delete(id); _extRemove?.(id); }
    else { _cartMap.set(id, next); const m = _cartMeta.get(id); if (m) _extAdd?.(m, next); }
    _cartNotify();
  },

  remove(id: string) { _cartMap.delete(id); _extRemove?.(id); _cartNotify(); },
  clear()            { _cartMap.clear(); _cartNotify(); },

  entries(): Array<{ entry: CartEntry; qty: number }> {
    const out: Array<{ entry: CartEntry; qty: number }> = [];
    _cartMap.forEach((qty, id) => {
      const e = _cartMeta.get(id); if (e) out.push({ entry: e, qty });
    });
    return out;
  },

  totalQty()   { let t = 0; _cartMap.forEach(q => (t += q)); return t; },
  totalPrice() {
    let t = 0;
    _cartMap.forEach((qty, id) => (t += (_cartMeta.get(id)?.price ?? 0) * qty));
    return t;
  },
};

/* ── react hooks for cart ── */
const useCartItem = (id: string) => {
  const [, r] = useState(0);
  useEffect(() => {
    const fn = () => r(n => n + 1);
    _cartListeners.add(fn);
    return () => { _cartListeners.delete(fn); };
  }, []);
  return {
    qty: cartStore.get(id),
    add: (e: React.MouseEvent) => { e.stopPropagation(); cartStore.add(id); },
    sub: (e: React.MouseEvent) => { e.stopPropagation(); cartStore.sub(id); },
  };
};

const useCartTotals = () => {
  const [, r] = useState(0);
  useEffect(() => {
    const fn = () => r(n => n + 1);
    _cartListeners.add(fn);
    return () => { _cartListeners.delete(fn); };
  }, []);
  return {
    totalQty:   cartStore.totalQty(),
    totalPrice: cartStore.totalPrice(),
    entries:    cartStore.entries(),
  };
};

/* ═══════════════════════════════════════════════════════
   ENHANCED ADD BUTTON
   Takes full item object so cartStore can register metadata.
═══════════════════════════════════════════════════════ */
const AddButton = ({ item, small = false }: { item: MenuItem; small?: boolean }) => {
  // Register metadata on first render — CartBar needs name/price/image
  useEffect(() => {
    cartStore.register({
      id:    item.id,
      name:  item.name,
      price: item.price,
      image: item.image,
      isVeg: item.isVeg === true,
    });
  }, [item.id]); // eslint-disable-line

  const { qty, add, sub } = useCartItem(item.id);

  if (qty === 0) {
    return (
      <button
        className="add-btn-empty pk"
        style={small ? { width: 60, fontSize: 10 } : {}}
        onClick={add}>
        <Plus style={{ width: 10, height: 10 }} />
        ADD
      </button>
    );
  }
  return (
    <div className="add-btn-qty" style={small ? { width: 76 } : {}}>
      <button className="qty-btn" onClick={sub}>
        <Minus style={{ width: 11, height: 11 }} />
      </button>
      <span className="qty-num">{qty}</span>
      <button className="qty-btn" onClick={add}>
        <Plus style={{ width: 11, height: 11 }} />
      </button>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   ENHANCED CART BAR
═══════════════════════════════════════════════════════ */
const EnhancedCartBar = ({
  tableNo, onCheckout,
}: { tableNo: number | null; onCheckout: () => void }) => {
  const { totalQty, totalPrice, entries } = useCartTotals();
  const [expanded, setExpanded] = useState(false);
  const [badgeKey, setBadgeKey] = useState(0);
  const prevQty = useRef(0);

  // Trigger badge pop animation on qty change
  useEffect(() => {
    if (totalQty !== prevQty.current) {
      setBadgeKey(k => k + 1);
      prevQty.current = totalQty;
    }
  }, [totalQty]);

  if (totalQty === 0) return null;

  return (
    <div className="cart-bar-root">
      <div className="cart-bar-pill">

        {/* ── Expanded sheet ── */}
        {expanded && (
          <div className="cart-sheet">

            {/* Sheet header */}
            <div className="cart-sheet-header">
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <ShoppingCart style={{ width:16, height:16, color:Z.red }} />
                <span style={{ fontSize:14, fontWeight:800, color:Z.dark }}>Your Order</span>
                {tableNo && (
                  <span style={{
                    fontSize:11, fontWeight:700, color:Z.red,
                    background:Z.redLight, padding:"2px 9px", borderRadius:99,
                  }}>
                    Table {tableNo}
                  </span>
                )}
              </div>
              <button
                onClick={() => setExpanded(false)}
                style={{
                  background:Z.lineLight, border:"none", cursor:"pointer",
                  width:28, height:28, borderRadius:8,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                <ChevronDown style={{ width:16, height:16, color:Z.mid }} />
              </button>
            </div>

            {/* Item list */}
            <div style={{ maxHeight:264, overflowY:"auto" }} className="hide-sb">
              {entries.map(({ entry, qty }, idx) => (
                <div
                  key={entry.id}
                  className="cart-item-row"
                  style={{ animationDelay:`${idx * 0.04}s` }}>

                  {/* veg indicator */}
                  <div style={{
                    width:14, height:14, borderRadius:3, flexShrink:0,
                    border:`2px solid ${entry.isVeg ? Z.green : "#C8102E"}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <div style={{
                      width:7, height:7, borderRadius:"50%",
                      background:entry.isVeg ? Z.green : "#C8102E",
                    }} />
                  </div>

                  {/* thumbnail */}
                  <div style={{
                    width:46, height:46, borderRadius:10,
                    overflow:"hidden", flexShrink:0,
                  }}>
                    <img
                      src={entry.image} alt={entry.name}
                      style={{ width:"100%", height:"100%", objectFit:"cover" }}
                    />
                  </div>

                  {/* name + subtotal */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{
                      fontSize:13, fontWeight:700, color:Z.dark,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    }}>{entry.name}</p>
                    <p style={{ fontSize:12, color:Z.muted, marginTop:2 }}>
                      KSh {entry.price} × {qty}{" "}
                      <strong style={{ color:Z.dark }}>
                        = KSh {(entry.price * qty).toLocaleString()}
                      </strong>
                    </p>
                  </div>

                  {/* qty stepper */}
                  <div className="cart-qty-ctrl">
                    <button
                      className="cart-qty-btn"
                      onClick={() => cartStore.sub(entry.id)}>
                      <Minus style={{ width:10, height:10 }} />
                    </button>
                    <span style={{
                      fontSize:13, fontWeight:900, color:"#fff",
                      minWidth:14, textAlign:"center",
                    }}>{qty}</span>
                    <button
                      className="cart-qty-btn"
                      onClick={() => cartStore.add(entry.id)}>
                      <Plus style={{ width:10, height:10 }} />
                    </button>
                  </div>

                  {/* remove */}
                  <button
                    onClick={() => cartStore.remove(entry.id)}
                    style={{
                      background:"none", border:"none", cursor:"pointer",
                      color:Z.muted, padding:4, flexShrink:0,
                    }}>
                    <Trash2 style={{ width:14, height:14 }} />
                  </button>
                </div>
              ))}
            </div>

            {/* Totals row */}
            <div className="cart-totals-row">
              <div>
                <p style={{ fontSize:11, color:Z.muted, fontWeight:600 }}>
                  {totalQty} item{totalQty > 1 ? "s" : ""} · To pay
                </p>
                <p style={{ fontSize:18, fontWeight:900, color:Z.dark }}>
                  KSh {totalPrice.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => { cartStore.clear(); setExpanded(false); }}
                style={{
                  padding:"8px 12px", borderRadius:10,
                  border:`1.5px solid ${Z.line}`, background:Z.white,
                  fontSize:12, fontWeight:700, color:Z.mid, cursor:"pointer",
                  display:"flex", alignItems:"center", gap:4,
                }}>
                <Trash2 style={{ width:12, height:12 }} /> Clear all
              </button>
            </div>

            {/* Checkout */}
            <button
  className="cart-checkout-btn"
  onClick={(e) => {
    e.stopPropagation();
    setExpanded(false);

    onCheckout();      // place order
    cartStore.clear(); // clear cart after order
  }}
>
              <ShoppingBag style={{ width:18, height:18 }} />
              Place Order · KSh {totalPrice.toLocaleString()}
              <ArrowRight style={{ width:16, height:16 }} />
            </button>
          </div>
        )}

        {/* ── Collapsed pill ── */}
        {!expanded && (
          <div className="cart-collapsed" onClick={() => setExpanded(true)}>
            {/* Left: icon + badge + info */}
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ position:"relative" }}>
                <div style={{
                  width:44, height:44, borderRadius:14,
                  background:"rgba(255,255,255,.18)",
                  border:"1.5px solid rgba(255,255,255,.28)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <ShoppingBag style={{ width:20, height:20, color:"#fff" }} />
                </div>
                <div
                  key={badgeKey}
                  className="cart-badge cart-badge-pop"
                  style={{ position:"absolute", top:-8, right:-8 }}>
                  {totalQty}
                </div>
              </div>
              <div>
                <p style={{
                  fontSize:11, color:"rgba(255,255,255,.65)",
                  fontWeight:600, lineHeight:1,
                }}>
                  {totalQty} item{totalQty > 1 ? "s" : ""}
                  {tableNo ? ` · Table ${tableNo}` : ""}
                </p>
                <p style={{ fontSize:17, fontWeight:900, color:"#fff", lineHeight:1.3 }}>
                  KSh {totalPrice.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Right: CTA pill */}
            <div style={{
              display:"flex", alignItems:"center", gap:6,
              background:"rgba(255,255,255,.18)", borderRadius:12,
              padding:"9px 14px", border:"1.5px solid rgba(255,255,255,.28)",
            }}>
              <span style={{ fontSize:13, fontWeight:800, color:"#fff" }}>
                View Cart
              </span>
              <ChevronUp style={{ width:14, height:14, color:"#fff" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   VOICE SEARCH HOOK
───────────────────────────────────────────────────────── */
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
      const txt = e.results[0][0].transcript;
      onResult(txt);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }, [listening, onResult]);

  return { listening, toggle };
};

/* ─────────────────────────────────────────────────────────
   ENHANCED HOME HEADER
───────────────────────────────────────────────────────── */
interface EnhancedHeaderProps {
  userName: string;
  tableNo: number | null;
  searchQuery: string;
  onSearch: (q: string) => void;
  onProfile: () => void;
}
const EnhancedHeader = ({
  userName, tableNo, searchQuery, onSearch, onProfile,
}: EnhancedHeaderProps) => {
  const { listening, toggle } = useVoiceSearch(onSearch);
  const initials = userName ? userName.slice(0, 2).toUpperCase() : "G";
  const isGuest  = !userName || userName.toLowerCase() === "guest";

  return (
    <div className="hh-root">
      {/* Top row */}
      <div className="hh-top">
        {/* LEFT: avatar + name + table */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="hh-avatar pk" onClick={onProfile} style={{ flexShrink: 0 }}>
            {isGuest ? <User style={{ width: 18, height: 18 }} /> : initials}
          </button>
          <div className="hh-loc">
            <div className="hh-loc-top">
              <span className="hh-name">{isGuest ? "Welcome 👋" : `Hi, ${userName.split(" ")[0]}`}</span>
            </div>
            {tableNo && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <MapPin style={{ width: 10, height: 10, color: Z.red }} />
                <span className="hh-table" style={{ color: Z.red, fontWeight: 700 }}>Table {tableNo}</span>
                <span className="hh-table"> · Harvest & Ember</span>
              </div>
            )}
          </div>
        </div>
        {/* RIGHT: bell */}
        <div className="hh-right">
          <button className="hh-icon-btn pk">
            <Bell style={{ width: 16, height: 16, color: Z.charcoal }} />
          </button>
        </div>
      </div>

      {/* Search row */}
      <div className="hh-search-row">
        <div className="hh-search-wrap">
          <Search style={{ width: 15, height: 15, color: Z.muted, flexShrink: 0 }} />
          <input
            className="hh-search-input"
            placeholder="Search for dishes, cuisines…"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => onSearch("")}
              style={{ color: Z.muted, fontSize: 18, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}>
              ×
            </button>
          )}
        </div>
        <button
          className={`hh-mic-btn ${listening ? "recording" : "idle"} pk`}
          onClick={toggle}>
          {listening
            ? <MicOff style={{ width: 16, height: 16, color: "#fff" }} />
            : <Mic style={{ width: 16, height: 16, color: Z.charcoal }} />}
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   PROFILE DRAWER
───────────────────────────────────────────────────────── */
const ProfileDrawer = ({
  user, tableNo, onClose, navigate,
}: {
  user: any; tableNo: number | null;
  onClose: () => void; navigate: any;
}) => {
  const isGuest = !user || user.email === "guest@dineiq.com";
  const name    = user?.name || "Guest";
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <>
      <div className="profile-overlay" onClick={onClose} />
      <div className="profile-drawer">
        {/* Header */}
        <div className="profile-header">
          <button className="profile-close" onClick={onClose}>
            <ChevronLeft style={{ width: 18, height: 18 }} />
          </button>
          {/* Avatar */}
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: "rgba(255,255,255,.22)",
            border: "2.5px solid rgba(255,255,255,.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 12,
          }}>
            {isGuest ? "👤" : initials}
          </div>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{name}</p>
          {user?.email && <p style={{ fontSize: 12, color: "rgba(255,255,255,.65)", marginTop: 2 }}>{user.email}</p>}
          {tableNo && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              marginTop: 10, padding: "4px 12px", borderRadius: 99,
              background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.28)",
            }}>
              <UtensilsCrossed style={{ width: 12, height: 12, color: "rgba(255,255,255,.7)" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Table {tableNo}</span>
            </div>
          )}
        </div>

        {/* Menu */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {[
            { icon: Package,  label: "My Orders",       sub: "Track & reorder",    path: "/orders" },
            { icon: Heart,    label: "Favourites",       sub: "Saved dishes",       path: "/favourites" },
            { icon: History,  label: "Order History",    sub: "Past visits",        path: "/history" },
            { icon: Settings, label: "Preferences",      sub: "Dietary & taste",    path: "/preferences" },
          ].map(({ icon: Icon, label, sub, path }) => (
            <button key={label}
              className="pk"
              onClick={() => { navigate(path); onClose(); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 14,
                padding: "14px 20px", background: "none", border: "none",
                cursor: "pointer", borderBottom: `1px solid ${Z.lineLight}`,
              }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: Z.surface, border: `1.5px solid ${Z.line}`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon style={{ width: 18, height: 18, color: Z.charcoal }} />
              </div>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: Z.dark }}>{label}</p>
                <p style={{ fontSize: 11, color: Z.muted, marginTop: 1 }}>{sub}</p>
              </div>
              <ChevronRight style={{ width: 16, height: 16, color: Z.line, marginLeft: "auto" }} />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 24px" }}>
          {isGuest ? (
            <button
              className="pk"
              onClick={() => { navigate("/login"); onClose(); }}
              style={{
                width: "100%", padding: "13px", borderRadius: 14,
                background: Z.red, color: "#fff", fontSize: 14, fontWeight: 800,
                border: "none", cursor: "pointer",
                boxShadow: `0 4px 16px rgba(226,55,68,.3)`,
              }}>
              Sign in / Create Account
            </button>
          ) : (
            <button
              className="pk"
              onClick={() => { navigate("/login"); onClose(); }}
              style={{
                width: "100%", padding: "13px", borderRadius: 14,
                background: Z.surface, color: Z.mid, fontSize: 14, fontWeight: 700,
                border: `1.5px solid ${Z.line}`, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              <LogOut style={{ width: 16, height: 16 }} />
              Sign Out
            </button>
          )}
        </div>
      </div>
    </>
  );
};

/* ─────────────────────────────────────────────────────────
   HERO SLIDER
───────────────────────────────────────────────────────── */
interface SlideData {
  type: "video" | "gradient" | "image";
  src?: string;
  bg?: string;
  tag: string;
  tagColor?: string;
  title: string;
  titleAccent?: string;
  sub: string;
  cta: string;
  ctaColor: string;
  deco?: string;
  blobA?: string;
  blobB?: string;
}

const SLIDES: SlideData[] = [
  {
    type:        "video",
    src:         "/src/assets/hero-video.mp4",
    tag:         "Open for Dining",
    tagColor:    "#4AEAAA",
    title:       "Harvest",
    titleAccent: "& Ember",
    sub:         "Fine Dining · Grill · International Cuisine",
    cta:         "Explore Menu",
    ctaColor:    Z.red,
    deco:        "🕯️",
  },
  {
    type:        "video",
    src:         "/src/assets/Sizzling_Indian_Food_Video_Generated.mp4",
    tag:         "Chef's Specials",
    tagColor:    "#FFD580",
    title:       "Tonight's",
    titleAccent: "Finest",
    sub:         "Handpicked premium dishes by our Head Chef",
    cta:         "See Chef's Picks",
    ctaColor:    Z.amber,
    deco:        "👨‍🍳",
  },
  {
    type:        "image",
    src:         "/src/assets/hero-food.jpg",
    tag:         "Exclusive Deal",
    tagColor:    "#93C5FD",
    title:       "Flat 30%",
    titleAccent: "Off Combos",
    sub:         "Use code COMBO30 · Valid on all combo meals today",
    cta:         "Grab the Deal",
    ctaColor:    "#3B82F6",
    deco:        "🎁",
  },
];

const HeroSlider = ({ onCta }: { onCta: (i: number) => void }) => {
  const [cur, setCur]       = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted]   = useState(true);
  const [pKey, setPKey]     = useState(0);
  const videoRef            = useRef<HTMLVideoElement>(null);
  const timerRef            = useRef<ReturnType<typeof setTimeout>>();
  const touchX              = useRef<number | null>(null);

  const goTo = (i: number) => { setCur(i); setPKey(k => k + 1); };
  const next = useCallback(() => goTo((cur + 1) % SLIDES.length), [cur]);
  const prev = () => goTo((cur - 1 + SLIDES.length) % SLIDES.length);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(next, SLIDE_DURATION);
    return () => clearTimeout(timerRef.current);
  }, [cur, paused, next]);

  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted; }, [muted]);
  const s = SLIDES[cur];

  return (
    <div className="relative overflow-hidden" style={{ height: 290 }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 44) dx < 0 ? next() : prev();
        touchX.current = null;
      }}>
      <div className="hero-track" style={{ transform: `translateX(-${cur * 100}%)` }}>
        {SLIDES.map((sl, i) => (
          <div key={i} className="hero-slide" style={{ background: sl.bg || "#111" }}>
            {sl.type === "video" && sl.src && (
              <video
                ref={i === cur ? videoRef : undefined}
                src={sl.src}
                autoPlay loop muted={muted} playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {sl.type === "image" && sl.src && (
              <img
                src={sl.src}
                alt={sl.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {sl.type === "gradient" && (
              <div className="absolute inset-0 pointer-events-none">
                {sl.blobA && <div className="absolute rounded-full blur-3xl"
                  style={{ width: 200, height: 200, top: -30, right: "6%", background: sl.blobA }} />}
                {sl.blobB && <div className="absolute rounded-full blur-3xl"
                  style={{ width: 160, height: 160, bottom: 0, left: "8%", background: sl.blobB }} />}
              </div>
            )}
            <div className="hero-overlay absolute inset-0" />
          </div>
        ))}
      </div>
      {s.deco && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none select-none"
          style={{ fontSize: 54, opacity: .5, animation: "floatEl 3.5s ease-in-out infinite" }}>
          {s.deco}
        </div>
      )}
      <div className="absolute inset-0 flex flex-col justify-end px-5 pb-5 pointer-events-none">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="glass flex items-center gap-1.5 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full pulse-g" style={{ background: Z.green, display: "block" }} />
            <span className="text-[11px] font-bold" style={{ color: s.tagColor || "#fff" }}>{s.tag}</span>
          </div>
          {cur === 0 && (
            <div className="glass flex items-center gap-1 px-2 py-1 rounded-full">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className="text-[11px] font-bold text-white">4.8</span>
            </div>
          )}
        </div>
        <h1 className="pf text-[34px] font-black text-white leading-[1.05]">
          {s.title}{" "}
          {s.titleAccent && <em style={{ color: s.ctaColor, fontStyle: "italic" }}>{s.titleAccent}</em>}
        </h1>
        <p className="text-[12px] mt-1 font-medium" style={{ color: "rgba(255,255,255,.52)" }}>{s.sub}</p>
        <div className="pointer-events-auto mt-4">
          <button className="glass flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-[13px] text-white pk"
            style={{ background: s.ctaColor, border: "none", boxShadow: `0 4px 18px ${s.ctaColor}55` }}
            onClick={() => onCta(cur)}>
            {s.cta} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-2.5 pointer-events-auto">
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button key={i} className={`hero-dot ${i === cur ? "on" : ""}`} onClick={() => goTo(i)} />
          ))}
        </div>
        <button className="glass w-7 h-7 rounded-full flex items-center justify-center pk"
          onClick={() => setPaused(p => !p)}>
          {paused ? <Play className="w-3 h-3 text-white" /> : <Pause className="w-3 h-3 text-white" />}
        </button>
        {SLIDES[cur].type === "video" && (
          <button className="glass w-7 h-7 rounded-full flex items-center justify-center pk"
            onClick={() => setMuted(m => !m)}>
            {muted ? <VolumeX className="w-3 h-3 text-white" /> : <Volume2 className="w-3 h-3 text-white" />}
          </button>
        )}
      </div>
      <button className="glass absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center pk pointer-events-auto"
        onClick={prev}>
        <ChevronLeft className="w-4 h-4 text-white" />
      </button>
      <button className="glass absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center pk pointer-events-auto"
        onClick={next}>
        <ChevronRight className="w-4 h-4 text-white" />
      </button>
      <div className="absolute top-0 left-0 right-0" style={{ height: 3, background: "rgba(255,255,255,.12)" }}>
        <div key={`${cur}-${pKey}`} className="progress-bar"
          style={{ "--dur": `${SLIDE_DURATION}ms` } as React.CSSProperties} />
      </div>
      <style>{`
        @keyframes floatEl {
          0%,100% { transform:translateY(-50%) translateY(0); }
          50%      { transform:translateY(-50%) translateY(-7px); }
        }
      `}</style>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   ENHANCED DINE-IN BAR
───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────
   ENHANCED DINE-IN BAR
───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────
   ENHANCED DINE-IN BAR
───────────────────────────────────────────────────────── */
const DineInBar = ({
  tableNo = 7, userName = "Guest", onCallWaiter, onGetBill, onOrderStatus,
}: {
  tableNo?: number;
  userName?: string;
  onCallWaiter: () => void;
  onGetBill: () => void;
  onOrderStatus: () => void;
}) => (
  <div className="dinebar fu0">
    <div style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      gap: 8,
    }}>
      {/* Left: icon + text */}
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
            {userName !== "Guest" && userName !== "guest@dineiq.com"
              ? userName.split(" ")[0]
              : "Guest"
            }{" "}· Table {tableNo}
          </p>
        </div>
      </div>

      {/* Right: Active badge */}
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

    {/* Action buttons */}
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      borderTop: "1px solid rgba(255,255,255,.07)",
    }}>
      {([
        { Icon: Bell,        label: "Call Waiter",  action: onCallWaiter  },
        { Icon: Clock,       label: "Order Status", action: onOrderStatus },
        { Icon: ShoppingBag, label: "Get Bill",     action: onGetBill     },
      ] as const).map(({ Icon, label, action }, i) => (
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
          onTouchStart={e => (e.currentTarget.style.color = "rgba(255,255,255,.9)")}
          onTouchEnd={e   => (e.currentTarget.style.color = "rgba(255,255,255,.55)")}
        >
          <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
        </button>
      ))}
    </div>
  </div>
);
/* ─────────────────────────────────────────────────────────
   ACTIVE ORDER BADGE
───────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────
   BILL MODAL
───────────────────────────────────────────────────────── */
const BillModal = ({ order, tableNo, onClose }: {
  order: any; tableNo: number; onClose: () => void;
}) => {
  const taxes    = Math.round(order.total * 0.05);
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
      }} className="hide-sb">

        {/* Handle */}
        <div style={{
          width: 40, height: 4, borderRadius: 99,
          background: Z.line, margin: "0 auto 18px",
        }} />

        {/* Header */}
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

        {/* Items */}
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

        {/* Totals */}
        <div style={{
          background: Z.surface, borderRadius: 14,
          padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8,
        }}>
          {[
            { label: "Subtotal",         val: `KSh ${subtotal.toLocaleString()}`, green: false },
            { label: "GST & Taxes (5%)", val: `KSh ${taxes.toLocaleString()}`,    green: false },
            { label: "Delivery",         val: "FREE",                             green: true  },
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

        <p style={{ fontSize: 11, color: Z.muted, textAlign: "center", marginTop: 14 }}>
          Order #{order.id}
        </p>
      </div>
    </>
  );
};

/* ─────────────────────────────────────────────────────────
   WAITER TOAST
───────────────────────────────────────────────────────── */
const WaiterToast = ({ onDone }: { onDone: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
      zIndex: 400, background: Z.dark, color: "#fff",
      padding: "12px 20px", borderRadius: 14,
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 8px 32px rgba(0,0,0,.24)",
      animation: "fadeUp .25s ease", whiteSpace: "nowrap",
      maxWidth: "calc(100vw - 32px)",
    }}>
      <Bell style={{ width: 16, height: 16, color: Z.amber, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700 }}>Waiter is on the way! 🙌</span>
    </div>
  );
};


/* ─────────────────────────────────────────────────────────
   SECTION HEADER
───────────────────────────────────────────────────────── */
const SecHeader = ({
  title, sub, badge, onAll,
}: { title: string; sub?: string; badge?: string; onAll?: () => void }) => (
  <div className="flex items-start justify-between px-4 mb-3">
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="sec-title">{title}</span>
        {badge && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: Z.redLight, color: Z.red }}>{badge}</span>
        )}
      </div>
      {sub && <p className="sec-sub">{sub}</p>}
    </div>
    {onAll && (
      <button className="flex items-center gap-0.5 text-[13px] font-bold pk" style={{ color: Z.red }}
        onClick={onAll}>
        See all <ChevronRight className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

/* ─────────────────────────────────────────────────────────
   CATEGORY CAROUSEL
───────────────────────────────────────────────────────── */
const CAT: Record<string, { emoji: string; bg: string }> = {
  STARTER:  { emoji: "🥗", bg: "#FFF4E8" }, SOUP:     { emoji: "🍲", bg: "#E9F5FE" },
  SALAD:    { emoji: "🥙", bg: "#E8F7EF" }, GRILL:    { emoji: "🥩", bg: "#FFF0F0" },
  MAIN:     { emoji: "🍛", bg: "#FFFAE8" }, BURGER:   { emoji: "🍔", bg: "#FFF3E8" },
  SANDWICH: { emoji: "🥪", bg: "#FFF0EE" }, PASTA:    { emoji: "🍝", bg: "#FFF4F4" },
  PIZZA:    { emoji: "🍕", bg: "#FFF0E8" }, DESSERT:  { emoji: "🍮", bg: "#FFF0FA" },
  BREAD:    { emoji: "🫓", bg: "#FFF9E8" }, SIDE:     { emoji: "🍟", bg: "#FFFCE8" },
  DRINK:    { emoji: "🥤", bg: "#E8F0FF" }, MOCKTAIL: { emoji: "🍹", bg: "#F0E8FF" },
  COCKTAIL: { emoji: "🍸", bg: "#FFE8F0" }, SEAFOOD:  { emoji: "🦐", bg: "#E8F8FF" },
  default:  { emoji: "🍽️", bg: "#F4F4F4" },
};
const catMeta = (n: string) => {
  const k = Object.keys(CAT).find(k => k !== "default" && n.toUpperCase().includes(k));
  return CAT[k || "default"];
};

const CategoryCarousel = ({
  cats, selectedCategory, onPick,
}: { cats: Category[]; selectedCategory: string | null; onPick: (n: string) => void }) => (
  <div className="fu3">
    <SecHeader title="What's on your mind?" sub="Browse by category" />
    <div className="flex gap-3 px-4 overflow-x-auto hide-sb"
      style={{ scrollSnapType: "x mandatory", paddingBottom: 8, paddingTop: 2 }}>
      {/* ALL pill */}
      <button
        className={`cat-carousel-card ${!selectedCategory ? "on" : ""}`}
        onClick={() => onPick("")}>
        <div className="flex items-center justify-center text-[26px]"
          style={{ width: 52, height: 52, borderRadius: 14, background: !selectedCategory ? Z.redLight : "#F4F4F4" }}>
          🍽️
        </div>
        <span className="text-[10px] font-bold text-center leading-tight"
          style={{ color: !selectedCategory ? Z.red : Z.charcoal }}>All</span>
      </button>

      {cats.map(cat => {
        const m   = catMeta(cat.name);
        const sel = selectedCategory === cat.name;
        return (
          <button key={cat.id} className={`cat-carousel-card ${sel ? "on" : ""}`}
            onClick={() => onPick(cat.name)}>
            <div className="flex items-center justify-center text-[26px]"
              style={{
                width: 52, height: 52, borderRadius: 14,
                background: sel ? Z.redLight : m.bg,
                boxShadow: sel ? `0 2px 10px rgba(226,55,68,.18)` : "0 2px 8px rgba(0,0,0,.05)",
              }}>
              {m.emoji}
            </div>
            <span className="text-[10px] font-bold text-center leading-tight line-clamp-2"
              style={{ color: sel ? Z.red : Z.charcoal }}>{cat.name}</span>
          </button>
        );
      })}
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────
   FILTER PILL ROW
───────────────────────────────────────────────────────── */
const FilterPills = ({ active, onChange }: { active: string; onChange: (v: string) => void }) => {
  const pills = [
    { label: "All", icon: <span>🍽️</span> },
    { label: "Veg", icon: <Leaf className="w-3 h-3" /> },
    { label: "Chef's Pick", icon: <span>👨‍🍳</span> },
    { label: "Bestseller", icon: <Flame className="w-3 h-3" /> },
    { label: "New", icon: <Sparkles className="w-3 h-3" /> },
    { label: "Quick Bites", icon: <span>⚡</span> },
  ];
  return (
    <div className="flex gap-2 px-4 overflow-x-auto hide-sb py-3">
      {pills.map(p => (
        <button key={p.label} className={`filter-pill ${active === p.label ? "on" : ""}`}
          onClick={() => onChange(p.label)}>
          {p.icon}{p.label}
        </button>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   VEG / NON-VEG INDICATOR
───────────────────────────────────────────────────────── */
const VegDot = ({ isVeg }: { isVeg: boolean }) => (
  <div className="veg-box" style={{ border: `2px solid ${isVeg ? Z.green : "#C8102E"}` }}>
    <div className="veg-dot" style={{ background: isVeg ? Z.green : "#C8102E" }} />
  </div>
);

/* ─────────────────────────────────────────────────────────
   SMART COMBO CARD
───────────────────────────────────────────────────────── */
const SmartComboCard = ({ item, isPersonalised }: { item: MenuItem; isPersonalised?: boolean }) => (
  <div className="combo-card pk">
    <div className="relative" style={{ height: 120 }}>
      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(to top,rgba(0,0,0,.5) 0%,transparent 55%)" }} />
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-black text-white"
        style={{ background: Z.red }}>SAVE 20%</div>
      {isPersonalised && (
        <div className="absolute top-2 right-10 px-1.5 py-0.5 rounded-md text-[9px] font-black"
          style={{ background: Z.blue, color: "#fff" }}>
          ✨ For You
        </div>
      )}
      <div className="absolute top-2 right-2">
        <VegDot isVeg={item.isVeg === true} />
      </div>
      <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-lg"
        style={{ background: "rgba(0,0,0,.55)" }}>
        <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
        <span className="text-[10px] font-bold text-white">{item.rating}</span>
      </div>
    </div>
    <div className="p-3">
      <p className="font-black text-[13px] leading-tight" style={{ color: Z.dark }}>{item.name}</p>
      <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: Z.muted }}>{item.description}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[14px] font-black" style={{ color: Z.dark }}>KSh {item.price}</span>
        <AddButton item={item} small />
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────
   CHEF CARD
───────────────────────────────────────────────────────── */
const ChefCard = ({ item }: { item: MenuItem }) => (
  <div className="chef-card pk">
    <div className="relative" style={{ height: 168 }}>
      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(to top,rgba(18,8,0,.88) 0%,transparent 52%)" }} />
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{ background: "rgba(245,158,11,.9)" }}>
        <Crown className="w-3 h-3 text-white" />
        <span className="text-[10px] font-black text-white uppercase tracking-wide">Chef's Special</span>
      </div>
      <div className="absolute top-3 right-3">
        <VegDot isVeg={item.isVeg === true} />
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
        <p className="font-black text-[15px] text-white leading-tight">{item.name}</p>
        <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: "rgba(255,255,255,.6)" }}>{item.description}</p>
      </div>
    </div>
    <div className="flex items-center justify-between px-3.5 py-3">
      <div>
        <span className="text-[15px] font-black" style={{ color: Z.dark }}>KSh {item.price}</span>
        <div className="flex items-center gap-1 mt-0.5">
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          <span className="text-[11px] font-bold" style={{ color: Z.mid }}>
            {item.rating} · {item.ratingCount} ratings
          </span>
        </div>
      </div>
      <AddButton item={item} />
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────
   BESTSELLER ROW
───────────────────────────────────────────────────────── */
const BestRow = ({ item, rank }: { item: MenuItem; rank: number }) => (
  <div className="menu-row pk">
    <span className="rank-medal">
      {rank <= 3
        ? (["🥇", "🥈", "🥉"] as const)[rank - 1]
        : <span className="text-[12px] font-black" style={{ color: Z.line }}>#{rank}</span>}
    </span>
    <div className="rounded-xl overflow-hidden flex-shrink-0" style={{ width: 60, height: 60 }}>
      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-start gap-1.5">
        <VegDot isVeg={item.isVeg === true} />
        <p className="font-bold text-[13px] leading-tight line-clamp-1" style={{ color: Z.dark }}>{item.name}</p>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
        <span className="text-[11px] font-bold" style={{ color: Z.mid }}>{item.rating}</span>
        <TrendingUp className="w-3 h-3" style={{ color: Z.green }} />
        <span className="text-[10px] font-semibold" style={{ color: Z.green }}>Trending</span>
      </div>
      <p className="text-[13px] font-black mt-1" style={{ color: Z.dark }}>KSh {item.price}</p>
    </div>
    <AddButton item={item} small />
  </div>
);

/* ─────────────────────────────────────────────────────────
   MENU ITEM ROW
───────────────────────────────────────────────────────── */
const MenuRow = ({ item }: { item: MenuItem }) => (
  <div className="menu-row pk">
    <div className="mt-1">
      <VegDot isVeg={item.isVeg === true} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-bold text-[14px] leading-tight" style={{ color: Z.dark }}>{item.name}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
        <span className="text-[11px] font-semibold" style={{ color: Z.mid }}>{item.rating}</span>
        <span style={{ color: Z.line }}>·</span>
        <span className="text-[11px]" style={{ color: Z.muted }}>{item.ratingCount} ratings</span>
      </div>
      <p className="text-[11px] mt-1.5 line-clamp-2" style={{ color: Z.muted, lineHeight: 1.55 }}>
        {item.description}
      </p>
      <p className="text-[14px] font-black mt-2" style={{ color: Z.dark }}>KSh {item.price}</p>
    </div>
    <div className="relative flex-shrink-0 flex flex-col items-center gap-3" style={{ width: 96 }}>
      <div className="rounded-2xl overflow-hidden" style={{ width: 96, height: 96, boxShadow: "0 2px 10px rgba(0,0,0,.1)" }}>
        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
      </div>
      <AddButton item={item} />
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────
   CATEGORY STICKY NAV
───────────────────────────────────────────────────────── */
const CatNav = ({ cats, sel, onPick }: { cats: Category[]; sel: string | null; onPick: (n: string) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sel && ref.current) {
      const el = ref.current.querySelector(`[data-c="${sel}"]`) as HTMLElement;
      el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [sel]);
  return (
    <div ref={ref} className="flex gap-2 px-4 overflow-x-auto hide-sb" style={{ paddingTop: 10, paddingBottom: 10 }}>
      {cats.map(c => (
        <button key={c.id} data-c={c.name}
          className={`cat-pill ${sel === c.name ? "on" : ""}`}
          onClick={() => onPick(c.name)}>
          {c.name}
        </button>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   SKELETON / SPINNER
───────────────────────────────────────────────────────── */
const Skeleton = () => (
  <>
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="menu-row">
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="skel" style={{ height: 13, width: "72%" }} />
          <div className="skel" style={{ height: 11, width: "50%" }} />
          <div className="skel" style={{ height: 11, width: "64%" }} />
          <div className="skel" style={{ height: 13, width: "28%" }} />
        </div>
        <div className="skel flex-shrink-0" style={{ width: 96, height: 96, borderRadius: 16 }} />
      </div>
    ))}
  </>
);

const Spinner = () => (
  <div className="flex flex-col items-center py-14 gap-4">
    <div className="relative w-16 h-16">
      <div className="absolute inset-0 rounded-full border-4 animate-spin"
        style={{ borderColor: `${Z.red}22`, borderTopColor: Z.red }} />
      <div className="absolute inset-0 flex items-center justify-center text-2xl">🍽️</div>
    </div>
    <p className="text-[14px] font-semibold" style={{ color: Z.muted }}>Preparing your experience…</p>
  </div>
);

/* ═══════════════════════════════════════════════════════
   MAIN HOME SCREEN
═══════════════════════════════════════════════════════ */
export default function HomeScreen() {
  const navigate   = useNavigate();
  const location   = useLocation();
  // AFTER
const { isLoggedIn, user, tableNumber: ctxTable, setFullMenu } = useUser();
  const { isVegMode } = useUser();

  /* ── Read table number: URL param → context → default ── */
  const tableNo = (() => {
  const params = new URLSearchParams(location.search);
  const urlTable = params.get("table");
  if (urlTable && /^\d+$/.test(urlTable)) return parseInt(urlTable, 10);

  if (ctxTable) return Number(ctxTable);

  const saved = localStorage.getItem("dineiq_table_number"); // ← fixed key
  if (saved && /^\d+$/.test(saved)) return parseInt(saved, 10);

  return 1;
})();

  const userName = user?.name || user?.email?.split("@")[0] || "Guest";

  /* ── Bridge cartStore to real context cart if available ── */
  const { addItem, removeItem: removeCartItem } = useCart();

useEffect(() => {
  cartStore.setBridge(
    (item) => {
      addItem({
        id:          item.id,
        name:        item.name,
        price:       item.price,
        image:       item.image,
        isVeg:       item.isVeg,
        category:    "",
        description: "",
        rating:      4.5,
        ratingCount: 0,
        tableNumber: tableNo ?? undefined,
      }, true, "HomeScreen");
    },
    (id) => removeCartItem(id, true, "HomeScreen")
  );
}, [addItem, removeCartItem, tableNo]);
    

  /* ── state ── */
  const [offers,            setOffers]            = useState([]);
  const [combos,            setCombos]            = useState<MenuItem[]>([]);
  const [chefSpecials,      setChefSpecials]      = useState<MenuItem[]>([]);
  const [bestsellers,       setBestsellers]       = useState<MenuItem[]>([]);
  const [menuItems,         setMenuItems]         = useState<MenuItem[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<Category[]>([]);
  const [aiCombos,          setAiCombos]          = useState<any[]>([]);
  const [orderHistory,      setOrderHistory]      = useState<string[]>([]);
  const [isLoading,         setIsLoading]         = useState(true);
  const [isAiLoading,       setIsAiLoading]       = useState(false);
  const [activeFilter,      setActiveFilter]      = useState("All");
  const [selectedCategory,  setSelectedCategory]  = useState<string | null>(null);
  const [searchQuery,       setSearchQuery]       = useState("");
  const [showProfile,       setShowProfile]       = useState(false);
  const [activeOrder,       setActiveOrder]       = useState<any>(null);
  const [showBill,          setShowBill]          = useState(false);
  const [showWaiterMsg,     setShowWaiterMsg]     = useState(false);

  useEffect(() => {
    if (!tableNo) return;
    api.fetchActiveOrder(tableNo).then((res: any) => {
      if (res?.order) setActiveOrder(res.order);
    });
  }, [tableNo]);

  const handleCallWaiter = async () => {
    await api.callWaiter(tableNo, userName);
    setShowWaiterMsg(true);
  };

  const handleGetBill = () => {
    if (activeOrder) setShowBill(true);
  };

  const handleOrderStatus = () => {
    document.getElementById("active-order-strip")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /* ══════════════════════════════════════════════════
     DATA LOADING  — all original api.* calls intact
  ══════════════════════════════════════════════════ */
  useEffect(() => {
    if (!isLoggedIn) { navigate("/login"); return; }

    const userEmail = user?.email || "guest@dineiq.com";

    const loadData = async () => {
      setIsLoading(true);
      try {
        /* 1. Offers */
        const offersData = await api.fetchOffers();
        if (offersData?.offers) setOffers(offersData.offers);

        /* 2. Menu */
        const menuData = await api.fetchMenu(userEmail);
        console.log("📥 Menu Data:", menuData);

        if (menuData?.status === "success" && menuData?.menu_sections) {
          const sections = menuData.menu_sections;
          const itemMap  = new Map<string, MenuItem>();
          let chefTemp: MenuItem[] = [];
          let bestTemp: MenuItem[] = [];

          const mapToMenuItem = (item: any, category: string): MenuItem => {
            const base = {
              id:          String(item.Item_ID || item.id || ""),
              name:        item.Item_Name || item.name || "Unknown Item",
              description: item.Item_Description || item.description || "",
              price:       parseFloat(String(item.Current_Price || item.price || 0).replace(/,/g, "")),
              category:    item.Item_Category || category || "Other",
              Image_URL:   item.Image_URL || item.image,
            };
            return {
              ...base,
              image:      getMenuItemImage(item) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
              isVeg:      (item.Is_Veg === true || String(item.Is_Veg).toLowerCase() === "true") ||
                          (item.isVeg  === true || String(item.isVeg).toLowerCase()  === "true"),
              rating:     4.5,
              ratingCount: 100,
              comboItems: item.Combo_Items || [],
              isCombo:    category === "Combos" ||
                          (item.Combo_Items && item.Combo_Items.length > 0) ||
                          Boolean(item.isCombo),
            };
          };

          Object.entries(sections).forEach(([sectionName, items]: [string, any]) => {
            if (!Array.isArray(items)) return;
            items.forEach((item: any) => {
              const itemID = String(item.Item_ID || item.id || "");
              if (!itemID) return;
              const menuItem = mapToMenuItem(item, sectionName);

              if (["Chef Special", "Chef's Recommendations", "Chef's Specials"].includes(sectionName))
                chefTemp.push(menuItem);
              if (["Bestseller", "Bestsellers"].includes(sectionName))
                bestTemp.push(menuItem);

              if (!itemMap.has(itemID)) {
                itemMap.set(itemID, menuItem);
              } else if (!["Chef Special", "Bestseller"].includes(sectionName)) {
                const ex = itemMap.get(itemID)!;
                if (["Chef Special", "Bestseller"].includes(ex.category))
                  itemMap.set(itemID, { ...menuItem, category: sectionName });
              }
            });
          });

          const uniqueAll = Array.from(itemMap.values());
          console.log(`✅ Loaded ${uniqueAll.length} unique items`);

          setFullMenu(uniqueAll);
          setMenuItems(uniqueAll);
          setDynamicCategories(extractDynamicCategories(sections));
          setCombos(buildCombos(uniqueAll));
          setChefSpecials(chefTemp);
          setBestsellers(bestTemp);
        }

        /* 3. Order History — for smart combo personalisation */
        try {
          const historyData = await api.fetchOrderHistory?.(userEmail);
          if (historyData?.orders) {
            const itemIds = historyData.orders
              .flatMap((o: any) => o.items || [])
              .map((i: any) => String(i.Item_ID || i.id || ""))
              .filter(Boolean);
            setOrderHistory(itemIds);
          }
        } catch (_) { /* history optional */ }

        /* 4. AI combos (flag-gated) */
        if (GENERATE_AI_COMBOS) {
          const targetId = user?.id || "";
          console.log("🚀 Fetching AI Combos for:", targetId || "guest");
          setIsAiLoading(true);
          try {
            const aiData = await api.generateCombos(3, targetId);
            console.log("🎁 AI Combo Data Received:", aiData);
            if (aiData?.combos && aiData.combos.length > 0) setAiCombos(aiData.combos);
            else console.warn("⚠️ No AI combos returned");
          } catch (err) {
            console.error("❌ Failed to fetch AI combos:", err);
          } finally {
            setIsAiLoading(false);
          }
        }
      } catch (e) {
        console.error("❌ Error:", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isLoggedIn, navigate, user]);

  /* ── smart combos builder ── */
  const buildCombos = (items: MenuItem[]): MenuItem[] => {
    const r: MenuItem[] = [];
    const f = (k: string) => items.filter(i => i.category.toUpperCase().includes(k));
    const [st, ma, gr, si, bu, pa] = ["STARTER", "MAIN", "GRILL", "SIDE", "BURGER", "PASTA"].map(f);

    if (gr.length && st.length && si.length) {
      const tot = gr[0].price + st[0].price + si[0].price;
      r.push({ id: "combo_grill_feast", name: "Grand Grill Feast", description: `${gr[0].name} • ${st[0].name} • ${si[0].name}`, price: Math.round(tot * .8), image: gr[0].image, isVeg: [gr[0], st[0], si[0]].every(i => i.isVeg === true), category: "Combos", rating: 4.8, ratingCount: 142 });
    }
    if (bu.length && si.length) {
      const tot = bu[0].price + si[0].price;
      r.push({ id: "combo_quick_lunch", name: "Quick Harvest Lunch", description: `${bu[0].name} • ${si[0].name} • Refreshment`, price: Math.round(tot * .85), image: bu[0].image, isVeg: [bu[0], si[0]].every(i => i.isVeg === true), category: "Combos", rating: 4.5, ratingCount: 89 });
    }
    if (pa.length && st.length) {
      const tot = pa[0].price + st[0].price;
      r.push({ id: "combo_italian", name: "Italian Harvest Special", description: `${pa[0].name} • ${st[0].name}`, price: Math.round(tot * .82), image: pa[0].image, isVeg: [pa[0], st[0]].every(i => i.isVeg === true), category: "Combos", rating: 4.7, ratingCount: 112 });
    }
    if (ma.length && st.length) {
      const tot = ma[0].price + st[0].price;
      r.push({ id: "combo_complete_meal", name: "Complete Harvest Meal", description: `${ma[0].name} • ${st[0].name} • Chef's Choice Side`, price: Math.round(tot * .75), image: ma[0].image, isVeg: [ma[0], st[0]].every(i => i.isVeg === true), category: "Combos", rating: 4.9, ratingCount: 201 });
    }
    return r.slice(0, 3);
  };

  /* ── personalised combos: reorder based on history ── */
  const personalisedCombos = useCallback((base: MenuItem[]): { items: MenuItem[]; isPersonalised: boolean } => {
    if (!orderHistory.length) return { items: base, isPersonalised: false };

    const historyCats = new Set(
      menuItems
        .filter(m => orderHistory.includes(m.id))
        .map(m => m.category.toUpperCase())
    );

    const scored = base.map(c => ({
      item: c,
      score: Array.from(historyCats).some(hc => c.description.toUpperCase().includes(hc)) ? 1 : 0,
    }));
    scored.sort((a, b) => b.score - a.score);
    return { items: scored.map(s => s.item), isPersonalised: scored[0]?.score > 0 };
  }, [orderHistory, menuItems]);

  /* ── handlers (original saveLog calls preserved) ── */
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category || null);
    if (category) {
      saveLog(user?.email || "Guest", "CATEGORY_CLICK", category);
      if (["Chef Special", "Chef's Specials"].includes(category)) {
        document.getElementById("chef-recs")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const cat = dynamicCategories.find(c => c.name === category);
      if (cat) document.getElementById(`category-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSearch = useCallback((query: string) => {
    if (query.length >= 3) saveLog(user?.email || "Guest", "SEARCH_ITEM", query);
    setSearchQuery(query);
  }, [user?.email]);

  const handleHeroCta = (slideIndex: number) => {
    saveLog(user?.email || "Guest", "VIEW_MENU_BANNER_CLICK", `Hero CTA slide ${slideIndex}`);
    if (slideIndex === 1) { document.getElementById("chef-recs")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (slideIndex === 2) { document.getElementById("smart-combos")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const firstCat = visibleMenuCats[0];
    if (firstCat) document.getElementById(`category-${firstCat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleBannerClick = (offer: any) => {
    saveLog(user?.email || "Guest", "CHEF_SPECIAL_CARD_CLICK", offer.title);
    setSearchQuery("");
    setTimeout(() => {
      const t = (offer.title || "").toLowerCase();
      const s = (offer.subtitle || "").toLowerCase();
      if (t.includes("combo") || s.includes("combo"))
        document.getElementById("smart-combos")?.scrollIntoView({ behavior: "smooth", block: "center" });
      else if (t.includes("chef") || s.includes("chef") || t.includes("special"))
        document.getElementById("chef-recs")?.scrollIntoView({ behavior: "smooth", block: "center" });
      else if (t.includes("best") || t.includes("seller"))
        document.getElementById("bestsellers-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      else {
        const fc = visibleMenuCats[0];
        if (fc) document.getElementById(`category-${fc.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const handleCheckout = () => {
  saveLog(user?.email || "Guest", "CART_CHECKOUT",
    `${cartStore.totalQty()} items · KSh ${cartStore.totalPrice()}`);
  navigate("/cart");       // ← to this
};

  /* ── filter helpers ── */
  const veg = (arr: MenuItem[]) => isVegMode ? arr.filter(i => i.isVeg === true) : arr;

  const visibleCombos = veg(combos);
  const visibleChef   = veg(chefSpecials);
  const visibleBest   = veg(bestsellers);
  const allFiltered   = veg(menuItems);

  const applyQuickFilter = (arr: MenuItem[]) => {
    if (activeFilter === "Veg")         return arr.filter(i => i.isVeg);
    if (activeFilter === "Bestseller")  return visibleBest.length ? visibleBest : arr;
    if (activeFilter === "Chef's Pick") return visibleChef.length ? visibleChef : arr;
    return arr;
  };

  const displayedItems = searchQuery
    ? allFiltered.filter(i =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.category.toLowerCase().includes(searchQuery.toLowerCase()))
    : applyQuickFilter(allFiltered);

  const menuCats = dynamicCategories.filter(c =>
    !["Chef Special", "Bestseller", "Chef's Recommendations"].includes(c.name) &&
    !(GENERATE_AI_COMBOS && c.name === "Combos")
  );
  const visibleMenuCats = menuCats.filter(c => {
    const items = menuItems.filter(i => i.category === c.name);
    return !isVegMode || items.some(i => i.isVeg === true);
  });

  const { items: smartCombos, isPersonalised } = personalisedCombos(visibleCombos);

  if (!isLoggedIn) return null;

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  return (
    <>
      <GlobalStyle />

      {/* Profile Drawer */}
      {showProfile && (
        <ProfileDrawer
          user={user}
          tableNo={tableNo}
          onClose={() => setShowProfile(false)}
          navigate={navigate}
        />
      )}

      <div style={{ minHeight: "100vh", paddingBottom: 148, background: Z.surface }}>

        {/* ═══ STICKY HEADER ═══ */}
        <div className="sticky top-0 z-50"
          style={{
            background: "rgba(255,255,255,.97)", backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${Z.line}`, boxShadow: "0 1px 0 rgba(0,0,0,.04)",
          }}>
          <EnhancedHeader
            userName={userName}
            tableNo={tableNo}
            searchQuery={searchQuery}
            onSearch={handleSearch}
            onProfile={() => setShowProfile(true)}
          />
        </div>

        {/* ═══ MAIN ═══ */}
        <main>

          {/* ══════════ BROWSE MODE ══════════ */}
          {!searchQuery && (
            <>
              {/* ① Hero Slider */}
              <HeroSlider onCta={handleHeroCta} />

              {/* ② Dine-in context bar */}
<DineInBar
  tableNo={tableNo}
  userName={userName}
  onCallWaiter={handleCallWaiter}
  onGetBill={handleGetBill}
  onOrderStatus={handleOrderStatus}
/>
{activeOrder && (
  <div id="active-order-strip" style={{ marginTop: 8 }}>
    <ActiveOrderBadge order={activeOrder} />
  </div>
)}
              

            
              <div className="sep8" style={{ marginTop: 16 }} />

              {/* ④ OfferCarousel */}
              <div style={{ background: Z.white, paddingTop: 4, paddingBottom: 4 }}>
                <OfferCarousel offers={offers} onBannerClick={handleBannerClick} />
              </div>

              {/* ⑤ Category CAROUSEL */}
              {!isLoading && (
                <div style={{ background: Z.white, paddingTop: 20, paddingBottom: 20 }}>
                  <CategoryCarousel
                    cats={visibleMenuCats}
                    selectedCategory={selectedCategory}
                    onPick={handleCategorySelect}
                  />
                </div>
              )}

              <div className="sep8" />

              {/* ⑥ Smart Combos — personalised if history exists */}
              {!isLoading && !GENERATE_AI_COMBOS && smartCombos.length > 0 && (
                <>
                  <div id="smart-combos" style={{ background: Z.white, paddingTop: 20, paddingBottom: 20 }} className="scroll-mt-24">
                    <div className="flex items-start justify-between px-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="sec-title">Smart Combos</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: Z.redLight, color: Z.red }}>20% OFF</span>
                          {isPersonalised && (
                            <span className="history-badge">
                              <History style={{ width: 9, height: 9 }} />
                              Based on your visits
                            </span>
                          )}
                        </div>
                        <p className="sec-sub">
                          {isPersonalised
                            ? "Curated from your order history"
                            : "Popular combos — save more!"}
                        </p>
                      </div>
                      <button className="flex items-center gap-0.5 text-[13px] font-bold pk" style={{ color: Z.red }}>
                        See all <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex gap-3 px-4 overflow-x-auto hide-sb" style={{ scrollSnapType: "x mandatory", paddingBottom: 4 }}>
                      {smartCombos.map(c => (
                        <SmartComboCard key={c.id} item={c} isPersonalised={isPersonalised} />
                      ))}
                    </div>
                  </div>
                  <div className="sep8" />
                </>
              )}

              {/* ⑦ AI Combos */}
              {GENERATE_AI_COMBOS && (aiCombos.length > 0 || isAiLoading) && (
                <>
                  <div id="ai-combos" style={{ background: Z.white, paddingTop: 20, paddingBottom: 20 }} className="scroll-mt-24">
                    <div className="flex items-center justify-between px-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" style={{ color: Z.red, fill: Z.red }} />
                          <span className="sec-title">AI Harvest Combos</span>
                        </div>
                        <p className="sec-sub">Personalised for your taste</p>
                      </div>
                      <button className="p-2 rounded-full pk"
                        style={{ background: Z.redLight, color: Z.red }}
                        disabled={isAiLoading}
                        onClick={async () => {
                          if (!user?.id) return;
                          setIsAiLoading(true);
                          const d = await api.generateCombos(3, user.id);
                          if (d?.combos) setAiCombos(d.combos);
                          setIsAiLoading(false);
                        }}>
                        <RefreshCw className={`w-4 h-4 ${isAiLoading ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                    <div className="flex gap-3 px-4 overflow-x-auto hide-sb" style={{ paddingBottom: 4 }}>
                      {isAiLoading
                        ? [1, 2].map(i => <div key={i} className="skel flex-shrink-0" style={{ width: 200, height: 180, borderRadius: 16 }} />)
                        : aiCombos.map(c => <AIComboCard key={c.Item_ID} combo={c} />)}
                    </div>
                  </div>
                  <div className="sep8" />
                </>
              )}

              {/* ⑧ Chef's Specials */}
              {!isLoading && visibleChef.length > 0 && (
                <>
                  <div id="chef-recs" style={{ background: Z.white, paddingTop: 20, paddingBottom: 20 }} className="scroll-mt-24">
                    <SecHeader title="Chef's Specials" sub="Premium dishes handpicked for you" onAll={() => {}} />
                    <div className="flex gap-3 px-4 overflow-x-auto hide-sb" style={{ scrollSnapType: "x mandatory", paddingBottom: 4 }}>
                      {visibleChef.map(item => <ChefCard key={item.id} item={item} />)}
                    </div>
                  </div>
                  <div className="sep8" />
                </>
              )}

              {/* ⑨ Bestsellers */}
              {!isLoading && visibleBest.length > 0 && (
                <>
                  <div id="bestsellers-section" style={{ background: Z.white, paddingTop: 20 }} className="scroll-mt-24">
                    <SecHeader title="Bestsellers" sub="Most loved dishes right now" badge="🔥 Trending" onAll={() => {}} />
                    {visibleBest.map((item, i) => <BestRow key={item.id} item={item} rank={i + 1} />)}
                  </div>
                  <div className="sep8" />
                </>
              )}

              {/* ⑩ Filter pills */}
              {!isLoading && (
                <div style={{ background: Z.white, borderBottom: `1px solid ${Z.line}` }}>
                  <FilterPills active={activeFilter} onChange={setActiveFilter} />
                </div>
              )}

              {/* ⑪ Sticky category pill nav */}
              {!isLoading && (
                <div className="sticky z-40"
                  style={{
                    top: 57, background: "rgba(255,255,255,.97)", backdropFilter: "blur(8px)",
                    borderBottom: `1px solid ${Z.line}`, boxShadow: "0 1px 0 rgba(0,0,0,.04)",
                  }}>
                  <CatNav cats={visibleMenuCats} sel={selectedCategory} onPick={handleCategorySelect} />
                </div>
              )}
            </>
          )}

          {/* ══════════ LOADING ══════════ */}
          {isLoading && (
            <div style={{ background: Z.white }}>
              <Spinner />
              <Skeleton />
            </div>
          )}

          {/* ══════════ SEARCH RESULTS ══════════ */}
          {!isLoading && searchQuery && (
            <>
              <div className="search-banner">
                <Search className="w-4 h-4 flex-shrink-0" style={{ color: Z.muted }} />
                <span className="text-[13px] font-semibold" style={{ color: Z.mid }}>
                  Results for <strong style={{ color: Z.dark }}>"{searchQuery}"</strong>
                </span>
                <span className="ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: Z.redLight, color: Z.red }}>
                  {displayedItems.length} items
                </span>
                <button className="pk text-[12px] font-bold" style={{ color: Z.red }}
                  onClick={() => setSearchQuery("")}>Clear</button>
              </div>

              {displayedItems.length > 0
                ? <div style={{ background: Z.white }}>
                    {displayedItems.map(item => <MenuRow key={item.id} item={item} />)}
                  </div>
                : (
                  <div className="empty-state">
                    <span style={{ fontSize: 60 }}>🍽️</span>
                    <p className="text-[18px] font-black" style={{ color: Z.dark }}>No dishes found</p>
                    <p className="text-[13px]" style={{ color: Z.muted }}>Try a different keyword</p>
                    <button className="pk mt-2 px-6 py-2.5 rounded-full font-bold text-[13px] text-white"
                      style={{ background: Z.red, boxShadow: `0 4px 16px ${Z.red}44` }}
                      onClick={() => setSearchQuery("")}>Clear Search</button>
                  </div>
                )}
            </>
          )}

          {/* ══════════ DYNAMIC MENU CATEGORIES ══════════ */}
          {!isLoading && !searchQuery && visibleMenuCats.map(category => {
            const catItems = menuItems.filter(i => i.category === category.name);
            const visible  = veg(catItems);
            if (visible.length === 0) return null;
            return (
              <div key={category.id} id={`category-${category.id}`} className="scroll-mt-28">
                <div style={{ background: Z.white, paddingTop: 20, paddingBottom: 8 }}>
                  <SecHeader title={category.name} sub={category.tagline} onAll={() => {}} />
                  {visible.map(item => <MenuRow key={item.id} item={item} />)}
                </div>
                <div className="sep8" />
              </div>
            );
          })}

        </main>

        {/* ── AI Button ── */}
        <div className="cursor-pointer"
          role="button" tabIndex={0}
          onClick={() => saveLog(user?.email || "Guest", "CLICK_AI_BUTTON", "User opened AI Assistant")}
          onKeyDown={e => e.key === "Enter" && saveLog(user?.email || "Guest", "CLICK_AI_BUTTON", "User opened AI Assistant")}>
          <AIButton />
        </div>

      </div>

      {/* ═══ ENHANCED CART BAR — replaces old <CartBar /> ═══ */}
      <EnhancedCartBar tableNo={tableNo} onCheckout={handleCheckout} />

      {showWaiterMsg && (
        <WaiterToast onDone={() => setShowWaiterMsg(false)} />
      )}

      {showBill && activeOrder && (
        <BillModal
          order={activeOrder}
          tableNo={tableNo}
          onClose={() => setShowBill(false)}
        />
      )}
    </>
  );
}
