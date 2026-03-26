import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useUser } from "@/contexts/UserContext";
import OfflineImage from "./OfflineImage";
import {
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
} from "lucide-react";

const Z = {
  red: "#E23744",
  redDark: "#C0303C",
};

export default function CartBar() {
  const navigate = useNavigate();
  const { tableNumber } = useUser();
  const { items, totalItems, totalPrice, updateQuantity, removeItem, clearCart } = useCart();

  const [expanded, setExpanded] = useState(false);
  const [badgeKey, setBadgeKey] = useState(0);
  const prevQty = useRef(0);

  useEffect(() => {
    if (totalItems !== prevQty.current) {
      setBadgeKey((key) => key + 1);
      prevQty.current = totalItems;
    }
  }, [totalItems]);

  if (totalItems === 0) return null;

  const tableNo = tableNumber || localStorage.getItem("dineiq_table_number") || "1";

  return (
    <div className="cart-bar-root pointer-events-none fixed bottom-0 left-0 right-0 z-[60] px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-4">
      <style>{`
        @keyframes cartSlideUp {
          from { transform: translateY(110%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes badgePop {
          0% { transform: scale(1); }
          40% { transform: scale(1.6); }
          70% { transform: scale(0.88); }
          100% { transform: scale(1); }
        }
        @keyframes cartItemIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .cart-bar-pill {
          pointer-events: all;
          border-radius: 22px;
          overflow: hidden;
          box-shadow:
            0 -1px 0 rgba(0,0,0,0.04),
            0 8px 40px rgba(226,55,68,0.30),
            0 24px 64px rgba(0,0,0,0.18);
          animation: cartSlideUp 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
          max-width: 640px;
          margin: 0 auto;
          font-family: 'DM Sans', sans-serif;
        }
        .cart-collapsed {
          background: linear-gradient(135deg, ${Z.red} 0%, ${Z.redDark} 100%);
        }
        .cart-badge-pop {
          animation: badgePop 0.35s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
        .hide-sb::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="cart-bar-pill">
        {expanded && (
          <div className="cart-sheet bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-[#F7F7F7] p-4 pb-2">
              <div className="flex min-w-0 items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-[#E23744]" />
                <span className="truncate text-sm font-extrabold text-[#1C1C1C]">Your Order</span>
                <span className="rounded-full bg-[#FFF1F2] px-2 py-0.5 text-[11px] font-bold text-[#E23744]">
                  Table {tableNo}
                </span>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F7F7F7] text-[#696969]"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <div className="hide-sb max-h-[264px] overflow-y-auto">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 border-b border-[#F7F7F7] p-3 px-4 animate-[cartItemIn_0.2s_ease_both]"
                  style={{ animationDelay: `${index * 0.04}s` }}
                >
                  <div
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border-[1.5px] ${
                      item.isVeg ? "border-[#1BA672]" : "border-[#C8102E]"
                    }`}
                  >
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.isVeg ? "bg-[#1BA672]" : "bg-[#C8102E]"
                      }`}
                    />
                  </div>

                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                    <OfflineImage src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[#1C1C1C]">{item.name}</p>
                    <p className="mt-0.5 text-xs text-[#9E9E9E]">
                      KSh {item.price} x {item.quantity}{" "}
                      <strong className="text-[#1C1C1C]">
                        = KSh {(item.price * item.quantity).toLocaleString()}
                      </strong>
                    </p>
                  </div>

                  <div className="hidden items-center gap-1.5 rounded-lg bg-[#E23744] p-1.5 shadow-sm sm:flex">
                    <button
                      className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-white/20 text-white"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="min-w-[14px] text-center text-[13px] font-black text-white">
                      {item.quantity}
                    </span>
                    <button
                      className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-white/20 text-white"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  <div className="flex flex-col items-end gap-1 sm:hidden">
                    <div className="flex items-center gap-1 rounded-lg bg-[#E23744] p-1 shadow-sm">
                      <button
                        className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-white/20 text-white"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-2.5 w-2.5" />
                      </button>
                      <span className="min-w-[12px] text-center text-[12px] font-black text-white">
                        {item.quantity}
                      </span>
                      <button
                        className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-white/20 text-white"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-[#9E9E9E] transition-colors hover:text-[#E23744]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="hidden p-1 text-[#9E9E9E] transition-colors hover:text-[#E23744] sm:block"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#F7F7F7] bg-[#F8F8F8] p-4 py-2.5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#9E9E9E]">
                  {totalItems} item{totalItems > 1 ? "s" : ""} · To pay
                </p>
                <p className="truncate text-lg font-black text-[#1C1C1C]">
                  KSh {totalPrice.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => {
                  clearCart();
                  setExpanded(false);
                }}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-[#EFEFEF] bg-white px-3 py-2 text-xs font-bold text-[#696969] active:bg-gray-50"
              >
                <Trash2 className="h-3 w-3" /> Clear all
              </button>
            </div>

            <button
              onClick={() => {
                setExpanded(false);
                navigate("/cart");
              }}
              className="flex w-full items-center justify-center gap-2 bg-gradient-to-r from-[#E23744] to-[#C0303C] p-4 text-sm font-black text-white transition-opacity active:opacity-90"
            >
              <ShoppingBag className="h-4.5 w-4.5" />
              Place Order · KSh {totalPrice.toLocaleString()}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {!expanded && (
          <div
            className="cart-collapsed flex cursor-pointer items-center justify-between gap-3 p-3.5 px-4"
            onClick={() => setExpanded(true)}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative">
                <div className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-white/30 bg-white/20">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <div
                  key={badgeKey}
                  className="cart-badge-pop absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-black text-[#E23744] shadow-sm"
                >
                  {totalItems}
                </div>
              </div>

              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold leading-none text-white/70">
                  {totalItems} item{totalItems > 1 ? "s" : ""} · Table {tableNo}
                </p>
                <p className="mt-1 truncate text-[15px] font-black leading-tight text-white sm:text-[17px]">
                  KSh {totalPrice.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/30 bg-white/20 px-3 py-2 transition-colors active:bg-white/30 sm:px-3.5">
              <span className="text-[12px] font-extrabold text-white sm:text-[13px]">View Cart</span>
              <ChevronUp className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
