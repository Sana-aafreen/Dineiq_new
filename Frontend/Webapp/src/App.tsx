import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CartProvider from "@/contexts/CartContext";
import { UserProvider } from "@/contexts/UserContext";
import SplashScreen from "@/pages/SplashScreen";
import LoginScreen from "@/pages/LoginScreen";
import HomeScreen from "@/pages/HomeScreen";
import ProfilePage from "@/pages/ProfilePage";
import OrderHistoryPage from "@/pages/OrderHistoryPage";
import CartPage from "@/pages/CartPage";
import TrackOrderPage from "@/pages/TrackOrderPage";
import NotFound from "@/pages/NotFound";
import Payment from "@/pages/Payment";
import PreferenceScreen from "@/pages/PreferenceScreen";
import ChatbotPage from "@/pages/ChatbotPage";
import ReviewPage from "@/pages/ReviewPage";
import AIButton from "@/components/AIButton"; // <-- Added AIButton

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <UserProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* Floating AI Button (accessible on all pages) */}
            <AIButton />

            <Routes>
              <Route path="/" element={<SplashScreen />} />
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/preferences" element={<PreferenceScreen />} />
              <Route path="/home" element={<HomeScreen />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/orders" element={<OrderHistoryPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/payment" element={<Payment />} />
              <Route path="/track-order" element={<TrackOrderPage />} />
              <Route path="/chatbot" element={<ChatbotPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>

        </CartProvider>
      </UserProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
