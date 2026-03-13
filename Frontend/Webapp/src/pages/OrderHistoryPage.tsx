import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, Order } from "@/contexts/UserContext";
import { useCart } from "@/contexts/CartContext";
import { ArrowLeft, Star, RotateCcw, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { saveLog } from "@/utils/logger";

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  const { user, orders, rateOrder, fullMenu } = useUser();
  const { addItem } = useCart();
  const [ratingModal, setRatingModal] = useState<{ open: boolean; orderId: string }>({
    open: false,
    orderId: "",
  });
  const [selectedRating, setSelectedRating] = useState(0);


  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return date.toString(); // Fallback if invalid

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = days[d.getDay()];
    const dateNum = d.getDate();
    const month = months[d.getMonth()];
    const hours = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${day}, ${dateNum} ${month} | ${hour12}:${mins} ${ampm}`;
  };

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "delivered":
        return "bg-veg/20 text-veg";
      case "on_the_way":
        return "bg-gold/20 text-gold";
      case "preparing":
        return "bg-primary/20 text-primary";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "delivered":
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const handleRepeatOrder = (order: Order) => {
    order.items.forEach((item) => {
      // Find the best match in the current menu (name matching is robust for history)
      const targetName = item.name.trim().toLowerCase();
      const menuItem = fullMenu.find((m) => m.name.trim().toLowerCase() === targetName);

      if (menuItem) {
        for (let i = 0; i < item.quantity; i++) {
          addItem(menuItem, true);
        }
      }
    });

    // Log the repeat order activity
    saveLog(
      user?.email || "Guest",
      "REPEAT_ORDER",
      `Original Order ID: ${order.id}`
    );

    toast.success("Items added to cart!", {
      description: `${order.items.length} items from your previous order`,
    });
    navigate("/cart");
  };

  const handleRateFood = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    setSelectedRating(order?.rating || 0);
    setRatingModal({ open: true, orderId });
  };

  const submitRating = () => {
    if (selectedRating > 0) {
      rateOrder(ratingModal.orderId, selectedRating);

      // Log the feedback
      saveLog(
        user?.email || "Guest",
        "FEEDBACK_GIVEN",
        `Order ID: ${ratingModal.orderId}, Stars: ${selectedRating}`
      );

      toast.success("Thanks for your feedback!");
      setRatingModal({ open: false, orderId: "" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-card sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Order History</h1>
        </div>
      </header>

      {/* Orders List */}
      <div className="px-4 py-4 space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No orders yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Your order history will appear here
            </p>
            <Button
              onClick={() => navigate("/home")}
              className="mt-6 gradient-primary text-primary-foreground"
            >
              Browse Menu
            </Button>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="bg-card rounded-2xl p-4 shadow-sm animate-fade-in"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground font-medium">
                  {formatDate(order.date)}
                </span>
                <span
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(
                    order.status
                  )}`}
                >
                  {getStatusIcon(order.status)}
                  {order.status.replace("_", " ")}
                </span>
              </div>

              {/* Items Summary */}
              <div className="border-t border-b border-border py-3 mb-3">
                <p className="text-foreground font-medium line-clamp-2">
                  {order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}
                </p>
                <p className="text-lg font-bold text-foreground mt-1">
                  KSh {order.total}
                </p>
              </div>

              {/* Rating Stars (if rated) */}
              {order.rating && (
                <div className="flex items-center gap-1 mb-3">
                  <span className="text-sm text-muted-foreground mr-2">Your rating:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${star <= order.rating!
                        ? "fill-gold text-gold"
                        : "text-muted-foreground"
                        }`}
                    />
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => handleRepeatOrder(order)}
                  className="flex-1 h-12 gradient-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Repeat Order
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleRateFood(order.id)}
                  className="flex-1 h-12 border-2 font-semibold rounded-xl flex items-center justify-center gap-2"
                >
                  <Star className="w-4 h-4" />
                  {order.rating ? "Update Rating" : "Rate Food"}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rating Modal */}
      <Dialog open={ratingModal.open} onOpenChange={(open) => setRatingModal({ ...ratingModal, open })}>
        <DialogContent className="sm:max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">Rate Your Food</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setSelectedRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${star <= selectedRating
                      ? "fill-gold text-gold"
                      : "text-muted-foreground hover:text-gold/50"
                      }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-muted-foreground text-sm mt-4">
              {selectedRating === 0
                ? "Tap to rate"
                : selectedRating <= 2
                  ? "We'll do better next time!"
                  : selectedRating <= 4
                    ? "Thanks for your feedback!"
                    : "Excellent! You're awesome!"}
            </p>
          </div>
          <Button
            onClick={submitRating}
            disabled={selectedRating === 0}
            className="w-full h-12 gradient-primary text-primary-foreground font-semibold rounded-xl"
          >
            Submit Rating
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
