// ─── DineIQ Offline API ───
// Wraps api.ts calls with IndexedDB caching
// Works online AND offline after first load

import { api } from "@/api";
import { smartFetch, dbSave, dbLoad, dbLoadAll, isOnline } from "../db.ts";

export const offlineApi = {

  // ── Menu — most important to cache ──
  async fetchMenu(email: string) {
    const { data, fromCache } = await smartFetch(
      "menu",
      () => api.fetchMenu(email),
      "menu_data"
    );
    if (fromCache) console.log("📦 Menu loaded from IndexedDB (offline)");
    return data;
  },

  // ── Offers ──
  async fetchOffers() {
    const { data, fromCache } = await smartFetch(
      "offers",
      () => api.fetchOffers(),
      "offers_data"
    );
    if (fromCache) console.log("📦 Offers loaded from IndexedDB (offline)");
    return data ?? { offers: [] };
  },

  // ── Order History ──
  async fetchOrderHistory(email: string) {
    if (!email || email === "guest@dineiq.com") return { orders: [] };

    const { data, fromCache } = await smartFetch(
      "orders",
      () => api.fetchOrderHistory(email),
      `orders_${email}`
    );
    if (fromCache) console.log("📦 Orders loaded from IndexedDB (offline)");
    return data ?? { orders: [] };
  },

  // ── Place Order — queue if offline ──
  async placeOrder(orderData: any, tableNumber?: number) {
    if (isOnline()) {
      const result = await api.placeOrder(orderData, tableNumber);

      // Save to local orders after successful placement
      if (result?.status === "success") {
        const existing = await dbLoad("orders", `orders_${orderData.customer_email}`);
        const orders   = existing?.orders || [];
        orders.unshift({
          id:     result.order_id,
          date:   new Date().toISOString(),
          items:  orderData.cart_items,
          total:  orderData.final_total,
          status: "created",
        });
        await dbSave("orders", {
          id:     `orders_${orderData.customer_email}`,
          orders,
        });
      }
      return result;
    } else {
      // ── Offline: queue the order ──
      console.warn("📵 Offline — order queued for sync");
      const queued = JSON.parse(localStorage.getItem("dineiq_queued_orders") || "[]");
      queued.push({ orderData, tableNumber, queuedAt: new Date().toISOString() });
      localStorage.setItem("dineiq_queued_orders", JSON.stringify(queued));
      return { status: "queued", message: "Order saved — will sync when online" };
    }
  },

  // ── Sync queued orders when back online ──
  async syncQueuedOrders() {
    if (!isOnline()) return;

    const queued = JSON.parse(localStorage.getItem("dineiq_queued_orders") || "[]");
    if (queued.length === 0) return;

    console.log(`🔄 Syncing ${queued.length} queued orders...`);
    const failed = [];

    for (const item of queued) {
      try {
        const result = await api.placeOrder(item.orderData, item.tableNumber);
        if (result?.status === "success") {
          console.log(`✅ Synced order: ${result.order_id}`);
        } else {
          failed.push(item);
        }
      } catch {
        failed.push(item);
      }
    }

    // Keep only failed ones in queue
    localStorage.setItem("dineiq_queued_orders", JSON.stringify(failed));
    if (failed.length === 0) console.log("✅ All queued orders synced!");
  },

  // ── Coupons ──
  async fetchCoupons() {
    const { data } = await smartFetch(
      "offers",
      () => api.fetchCoupons(),
      "coupons_data"
    );
    return data;
  },

  // ── Pass-through for online-only features ──
  generateCombos:      api.generateCombos.bind(api),
  fetchRecommendations: api.fetchRecommendations?.bind(api),
  getPricingStrategy:  api.getPricingStrategy.bind(api),
  placeOrderDirect:    api.placeOrder.bind(api),
  signup:              api.signup.bind(api),
  checkUser:           api.checkUser.bind(api),
  verifyOtp:           api.verifyOtp.bind(api),
  callWaiter:          api.callWaiter.bind(api),
  fetchActiveOrder:    api.fetchActiveOrder.bind(api),
  submitReview:        api.submitReview.bind(api),
};