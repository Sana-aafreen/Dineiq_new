import { useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { useUser } from "@/contexts/UserContext";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/api";
import { toast } from "sonner";
import StripeDummyModal from "@/components/StripeDummyModal";
import CashDummyModal from "@/components/CashDummyModal";
import { saveLog } from "@/utils/logger";
import {
  ArrowLeft, Wallet, CreditCard, Banknote,
  ShieldCheck, ChevronRight, CheckCircle2, Clock,
} from "lucide-react";

const stripePromise = loadStripe("pk_test_YOUR_STRIPE_PUBLIC_KEY");

/* ── Design tokens ── */
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
};

const PageStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
    * { box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; }

    .pay-page {
      background: ${Z.surface};
      min-height: 100vh;
      padding-bottom: 120px;
    }

    /* Header */
    .pay-header {
      background: linear-gradient(135deg, #1A1A1A 0%, #2C1A0E 100%);
      padding: 52px 16px 20px;
      position: sticky; top: 0; z-index: 50;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .pay-header::before {
      content: '';
      position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(circle at 20% 50%, rgba(245,158,11,.15) 0%, transparent 55%);
    }

    /* Amount hero card */
    .amount-card {
      background: linear-gradient(135deg, #1A1A1A 0%, #2C1A0E 100%);
      border-radius: 24px;
      padding: 24px 20px;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.08);
    }
    .amount-card::before {
      content: '';
      position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(circle at 90% 10%, rgba(226,55,68,.25) 0%, transparent 50%),
        radial-gradient(circle at 10% 90%, rgba(245,158,11,.15) 0%, transparent 50%);
    }

    /* Payment option */
    .pay-option {
      border-radius: 18px;
      padding: 16px;
      display: flex; align-items: center; gap: 14px;
      cursor: pointer;
      transition: all .18s;
      border: 2px solid ${Z.line};
      background: ${Z.white};
    }
    .pay-option.selected {
      border-color: ${Z.red};
      background: ${Z.redLight};
      box-shadow: 0 4px 16px rgba(226,55,68,.14);
    }
    .pay-option-icon {
      width: 46px; height: 46px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: all .18s;
    }

    /* Security badge */
    .sec-badge {
      display: flex; align-items: center; gap:6;
      padding: 8px 14px; border-radius: 99px;
      background: ${Z.greenBg}; border: 1px solid rgba(27,166,114,.2);
    }

    /* Bottom CTA */
    .pay-bottom {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
      background: ${Z.white};
      border-top: 1px solid ${Z.line};
      padding: 14px 16px max(env(safe-area-inset-bottom), 14px);
      box-shadow: 0 -8px 32px rgba(0,0,0,.08);
    }
    .pay-cta-btn {
      width: 100%; padding: 16px; border: none; cursor: pointer;
      background: linear-gradient(135deg, ${Z.red} 0%, ${Z.redDark} 100%);
      color: #fff; font-size: 15px; font-weight: 900;
      font-family: 'DM Sans', sans-serif;
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 6px 20px rgba(226,55,68,.35);
      transition: opacity .15s, transform .12s;
    }
    .pay-cta-btn:active { opacity: .9; transform: scale(.98); }
    .pay-cta-btn:disabled { background: #ccc; box-shadow: none; cursor: not-allowed; }

    /* Order items mini list */
    .order-item-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid ${Z.lineLight};
      font-size: 13px;
    }
    .order-item-row:last-child { border-bottom: none; }

    @keyframes fadeUp {
      from { opacity:0; transform:translateY(12px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .fu  { animation: fadeUp .35s ease both; }
    .fu1 { animation: fadeUp .35s .07s ease both; }
    .fu2 { animation: fadeUp .35s .14s ease both; }
    .fu3 { animation: fadeUp .35s .21s ease both; }
  `}</style>
);

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshOrders } = useUser();
  const { clearCart } = useCart();

  const { totalAmount = 0, cartItems = [], instructions = "" } = location.state || {};

  const [paymentMethod,    setPaymentMethod]    = useState("cash");
  const [loading,          setLoading]          = useState(false);
  const [showStripeModal,  setShowStripeModal]  = useState(false);
  const [showStatusModal,  setShowStatusModal]  = useState(false);
  const [orderStatus,      setOrderStatus]      = useState<"idle"|"processing"|"success">("idle");
  const paymentPromiseRef = useRef<Promise<any> | null>(null);

  const handleCashPayment = async () => {
    setShowStatusModal(true);
    setOrderStatus("processing");
    const orderData = {
      customer_email: user?.email || "guest@dineiq.ai",
      cart_items: cartItems, final_total: totalAmount,
      discount_amount: 0, payment_method: "CASH", instructions,
    };
    try {
      const response = await api.placeOrder(orderData);
      if (response?.status === "success") {
        setOrderStatus("success");
        saveLog(user?.email || "Guest", "ORDER_PLACED", `Method: CASH, Total: KSh ${totalAmount}`);
        clearCart(); refreshOrders();
        await new Promise(r => setTimeout(r, 1000));
        navigate("/home");
      } else {
        setShowStatusModal(false);
        toast.error(response?.message || "Failed to place order.");
      }
    } catch {
      setShowStatusModal(false);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setOrderStatus("idle");
    }
  };

  const handlePaymentAttempt = () => {
    const orderData = {
      customer_email: user?.email || "guest@dineiq.ai",
      cart_items: cartItems, final_total: totalAmount,
      discount_amount: 0, payment_method: "ONLINE", instructions,
    };
    paymentPromiseRef.current = api.placeOrder(orderData);
  };

  const handleStripeSuccess = async () => {
    setLoading(true);
    try {
      if (!paymentPromiseRef.current) handlePaymentAttempt();
      const response = await paymentPromiseRef.current;
      if (response?.status === "success") {
        saveLog(user?.email || "Guest", "ORDER_PLACED", `Method: ONLINE, Total: KSh ${totalAmount}`);
        clearCart(); refreshOrders();
        setTimeout(() => navigate("/home"), 300);
      } else {
        setShowStripeModal(false);
        toast.error(response?.message || "Payment failed.");
      }
    } catch {
      setShowStripeModal(false);
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
      paymentPromiseRef.current = null;
    }
  };

  const taxes     = Math.round(totalAmount * 0.05);
  const subtotal  = totalAmount - taxes;

  const payOptions = [
    {
      id:    "cash",
      label: "Cash / Pay at Counter",
      sub:   "Pay directly at the reception",
      icon:  <Banknote style={{ width:22, height:22 }} />,
      color: Z.green,
      bg:    Z.greenBg,
    },
    {
      id:    "online",
      label: "Pay Online",
      sub:   "Credit Card, Debit Card, UPI",
      icon:  <CreditCard style={{ width:22, height:22 }} />,
      color: Z.red,
      bg:    Z.redLight,
    },
  ];

  return (
    <>
      <PageStyle />
      <div className="pay-page">

        {/* ── HEADER ── */}
        <div className="pay-header">
          <div style={{ display:"flex", alignItems:"center", gap:12, position:"relative" }}>
            <button onClick={() => navigate(-1)} style={{
              width:38, height:38, borderRadius:12,
              background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.2)",
              display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
            }}>
              <ArrowLeft style={{ width:18, height:18, color:"#fff" }} />
            </button>
            <div>
              <p style={{ fontSize:18, fontWeight:800, color:"#fff", lineHeight:1.2 }}>Payment</p>
              <p style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:1 }}>
                Choose how you'd like to pay
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* ── AMOUNT HERO ── */}
          <div className="amount-card fu">
            <p style={{
              fontSize:10, fontWeight:600, letterSpacing:".12em",
              textTransform:"uppercase", color:"rgba(255,255,255,.42)",
              marginBottom:8,
            }}>Total Amount Due</p>

            <p style={{ fontSize:38, fontWeight:900, color:"#fff", lineHeight:1, marginBottom:4 }}>
              KSh {totalAmount.toLocaleString()}
            </p>

            <p style={{ fontSize:12, color:"rgba(255,255,255,.45)", marginBottom:20 }}>
              Inclusive of all taxes & fees
            </p>

            {/* Mini breakdown */}
            <div style={{
              background:"rgba(255,255,255,.07)", borderRadius:14,
              padding:"12px 14px", display:"flex", flexDirection:"column", gap:6,
              border:"1px solid rgba(255,255,255,.1)",
            }}>
              {[
                { label:"Subtotal",    val:`KSh ${subtotal.toLocaleString()}` },
                { label:"GST (5%)",    val:`KSh ${taxes.toLocaleString()}`    },
                { label:"Delivery",    val:"FREE"                              },
              ].map(({ label, val }) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,.45)" }}>{label}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,.8)" }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Cart items */}
            {cartItems.length > 0 && (
              <div style={{ marginTop:14 }}>
                <p style={{ fontSize:10, fontWeight:600, letterSpacing:".1em",
                  textTransform:"uppercase", color:"rgba(255,255,255,.35)", marginBottom:8 }}>
                  Your Order
                </p>
                {cartItems.slice(0, 3).map((item: any, i: number) => (
                  <div key={i} style={{
                    display:"flex", justifyContent:"space-between",
                    padding:"5px 0", borderBottom:"1px solid rgba(255,255,255,.07)",
                  }}>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,.6)", fontWeight:500 }}>
                      {item.quantity}× {item.name}
                    </span>
                    <span style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,.7)" }}>
                      KSh {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
                {cartItems.length > 3 && (
                  <p style={{ fontSize:11, color:"rgba(255,255,255,.35)", marginTop:6 }}>
                    +{cartItems.length - 3} more items
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── PAYMENT OPTIONS ── */}
          <div className="fu1">
            <p style={{ fontSize:13, fontWeight:700, color:Z.dark, marginBottom:10 }}>
              Select Payment Method
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {payOptions.map(opt => (
                <div
                  key={opt.id}
                  className={`pay-option ${paymentMethod === opt.id ? "selected" : ""}`}
                  onClick={() => setPaymentMethod(opt.id)}
                >
                  {/* Radio */}
                  <div style={{
                    width:20, height:20, borderRadius:99, flexShrink:0,
                    border:`2px solid ${paymentMethod === opt.id ? Z.red : Z.line}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"border-color .15s",
                  }}>
                    {paymentMethod === opt.id && (
                      <div style={{ width:10, height:10, borderRadius:99, background:Z.red }} />
                    )}
                  </div>

                  {/* Icon */}
                  <div className="pay-option-icon" style={{
                    background: paymentMethod === opt.id ? opt.bg : Z.surface,
                    border:`1.5px solid ${paymentMethod === opt.id ? opt.color + "40" : Z.line}`,
                    color: paymentMethod === opt.id ? opt.color : Z.muted,
                  }}>
                    {opt.icon}
                  </div>

                  {/* Text */}
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:14, fontWeight:700, color:Z.dark }}>{opt.label}</p>
                    <p style={{ fontSize:11, color:Z.muted, marginTop:1 }}>{opt.sub}</p>
                  </div>

                  {paymentMethod === opt.id && (
                    <CheckCircle2 style={{ width:18, height:18, color:Z.red, flexShrink:0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── SECURITY BADGE ── */}
          <div className="fu2" style={{ display:"flex", justifyContent:"center" }}>
            <div className="sec-badge">
              <ShieldCheck style={{ width:14, height:14, color:Z.green, flexShrink:0 }} />
              <span style={{ fontSize:11, fontWeight:600, color:Z.green }}>
                256-bit SSL Secured · Safe & Encrypted
              </span>
            </div>
          </div>

          {/* ── ESTIMATED TIME ── */}
          <div className="fu3" style={{
            background:Z.white, borderRadius:16, padding:"12px 16px",
            display:"flex", alignItems:"center", gap:12,
            border:`1.5px solid ${Z.line}`,
          }}>
            <div style={{
              width:36, height:36, borderRadius:10,
              background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.2)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <Clock style={{ width:16, height:16, color:Z.amber }} />
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:Z.dark }}>Estimated Preparation Time</p>
              <p style={{ fontSize:11, color:Z.muted }}>15 – 25 minutes after order confirmation</p>
            </div>
          </div>

        </div>

        {/* ── BOTTOM CTA ── */}
        <div className="pay-bottom">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div>
              <p style={{ fontSize:11, color:Z.muted, fontWeight:600 }}>
                {paymentMethod === "cash" ? "Pay at counter" : "Secure online payment"}
              </p>
              <p style={{ fontSize:20, fontWeight:900, color:Z.dark }}>
                KSh {totalAmount.toLocaleString()}
              </p>
            </div>
            <div style={{ textAlign:"right" }}>
              <p style={{ fontSize:10, color:Z.muted }}>{cartItems.length} item{cartItems.length > 1 ? "s" : ""}</p>
              <p style={{ fontSize:11, fontWeight:600, color:Z.green }}>FREE Delivery</p>
            </div>
          </div>

          <button
            className="pay-cta-btn"
            disabled={loading}
            onClick={paymentMethod === "cash" ? handleCashPayment : () => setShowStripeModal(true)}
          >
            {loading ? (
              "Processing…"
            ) : paymentMethod === "cash" ? (
              <>
                <Banknote style={{ width:18, height:18 }} />
                Place Order · Cash
                <ChevronRight style={{ width:16, height:16 }} />
              </>
            ) : (
              <>
                <CreditCard style={{ width:18, height:18 }} />
                Pay Now · KSh {totalAmount.toLocaleString()}
                <ChevronRight style={{ width:16, height:16 }} />
              </>
            )}
          </button>
        </div>

        {/* Modals */}
        <StripeDummyModal
          isOpen={showStripeModal}
          onClose={() => setShowStripeModal(false)}
          onSuccess={handleStripeSuccess}
          onPaymentAttempt={handlePaymentAttempt}
          amount={totalAmount}
          userEmail={user?.email}
          userName={user?.name}
        />
        <CashDummyModal isOpen={showStatusModal} status={orderStatus} />

      </div>
    </>
  );
};

export default Payment;