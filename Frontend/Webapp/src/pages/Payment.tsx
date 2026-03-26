import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { useUser } from '@/contexts/UserContext';
import { useCart } from '@/contexts/CartContext';
import { offlineApi as api } from "@/utils/offlineApi";
import { toast } from 'sonner';
import StripeDummyModal from '@/components/StripeDummyModal';
import CashDummyModal from '@/components/CashDummyModal';
import { saveLog } from '@/utils/logger';
import {
  ArrowLeft, Wallet, CreditCard, Banknote,
  ShieldCheck, ChevronRight, CheckCircle2, Clock,
} from "lucide-react";

const stripePromise = loadStripe('pk_test_YOUR_STRIPE_PUBLIC_KEY');

/* ── Design tokens ── */
const Z = {
  red: "#E23744",
  redDark: "#C0303C",
  redLight: "#FFF1F2",
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
};

const PageStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
    
    .pay-page-wrapper { font-family: 'DM Sans', sans-serif !important; }
    .pay-page-wrapper * { font-family: 'DM Sans', sans-serif !important; }

    .pay-page {
      background: ${Z.surface};
      min-height: 100vh;
      padding-bottom: 140px;
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
      background: radial-gradient(circle at 20% 50%, rgba(245,158,11,.1) 0%, transparent 60%);
    }

    /* Amount hero card */
    .amount-card {
      background: linear-gradient(135deg, #1A1A1A 0%, #2C1A0E 100%);
      border-radius: 24px;
      padding: 24px 20px;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.08);
      box-shadow: 0 12px 32px rgba(0,0,0,0.12);
    }
    .amount-card::before {
      content: '';
      position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(circle at 90% 10%, rgba(226,55,68,.2) 0%, transparent 50%),
        radial-gradient(circle at 10% 90%, rgba(245,158,11,.1) 0%, transparent 50%);
    }

    /* Payment option */
    .pay-option {
      border-radius: 18px;
      padding: 16px;
      display: flex; align-items: center; gap: 14px;
      cursor: pointer;
      transition: all .2s cubic-bezier(0.4, 0, 0.2, 1);
      border: 2px solid ${Z.line};
      background: ${Z.white};
    }
    .pay-option.selected {
      border-color: ${Z.red};
      background: ${Z.redLight};
      box-shadow: 0 8px 24px rgba(226,55,68,0.12);
      transform: translateY(-2px);
    }
    .pay-option-icon {
      width: 48px; height: 48px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: all .2s;
    }

    /* Security badge */
    .sec-badge {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 99px;
      background: ${Z.greenBg}; border: 1px solid rgba(27,166,114,.15);
    }

    /* Bottom CTA */
    .pay-bottom {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 90;
      background: ${Z.white};
      border-top: 1px solid ${Z.line};
      padding: 16px 16px max(env(safe-area-inset-bottom), 16px);
      box-shadow: 0 -8px 32px rgba(0,0,0,.08);
    }
    .pay-cta-btn {
      width: 100%; padding: 18px; border: none; cursor: pointer;
      background: linear-gradient(135deg, ${Z.red} 0%, ${Z.redDark} 100%);
      color: #fff; font-size: 15px; font-weight: 800;
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 6px 20px rgba(226,55,68,.3);
      transition: all .2s;
    }
    .pay-cta-btn:active { transform: scale(0.97); opacity: 0.9; }
    .pay-cta-btn:disabled { background: #EFEFEF; color: #9E9E9E; box-shadow: none; cursor: not-allowed; }

    @keyframes fadeUp {
      from { opacity:0; transform:translateY(12px); }
      to { opacity:1; transform:translateY(0); }
    }
    .fu { animation: fadeUp .4s ease both; }
    .fu1 { animation: fadeUp .4s .1s ease both; }
    .fu2 { animation: fadeUp .4s .2s ease both; }
    .fu3 { animation: fadeUp .4s .3s ease both; }
  `}</style>
);

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshOrders } = useUser();
  const { clearCart, items: liveCartItems, totalPrice: liveTotalPrice } = useCart();

  // Receive data from cart
  const { totalAmount, cartItems, instructions, tableNumber: stateTable } = location.state || { totalAmount: 0, cartItems: [], instructions: "", tableNumber: "" };
  const currentTable = stateTable || useUser().tableNumber;

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [orderStatus, setOrderStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const paymentPromiseRef = useRef<Promise<any> | null>(null);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const isOrderSaved = (response: any) =>
    response && (response.status === "success" || response.status === "queued");
  const effectiveCartItems = orderCompleted
    ? []
    : (liveCartItems.length > 0 ? liveCartItems : cartItems);
  const effectiveTotalAmount = orderCompleted
    ? 0
    : (liveCartItems.length > 0 ? liveTotalPrice : totalAmount);

  const handleCashPayment = async () => {
    setShowStatusModal(true);
    setOrderStatus('processing');

    const orderData = {
      customer_email: user?.email || "guest@dineiq.com",
      cart_items: effectiveCartItems,
      final_total: effectiveTotalAmount,
      discount_amount: 0,
      payment_method: 'CASH',
      instructions: instructions,
      table_number: currentTable
    };

    try {
      const [response] = await Promise.all([
        api.placeOrder(orderData),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);

      if (isOrderSaved(response)) {
        setOrderStatus('success');
        setOrderCompleted(true);
        clearCart();
        void saveLog(user?.email || "Guest", "ORDER_PLACED", `Method: CASH, Total: KSh ${effectiveTotalAmount}`);
        void refreshOrders();
        navigate('/orders', { replace: true });
      } else {
        setShowStatusModal(false);
        toast.error(response?.message || "Failed to place order.");
      }
    } catch (error) {
      setShowStatusModal(false);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setOrderStatus('idle');
    }
  };

  const handlePaymentAttempt = () => {
    const orderData = {
      customer_email: user?.email || "guest@dineiq.com",
      cart_items: effectiveCartItems,
      final_total: effectiveTotalAmount,
      discount_amount: 0,
      payment_method: 'ONLINE',
      instructions: instructions,
      table_number: currentTable
    };
    paymentPromiseRef.current = api.placeOrder(orderData);
  };

  const handleStripeSuccess = async () => {
    setLoading(true);
    try {
      if (!paymentPromiseRef.current) handlePaymentAttempt();
      const response = await paymentPromiseRef.current;

      if (isOrderSaved(response)) {
        setOrderCompleted(true);
        clearCart();
        void saveLog(user?.email || "Guest", "ORDER_PLACED", `Method: ONLINE, Total: KSh ${effectiveTotalAmount}`);
        void refreshOrders();
        navigate('/orders', { replace: true });
      } else {
        setShowStripeModal(false);
        toast.error(response?.message || "Payment Failed.");
      }
    } catch (error) {
      setShowStripeModal(false);
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
      paymentPromiseRef.current = null;
    }
  };

  const taxes = Math.round(effectiveTotalAmount * 0.05);
  const subtotal = effectiveTotalAmount - taxes;

  const payOptions = [
    {
      id: "cash",
      label: "Cash / Pay at Counter",
      sub: "Pay directly at the reception",
      icon: <Banknote size={22} />,
      color: Z.green,
      bg: Z.greenBg,
    },
    {
      id: "online",
      label: "Pay Online",
      sub: "Credit Card, Debit Card, UPI",
      icon: <CreditCard size={22} />,
      color: Z.red,
      bg: Z.redLight,
    },
  ];

  return (
    <div className="pay-page-wrapper">
      <PageStyle />
      <div className="pay-page">
        {/* Header */}
        <header className="pay-header">
          <div className="flex items-center gap-3.5 relative">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <p className="text-lg font-extrabold text-white leading-tight">Payment</p>
              <p className="text-[11px] text-white/50 mt-0.5">Choose how you'd like to pay</p>
            </div>
          </div>
        </header>

        <div className="p-4 flex flex-col gap-4">
          {/* Amount Hero Card */}
          <div className="amount-card fu">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Total Amount Due</p>
            <p className="text-4xl font-black text-white leading-none mb-1">
              KSh {effectiveTotalAmount.toLocaleString()}
            </p>
            <p className="text-xs text-white/40 mb-5">Inclusive of all taxes & fees</p>

            <div className="bg-white/5 rounded-2xl p-3.5 flex flex-col gap-2 border border-white/10">
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Subtotal</span>
                <span className="text-xs font-bold text-white/80">KSh {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/40">GST (5%)</span>
                <span className="text-xs font-bold text-white/80">KSh {taxes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/40">Delivery Fee</span>
                <span className="text-xs font-bold text-[#1BA672]">FREE</span>
              </div>
            </div>

            {effectiveCartItems.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Your Order</p>
                <div className="space-y-2">
                  {effectiveCartItems.slice(0, 3).map((item: any, i: number) => (
                    <div key={i} className="flex justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                      <span className="text-[12px] text-white/60 font-medium">{item.quantity}× {item.name}</span>
                      <span className="text-[12px] font-bold text-white/70">KSh {(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  {effectiveCartItems.length > 3 && (
                    <p className="text-[11px] text-white/30 mt-2">+{effectiveCartItems.length - 3} more items</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Payment Options */}
          <div className="fu1">
            <p className="text-[13px] font-bold text-[#1C1C1C] mb-3">Select Payment Method</p>
            <div className="flex flex-col gap-2.5">
              {payOptions.map((opt) => (
                <div
                  key={opt.id}
                  className={`pay-option ${paymentMethod === opt.id ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod(opt.id)}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                    paymentMethod === opt.id ? 'border-[#E23744]' : 'border-[#EFEFEF]'
                  }`}>
                    {paymentMethod === opt.id && <div className="w-2.5 h-2.5 rounded-full bg-[#E23744]" />}
                  </div>

                  <div className="pay-option-icon" style={{
                    background: paymentMethod === opt.id ? opt.bg : Z.surface,
                    border: `1.5px solid ${paymentMethod === opt.id ? opt.color + '40' : Z.line}`,
                    color: paymentMethod === opt.id ? opt.color : Z.muted,
                  }}>
                    {opt.icon}
                  </div>

                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-[#1C1C1C]">{opt.label}</p>
                    <p className="text-[11px] text-[#9E9E9E] mt-0.5">{opt.sub}</p>
                  </div>

                  {paymentMethod === opt.id && <CheckCircle2 className="w-5 h-5 text-[#E23744] flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* Security Badge */}
          <div className="fu2 flex justify-center mt-2">
            <div className="sec-badge">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1BA672]" />
              <span className="text-[11px] font-bold text-[#1BA672]">256-bit SSL Secured · Safe & Encrypted</span>
            </div>
          </div>

          {/* Time Banner */}
          <div className="fu3 flex items-center gap-3 bg-white border border-[#EFEFEF] p-3.5 rounded-2xl">
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#1C1C1C]">Estimated Preparation Time</p>
              <p className="text-[11px] text-[#9E9E9E]">15 – 25 minutes after order</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pay-bottom">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-[11px] text-[#9E9E9E] font-bold uppercase tracking-wider">{paymentMethod === 'cash' ? 'Pay at counter' : 'Secure Online Payment'}</p>
              <p className="text-2xl font-black text-[#1C1C1C]">KSh {effectiveTotalAmount.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#9E9E9E]">{effectiveCartItems.length} items</p>
              <p className="text-[11px] font-bold text-[#1BA672]">FREE Delivery</p>
            </div>
          </div>

          <button
            onClick={paymentMethod === 'cash' ? handleCashPayment : () => setShowStripeModal(true)}
            disabled={loading}
            className="pay-cta-btn"
          >
            {loading ? (
              "Processing..."
            ) : paymentMethod === 'cash' ? (
              <>
                <Banknote className="w-4 h-4" />
                Place Order · Cash
                <ChevronRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Pay Now · KSh {effectiveTotalAmount.toLocaleString()}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Stripe Dummy Modal */}
        <StripeDummyModal
          isOpen={showStripeModal}
          onClose={() => setShowStripeModal(false)}
          onSuccess={handleStripeSuccess}
          onPaymentAttempt={handlePaymentAttempt}
          amount={effectiveTotalAmount}
          userEmail={user?.email}
          userName={user?.name}
        />
        {/* Cash Dummy Modal */}
        <CashDummyModal
          isOpen={showStatusModal}
          status={orderStatus}
        />
      </div>
    </div>
  );
};

export default Payment;
