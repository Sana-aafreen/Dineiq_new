import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import Analytics from "@/pages/Analytics";
import MenuPage from "@/pages/MenuPage";
import CustomerAuthPage from "@/pages/CustomerAuthPage";
import CustomerPreferencesPage from "@/pages/CustomerPreferencesPage";
import CustomerInsightsPage from "@/pages/CustomerInsightsPage";
import OrdersPage from "@/pages/OrdersPage";
import OrderItemsPage from "@/pages/OrderItemsPage";
import CustomerActivitiesPage from "@/pages/CustomerActivitiesPage";
import ChatsPage from "@/pages/ChatsPage";
import CampaignsPage from "@/pages/CampaignsPage";
import CustomerReviewsPage from "@/pages/CustomerReviewsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<Analytics />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/customer-auth" element={<CustomerAuthPage />} />
            <Route path="/customer-preferences" element={<CustomerPreferencesPage />} />
            <Route path="/customer-insights" element={<CustomerInsightsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/order-items" element={<OrderItemsPage />} />
            <Route path="/customer-activities" element={<CustomerActivitiesPage />} />
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/customer-reviews" element={<CustomerReviewsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DashboardLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
