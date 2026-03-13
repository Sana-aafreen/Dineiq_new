import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useUser } from "@/contexts/UserContext";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/api";
import {
  ArrowLeft, Minus, Plus, Trash2, ChefHat, Receipt,
  CreditCard, Sparkles, Ticket, Star, ShoppingBag,
  ChevronRight, Tag, Flame, Clock
} from "lucide-react";
import { saveLog } from "@/utils/logger";
import { getMenuItemImage } from "@/lib/categoryUtils";

const GENERATE_AI_COMBOS = false;

/* ── Design tokens (mirrors HomeScreen) ── */
const Z = {
  red:       "#E23744",
  redDark:   "#C0303C",
  redLight:  "#FFF1F2",
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
};

const PageStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
    * { box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; }

    .cart-page { background: ${Z.surface}; min-height: 100vh; padding-bottom: 140px; }

    /* Header */
    .cp-header {
      background: linear-gradient(135deg, #1A1A1A 0%, #2C1A0E 100%);
      padding: 52px 16px 18px;
      position: sticky; top: 0; z-index: 50;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .cp-header::before {
      content: '';
      position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(circle at 80% 50%, rgba(226,55,68,.18) 0%, transparent 60%);
    }

    /* Cart item card */
    .ci-card {
      background: ${Z.white};
      border-radius: 20px;
      padding: 14px;
      display: flex;
      gap: 12px;
      border: 1.5px solid ${Z.line};
      box-shadow: 0 2px 12px rgba(0,0,0,.05);
      transition: box-shadow .2s;
    }
    .ci-card:active { box-shadow: 0 4px 20px rgba(0,0,0,.1); }

    /* Qty control */
    .qty-ctrl {
      display: flex; align-items: center; gap: 6px;
      background: ${Z.red}; border-radius: 12px;
      padding: 5px 8px;
      box-shadow: 0 4px 12px rgba(226,55,68,.3);
    }
    .qty-btn {
      width: 22px; height: 22px; border-radius: 7px;
      background: rgba(255,255,255,.22); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center; color: #fff;
      transition: background .12s;
    }
    .qty-btn:active { background: rgba(255,255,255,.4); }

    /* Section card */
    .sec-card {
      background: ${Z.white};
      border-radius: 20px;
      border: 1.5px solid ${Z.line};
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0,0,0,.04);
    }

    /* Coupon */
    .coupon-row {
      border-radius: 14px;
      padding: 12px 14px;
      display: flex; align-items: center; justify-content: space-between;
      cursor: pointer;
      transition: all .15s;
      border: 1.5px dashed ${Z.line};
      background: ${Z.white};
    }
    .coupon-row.applied {
      border-color: ${Z.green};
      background: ${Z.greenBg};
    }

    /* Bill row */
    .bill-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid ${Z.lineLight};
      font-size: 13px;
    }
    .bill-row:last-child { border-bottom: none; }

    /* Bottom bar */
    .cp-bottom {
      position: fixed; bottom: 0; left: 0; right: 0;
      z-index: 100;
      background: ${Z.white};
      border-top: 1px solid ${Z.line};
      padding: 14px 16px max(env(safe-area-inset-bottom), 14px);
      box-shadow: 0 -8px 32px rgba(0,0,0,.08);
    }
    .cp-checkout-btn {
      width: 100%; padding: 16px; border: none; cursor: pointer;
      background: linear-gradient(135deg, ${Z.red} 0%, ${Z.redDark} 100%);
      color: #fff; font-size: 15px; font-weight: 900;
      font-family: 'DM Sans', sans-serif;
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 6px 20px rgba(226,55,68,.35);
      transition: opacity .15s, transform .12s;
    }
    .cp-checkout-btn:active { opacity: .9; transform: scale(.98); }

    /* Rec card */
    .rec-card {
      flex-shrink: 0; width: 140px;
      background: ${Z.white};
      border-radius: 16px;
      border: 1.5px solid ${Z.line};
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,.06);
      scroll-snap-align: start;
    }

    /* Empty */
    .empty-wrap {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 70vh; gap: 12px; text-align: center; padding: 24px;
    }

    @keyframes fadeUp {
      from { opacity:0; transform:translateY(12px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .fu { animation: fadeUp .35s ease both; }
    .fu1 { animation: fadeUp .35s .06s ease both; }
    .fu2 { animation: fadeUp .35s .12s ease both; }
    .fu3 { animation: fadeUp .35s .18s ease both; }

    .hide-sb { scrollbar-width:none; }
    .hide-sb::-webkit-scrollbar { display:none; }
    .pk { cursor:pointer; transition:transform .12s; }
    .pk:active { transform: scale(.96); }
  `}</style>
);

export default function CartPage() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, totalPrice, addItem } = useCart();
  const { tableNumber, user } = useUser();
  const [instructions, setInstructions]   = useState("");
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [nudge, setNudge]                 = useState<any>(null);
  const [upsells, setUpsells]             = useState<any>({});
  const [coupons, setCoupons]             = useState<any[]>([]);
  const [aiCombos, setAiCombos]           = useState<any[]>([]);
  const [showCoupons, setShowCoupons]     = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);

  useEffect(() => {
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      api.fetchRecommendations(user?.email || "", lastItem.id).then(res => {
        if (res?.smart_recommendations)
          setRecommendations(res.smart_recommendations.add_ons || []);
      });
      const simpleCart = items.map(i => ({
        Item_ID: i.id, Current_Price: i.price,
        quantity: i.quantity, category: i.category,
      }));
      api.getPricingStrategy(user?.email || "", simpleCart).then(res => {
        if (res?.pricing?.upsell_nudge) setNudge(res.pricing.upsell_nudge);
      });
      api.fetchUpsellItems().then(res => { if (res?.upsells) setUpsells(res.upsells); });
      api.fetchCoupons().then(res => { if (res?.coupons) setCoupons(res.coupons); });
      if (GENERATE_AI_COMBOS) {
        api.generateCombos(2, user?.email || "").then(res => {
          if (res?.combos) setAiCombos(res.combos);
        });
      }
    } else {
      setRecommendations([]); setNudge(null);
    }
  }, [items.length, user?.email]);

  useEffect(() => {
    if (selectedCoupon && totalPrice < (selectedCoupon.minOrderValue || 0))
      setSelectedCoupon(null);
    if (selectedCoupon)
      saveLog(user?.email || "Guest", "COUPON_APPLIED", `Coupon: ${selectedCoupon.code}`);
  }, [totalPrice, selectedCoupon, user?.email]);

  const handleAddRecommendation = (rec: any) => {
    saveLog(user?.email || "Guest", "REC_OPTED", `Item: ${rec.Item_Name}`);
    addItem({
      id: rec.Item_ID, name: rec.Item_Name, price: rec.Current_Price,
      image: rec.Image_URL || "https://images.unsplash.com/photo-1544145945-f90425340c7e",
      isVeg: rec.Is_Veg !== undefined ? rec.Is_Veg : true,
      category: rec.Category || "Add-ons",
      description: rec.Item_Description || "", rating: 4.5, ratingCount: 10,
    }, true);
  };

  const taxes        = Math.round(totalPrice * 0.05);
  const grandTotal   = totalPrice + taxes;
  const getDiscount  = (c: any, p: number) => {
    if (!c) return 0;
    if (c.type === "flat") return c.discountAmount || 0;
    if (c.type === "percent" || c.type === "tiered")
      return Math.round(p * ((c.discountPercent || 0) / 100));
    return 0;
  };
  const discountValue = selectedCoupon ? getDiscount(selectedCoupon, totalPrice) : 0;
  const finalTotal    = Math.max(0, grandTotal - discountValue);

  const handleProceedToPayment = () => {
    navigate("/payment", {
      state: { totalAmount: finalTotal, cartItems: items, tableNumber, instructions },
    });
  };

  /* ── EMPTY STATE ── */
  if (items.length === 0) {
    return (
      <>
        <PageStyle />
        <div className="cart-page">
          {/* Header */}
          <div className="cp-header">
            <div style={{ display:"flex", alignItems:"center", gap:12, position:"relative" }}>
              <button onClick={() => navigate("/home")} style={{
                width:38, height:38, borderRadius:12,
                background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.2)",
                display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
              }}>
                <ArrowLeft style={{ width:18, height:18, color:"#fff" }} />
              </button>
              <span style={{ fontSize:18, fontWeight:800, color:"#fff" }}>Your Cart</span>
            </div>
          </div>

          <div className="empty-wrap fu">
            <div style={{
              width:90, height:90, borderRadius:99,
              background: Z.redLight,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:44, marginBottom:8,
            }}>🛒</div>
            <p style={{ fontSize:20, fontWeight:800, color:Z.dark }}>Cart is empty</p>
            <p style={{ fontSize:13, color:Z.muted, maxWidth:240 }}>
              Add delicious items from our menu to get started
            </p>
            <button onClick={() => navigate("/home")} style={{
              marginTop:8, padding:"13px 32px", borderRadius:14,
              background:`linear-gradient(135deg, ${Z.red}, ${Z.redDark})`,
              color:"#fff", fontWeight:800, fontSize:14, border:"none", cursor:"pointer",
              boxShadow:`0 6px 20px rgba(226,55,68,.35)`,
            }}>
              Browse Menu
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ── MAIN RENDER ── */
  return (
    <>
      <PageStyle />
      <div className="cart-page">

        {/* ── HEADER ── */}
        <div className="cp-header">
          <div style={{ display:"flex", alignItems:"center", gap:12, position:"relative" }}>
            <button onClick={() => navigate("/home")} style={{
              width:38, height:38, borderRadius:12,
              background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.2)",
              display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
            }}>
              <ArrowLeft style={{ width:18, height:18, color:"#fff" }} />
            </button>
            <div>
              <p style={{ fontSize:18, fontWeight:800, color:"#fff", lineHeight:1.2 }}>Your Cart</p>
              <p style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:1 }}>
                {items.length} item{items.length > 1 ? "s" : ""} · Table {tableNumber}
              </p>
            </div>
            <div style={{
              marginLeft:"auto", padding:"5px 12px", borderRadius:99,
              background:"rgba(226,55,68,.22)", border:"1px solid rgba(226,55,68,.4)",
            }}>
              <span style={{ fontSize:12, fontWeight:700, color:"#FF8B94" }}>
                KSh {totalPrice.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:12 }}>

          {/* ── CART ITEMS ── */}
          <div className="fu" style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {items.map((item, idx) => (
              <div key={item.id} className="ci-card" style={{ animationDelay:`${idx * 0.05}s` }}>
                {/* Image */}
                <div style={{ width:80, height:80, borderRadius:14, overflow:"hidden", flexShrink:0 }}>
                  <img
                    src={getMenuItemImage(item)} alt={item.name}
                    style={{ width:"100%", height:"100%", objectFit:"cover" }}
                  />
                </div>

                {/* Details */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:6 }}>
                    <div style={{ minWidth:0 }}>
                      {/* Veg dot + name */}
                      <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                        <div style={{
                          width:13, height:13, borderRadius:3, flexShrink:0,
                          border:`2px solid ${item.isVeg ? Z.green : "#C8102E"}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}>
                          <div style={{
                            width:6, height:6, borderRadius:"50%",
                            background: item.isVeg ? Z.green : "#C8102E",
                          }} />
                        </div>
                        <p style={{
                          fontSize:13, fontWeight:700, color:Z.dark,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                        }}>{item.name}</p>
                      </div>
                      <p style={{ fontSize:15, fontWeight:900, color:Z.dark }}>
                        KSh {(item.price * item.quantity).toLocaleString()}
                      </p>
                      <p style={{ fontSize:11, color:Z.muted, marginTop:1 }}>
                        KSh {item.price} × {item.quantity}
                      </p>
                    </div>
                    {/* Remove */}
                    <button onClick={() => removeItem(item.id)} style={{
                      background:Z.lineLight, border:"none", cursor:"pointer",
                      width:28, height:28, borderRadius:8, flexShrink:0,
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      <Trash2 style={{ width:13, height:13, color:Z.muted }} />
                    </button>
                  </div>

                  {/* Qty */}
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
                    <div className="qty-ctrl">
                      <button className="qty-btn" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                        <Minus style={{ width:11, height:11 }} />
                      </button>
                      <span style={{ fontSize:13, fontWeight:900, color:"#fff", minWidth:16, textAlign:"center" }}>
                        {item.quantity}
                      </span>
                      <button className="qty-btn" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                        <Plus style={{ width:11, height:11 }} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── RECOMMENDATIONS ── */}
          {recommendations.length > 0 && (() => {
            const seen = new Set<string>();
            const uniq = recommendations.filter(r => {
              if (seen.has(r.Item_ID)) return false;
              seen.add(r.Item_ID); return true;
            });
            return (
              <div className="fu1">
                <p style={{ fontSize:13, fontWeight:800, color:Z.dark, marginBottom:10 }}>
                  🍽️ Pairs well with your order
                </p>
                <div className="hide-sb" style={{ display:"flex", gap:10, overflowX:"auto", scrollSnapType:"x mandatory", paddingBottom:4 }}>
                  {uniq.map(rec => (
                    <div key={rec.Item_ID} className="rec-card">
                      <div style={{ position:"relative", height:90 }}>
                        <img src={getMenuItemImage(rec)} alt={rec.Item_Name}
                          style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        <div style={{
                          position:"absolute", top:6, right:6,
                          fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:6,
                          background: rec.Is_Veg ? Z.greenBg : "#FFF0F0",
                          color: rec.Is_Veg ? Z.green : Z.red,
                        }}>{rec.Is_Veg ? "VEG" : "NON"}</div>
                      </div>
                      <div style={{ padding:"8px 10px 10px" }}>
                        <p style={{ fontSize:12, fontWeight:700, color:Z.dark, marginBottom:2 }}
                          className="line-clamp-1">{rec.Item_Name}</p>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <span style={{ fontSize:12, fontWeight:800, color:Z.dark }}>KSh {rec.Current_Price}</span>
                          <button onClick={() => handleAddRecommendation(rec)} style={{
                            padding:"4px 10px", borderRadius:8, fontSize:10, fontWeight:800,
                            background:Z.red, color:"#fff", border:"none", cursor:"pointer",
                          }}>ADD</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── COUPON ── */}
          <div className="fu2">
            <div
              className={`coupon-row ${selectedCoupon ? "applied" : ""}`}
              onClick={() => setShowCoupons(v => !v)}
            >
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{
                  width:36, height:36, borderRadius:10,
                  background: selectedCoupon ? Z.greenBg : Z.redLight,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <Tag style={{ width:16, height:16, color: selectedCoupon ? Z.green : Z.red }} />
                </div>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:Z.dark }}>
                    {selectedCoupon ? `✅ ${selectedCoupon.code} Applied` : "Apply Coupon"}
                  </p>
                  <p style={{ fontSize:11, color:Z.muted }}>
                    {selectedCoupon
                      ? `Saving KSh ${discountValue}`
                      : "Unlock exclusive deals"}
                  </p>
                </div>
              </div>
              {selectedCoupon ? (
                <button onClick={e => { e.stopPropagation(); setSelectedCoupon(null); }}
                  style={{ fontSize:11, fontWeight:700, color:Z.red, background:"none", border:"none", cursor:"pointer" }}>
                  Remove
                </button>
              ) : (
                <ChevronRight style={{ width:16, height:16, color:Z.muted }} />
              )}
            </div>

            {/* Tiered progress */}
            {!selectedCoupon && coupons.length > 0 && (() => {
              const next = coupons.find(c => c.type === "tiered" && (c.minOrderValue || 0) > totalPrice);
              if (!next) return null;
              const diff = (next.minOrderValue || 0) - totalPrice;
              const pct  = Math.min(100, (totalPrice / (next.minOrderValue || 0)) * 100);
              return (
                <div style={{ marginTop:10, padding:"0 4px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:11, color:Z.muted }}>
                      Add <strong style={{ color:Z.dark }}>KSh {diff}</strong> for{" "}
                      <strong style={{ color:Z.red }}>{next.discountPercent}% OFF</strong>
                    </span>
                    <span style={{ fontSize:11, color:Z.muted }}>{Math.round(pct)}%</span>
                  </div>
                  <div style={{ height:5, borderRadius:99, background:Z.line, overflow:"hidden" }}>
                    <div style={{
                      height:"100%", borderRadius:99, width:`${pct}%`,
                      background:`linear-gradient(90deg, ${Z.red}, ${Z.amber})`,
                      transition:"width .4s ease",
                    }} />
                  </div>
                </div>
              );
            })()}

            {/* Coupon list */}
            {showCoupons && (
              <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:8 }}>
                {coupons.filter(c => c.type === "tiered").map((coupon, i) => {
                  const locked = totalPrice < (coupon.minOrderValue || 0);
                  return (
                    <div key={i} style={{
                      borderRadius:14, padding:"12px 14px",
                      background: locked ? Z.surface : Z.white,
                      border:`1.5px solid ${locked ? Z.line : Z.green}`,
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      opacity: locked ? 0.65 : 1,
                    }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                          <span style={{
                            fontSize:11, fontWeight:800, padding:"2px 8px", borderRadius:6,
                            background: locked ? Z.line : Z.greenBg,
                            color: locked ? Z.muted : Z.green,
                          }}>{coupon.code}</span>
                          {locked && <span style={{ fontSize:10, color:Z.red, fontWeight:700 }}>🔒 Locked</span>}
                        </div>
                        <p style={{ fontSize:11, color:Z.muted }}>{coupon.title}</p>
                      </div>
                      {locked ? (
                        <span style={{ fontSize:10, color:Z.muted }}>Add KSh {(coupon.minOrderValue || 0) - totalPrice}</span>
                      ) : (
                        <button onClick={() => { setSelectedCoupon(coupon); setShowCoupons(false); }}
                          style={{
                            padding:"6px 14px", borderRadius:10, fontSize:11, fontWeight:800,
                            background: selectedCoupon?.id === coupon.id ? Z.greenBg : Z.red,
                            color: selectedCoupon?.id === coupon.id ? Z.green : "#fff",
                            border:"none", cursor:"pointer",
                          }}>
                          {selectedCoupon?.id === coupon.id ? "APPLIED" : "APPLY"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── COOKING INSTRUCTIONS ── */}
          <div className="fu2 sec-card">
            <div style={{ padding:"14px 16px", borderBottom:`1px solid ${Z.lineLight}`, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{
                width:34, height:34, borderRadius:10,
                background:"rgba(245,158,11,.12)", border:"1px solid rgba(245,158,11,.2)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <ChefHat style={{ width:16, height:16, color:Z.amber }} />
              </div>
              <p style={{ fontSize:14, fontWeight:700, color:Z.dark }}>Cooking Instructions</p>
            </div>
            <div style={{ padding:"12px 16px" }}>
              <Textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="e.g., Less spicy, No onions, Extra sauce…"
                style={{
                  background:Z.surface, border:`1.5px solid ${Z.line}`,
                  borderRadius:12, fontSize:13, color:Z.dark, resize:"none",
                  outline:"none", padding:"10px 12px",
                  fontFamily:"'DM Sans', sans-serif",
                }}
                rows={3}
              />
            </div>
          </div>

          {/* ── BILL DETAILS ── */}
          <div className="fu3 sec-card">
            {/* Header */}
            <div style={{
              padding:"14px 16px", display:"flex", alignItems:"center", gap:8,
              borderBottom:`1px solid ${Z.lineLight}`,
              background:"linear-gradient(135deg, #1A1A1A, #2C1A0E)",
            }}>
              <div style={{
                width:34, height:34, borderRadius:10,
                background:"rgba(226,55,68,.2)", border:"1px solid rgba(226,55,68,.3)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <Receipt style={{ width:16, height:16, color:"#FF8B94" }} />
              </div>
              <p style={{ fontSize:14, fontWeight:700, color:"#fff" }}>Bill Details</p>
            </div>

            <div style={{ padding:"4px 16px 8px" }}>
              {[
                { label:"Item Total",       val:`KSh ${totalPrice.toLocaleString()}`,  accent:false },
                { label:"GST & Taxes (5%)", val:`KSh ${taxes.toLocaleString()}`,        accent:false },
                { label:"Delivery Fee",     val:"FREE",                                 accent:true  },
              ].map(({ label, val, accent }) => (
                <div key={label} className="bill-row">
                  <span style={{ color:Z.muted }}>{label}</span>
                  <span style={{ fontWeight:700, color: accent ? Z.green : Z.charcoal }}>{val}</span>
                </div>
              ))}

              {selectedCoupon && (
                <div className="bill-row" style={{ color:Z.green }}>
                  <span style={{ fontWeight:600 }}>Coupon ({selectedCoupon.code})</span>
                  <span style={{ fontWeight:800 }}>−KSh {discountValue}</span>
                </div>
              )}

              {/* Grand total */}
              <div style={{
                marginTop:8, padding:"14px 16px", borderRadius:14, marginLeft:-16, marginRight:-16,
                background:"linear-gradient(135deg, #1A1A1A, #2C1A0E)",
                display:"flex", justifyContent:"space-between", alignItems:"center",
              }}>
                <span style={{ fontSize:15, fontWeight:800, color:"#fff" }}>Grand Total</span>
                <div style={{ textAlign:"right" }}>
                  {selectedCoupon && (
                    <p style={{ fontSize:11, color:"rgba(255,255,255,.4)", textDecoration:"line-through" }}>
                      KSh {grandTotal.toLocaleString()}
                    </p>
                  )}
                  <p style={{ fontSize:20, fontWeight:900, color:"#FF8B94" }}>
                    KSh {finalTotal.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>{/* /padding wrapper */}

        {/* ── BOTTOM BAR ── */}
        <div className="cp-bottom">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div>
              <p style={{ fontSize:11, color:Z.muted, fontWeight:600 }}>
                {items.length} item{items.length > 1 ? "s" : ""} · Table #{tableNumber}
              </p>
              <p style={{ fontSize:20, fontWeight:900, color:Z.dark }}>
                KSh {finalTotal.toLocaleString()}
              </p>
            </div>
            {selectedCoupon && (
              <div style={{
                padding:"4px 10px", borderRadius:99,
                background:Z.greenBg, border:`1px solid ${Z.green}`,
              }}>
                <span style={{ fontSize:11, fontWeight:700, color:Z.green }}>
                  Saving KSh {discountValue}
                </span>
              </div>
            )}
          </div>
          <button className="cp-checkout-btn" onClick={handleProceedToPayment}>
            <CreditCard style={{ width:18, height:18 }} />
            Proceed to Payment
            <ChevronRight style={{ width:16, height:16 }} />
          </button>
        </div>

      </div>
    </>
  );
}