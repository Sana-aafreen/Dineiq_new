import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { ArrowLeft, ChefHat, Bike, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TrackOrderPage() {
  const navigate = useNavigate();
  const { orders, tableNumber } = useUser();

  const activeOrder = orders.find(
    (order) => order.status === "preparing" || order.status === "on_the_way"
  );

  const steps = [
    {
      id: "confirmed",
      label: "Order Confirmed",
      icon: CheckCircle2,
      time: activeOrder ? new Date(activeOrder.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
    },
    {
      id: "preparing",
      label: "Preparing Your Food",
      icon: ChefHat,
      time: "~15 mins",
    },
    {
      id: "on_the_way",
      label: "On The Way",
      icon: Bike,
      time: "~5 mins",
    },
    {
      id: "delivered",
      label: "Delivered",
      icon: CheckCircle2,
      time: "",
    },
  ];

  const getCurrentStepIndex = () => {
    if (!activeOrder) return -1;
    if (activeOrder.status === "preparing") return 1;
    if (activeOrder.status === "on_the_way") return 2;
    return 3;
  };

  const currentStep = getCurrentStepIndex();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Track Order</h1>
        </div>
      </header>

      {activeOrder ? (
        <div className="px-4 py-6">
          {/* Order Info */}
          <div className="bg-card rounded-2xl p-4 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Order #{activeOrder.id.slice(-6)}</span>
              <span className="badge-gold px-3 py-1 text-sm">Table #{tableNumber}</span>
            </div>
            <p className="text-foreground font-medium">
              {activeOrder.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}
            </p>
            <p className="text-lg font-bold text-foreground mt-2">KSh {activeOrder.total}</p>
          </div>

          {/* Timeline */}
          <div className="bg-card rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-foreground mb-6">Order Status</h3>
            <div className="space-y-6">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div key={step.id} className="flex gap-4">
                    {/* Line and Circle */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isCompleted || isCurrent
                            ? "bg-veg text-white"
                            : "bg-secondary text-muted-foreground"
                          }`}
                      >
                        <StepIcon className="w-5 h-5" />
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={`w-0.5 h-12 transition-colors ${isCompleted ? "bg-veg" : "bg-secondary"
                            }`}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-2">
                      <p
                        className={`font-medium ${isCompleted || isCurrent
                            ? "text-foreground"
                            : "text-muted-foreground"
                          }`}
                      >
                        {step.label}
                      </p>
                      {step.time && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {isCurrent && <Clock className="w-3 h-3 inline mr-1" />}
                          {step.time}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Estimated Time */}
          <div className="mt-6 bg-gold/10 rounded-2xl p-4 text-center">
            <p className="text-sm text-muted-foreground">Estimated Delivery Time</p>
            <p className="text-2xl font-bold text-gold mt-1">20-25 mins</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Clock className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground">No Active Orders</h3>
          <p className="text-muted-foreground text-center mt-2">
            Place an order to track it here
          </p>
          <Button
            onClick={() => navigate("/home")}
            className="mt-6 gradient-primary text-primary-foreground px-8"
          >
            Browse Menu
          </Button>
        </div>
      )}
    </div>
  );
}
