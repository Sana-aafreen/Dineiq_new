// DineIQ Offline API
// Wraps api.ts calls with IndexedDB caching
// Works online and offline after first load

import { api } from "@/api";
import { smartFetch, dbSave, dbLoad, isOnline } from "@/db";
import { getNetworkMode, LOCAL_API_BASE_URL } from "@/config";
import {
  cacheMenuPayloadForOffline,
  cacheOfferPayloadForOffline,
} from "@/lib/offlineOrderStore";
import {
  chefSpecials as fallbackChefSpecials,
  menuItems as fallbackMenuItems,
  offers as fallbackOffers,
} from "@/lib/data";
import { getMenuItemImage } from "@/lib/categoryUtils";

const GUEST_EMAIL = "guest@dineiq.com";

const getOrderCacheKey = (email?: string) =>
  `orders_${(email || GUEST_EMAIL).trim().toLowerCase()}`;

const buildLocalOrderRecord = (
  orderData: any,
  status: "created" | "preparing",
  orderId?: string
) => ({
  id: orderId || `local_${Date.now()}`,
  date: new Date().toISOString(),
  items: (orderData.cart_items || []).map((item: any) => ({
    name: item.Item_Name || item.name || "Item",
    quantity: Number(item.quantity || 1),
    price: Number(item.Current_Price || item.price || 0),
  })),
  total: Number(orderData.final_total || 0),
  status,
});

const prependOrderToCache = async (email: string | undefined, order: any) => {
  const cacheKey = getOrderCacheKey(email);
  const existing = await dbLoad("orders", cacheKey);
  const orders = existing?.orders || [];

  await dbSave("orders", {
    id: cacheKey,
    orders: [order, ...orders],
  });
};

const isLocalMode = () => getNetworkMode() === "local";

const buildLocalMenuFallback = () => {
  const normalizedMenuItems = [...fallbackChefSpecials, ...fallbackMenuItems].map(
    (item) => ({
      Item_ID: item.id,
      Item_Name: item.name,
      Item_Description: item.description,
      Current_Price: item.price,
      Item_Category: item.category,
      Is_Veg: item.isVeg,
      Image_URL: getMenuItemImage({
        Item_Name: item.name,
        Item_Category: item.category,
        image: item.image,
      }),
    })
  );

  const groupedSections = normalizedMenuItems.reduce<Record<string, any[]>>(
    (sections, item) => {
      const category = item.Item_Category || "Other";
      if (!sections[category]) sections[category] = [];
      sections[category].push(item);
      return sections;
    },
    {}
  );

  if (fallbackChefSpecials.length) {
    groupedSections["Chef Special"] = fallbackChefSpecials.map((item) => ({
      Item_ID: item.id,
      Item_Name: item.name,
      Item_Description: item.description,
      Current_Price: item.price,
      Item_Category: "Chef Special",
      Is_Veg: item.isVeg,
      Image_URL: getMenuItemImage({
        Item_Name: item.name,
        Item_Category: "Chef Special",
        image: item.image,
      }),
    }));
  }

  return {
    status: "success",
    menu_sections: groupedSections,
  };
};

const buildLocalOffersFallback = () => ({
  offers: fallbackOffers.map((offer, index) => ({
    ...offer,
    id: offer.id || `local-offer-${index + 1}`,
    image:
      offer.image ||
      getMenuItemImage({
        Item_Name: index === 0 ? "Harvest Salad" : index === 1 ? "Basque Cheesecake" : "Giant Burger",
        Item_Category: index === 0 ? "FROM THE GARDEN" : index === 1 ? "DESSERTS" : "BURGERS & SANDWICHES",
      }),
  })),
});

const fetchLocalOrders = async (email: string) => {
  const response = await fetch(
    `${LOCAL_API_BASE_URL}/orders?email=${encodeURIComponent(email)}`
  );
  const orders = await response.json();
  return {
    orders: Array.isArray(orders)
      ? orders.map((order: any) => ({
          id: order.cloud_order_id || order.order_id || order.id,
          date: order.created_at || new Date().toISOString(),
          items: (order.items || []).map((item: any) => ({
            name: item.Item_Name || item.name || "Item",
            quantity: Number(item.quantity || 1),
            price: Number(item.Current_Price || item.price || 0),
          })),
          total: Number(order.total_amount || 0),
          status: order.status === "pending" ? "preparing" : (order.status || "created"),
        }))
      : [],
  };
};

const fetchLocalMenu = async (email: string) => {
  const response = await fetch(`${LOCAL_API_BASE_URL}/menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_email: email }),
  });

  if (!response.ok) {
    throw new Error(`Local menu request failed with status ${response.status}`);
  }

  return response.json();
};

const placeOrderOnLocalServer = async (orderData: any) => {
  const response = await fetch(`${LOCAL_API_BASE_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...orderData,
      customer_email: orderData.customer_email || GUEST_EMAIL,
      customer_name:
        orderData.customer_name ||
        (orderData.customer_email && orderData.customer_email !== GUEST_EMAIL
          ? orderData.customer_email.split("@")[0]
          : "Guest"),
    }),
  });
  return response.json();
};

export const offlineApi = {
  async fetchMenu(email: string) {
    if (isLocalMode()) {
      try {
        const localMenu = await fetchLocalMenu(email);
        if (localMenu?.status === "success" && localMenu?.menu_sections) {
          await dbSave("menu", { id: "menu_data", ...localMenu });
          await cacheMenuPayloadForOffline(localMenu);
          return localMenu;
        }
      } catch (error) {
        console.warn("Falling back to cached/fallback local menu:", error);
      }
    }

    const { data, fromCache } = await smartFetch(
      "menu",
      () => api.fetchMenu(email),
      "menu_data"
    );
    if (fromCache) console.log("Menu loaded from IndexedDB (offline)");

    if (data?.status === "success" && data?.menu_sections) {
      await cacheMenuPayloadForOffline(data);
      return data;
    }

    const cachedMenu = await dbLoad("menu", "menu_data");
    if (cachedMenu?.status === "success" && cachedMenu?.menu_sections) {
      return cachedMenu;
    }

    const fallbackMenu = buildLocalMenuFallback();
    await dbSave("menu", { id: "menu_data", ...fallbackMenu });
    await cacheMenuPayloadForOffline(fallbackMenu);
    return fallbackMenu;
  },

  async fetchOffers() {
    if (isLocalMode()) {
      const fallback = buildLocalOffersFallback();
      await dbSave("offers", { id: "offers_data", ...fallback });
      await cacheOfferPayloadForOffline(fallback);
      return fallback;
    }

    const { data, fromCache } = await smartFetch(
      "offers",
      () => api.fetchOffers(),
      "offers_data"
    );
    if (fromCache) console.log("Offers loaded from IndexedDB (offline)");

    if (Array.isArray(data?.offers) && data.offers.length > 0) {
      await cacheOfferPayloadForOffline(data);
      return data;
    }

    const cachedOffers = await dbLoad("offers", "offers_data");
    if (Array.isArray(cachedOffers?.offers) && cachedOffers.offers.length > 0) {
      return cachedOffers;
    }

    const fallback = buildLocalOffersFallback();
    await dbSave("offers", { id: "offers_data", ...fallback });
    await cacheOfferPayloadForOffline(fallback);
    return fallback;
  },

  async fetchOrderHistory(email: string) {
    if (!email) return { orders: [] };

    if (isLocalMode()) {
      try {
        const data = await fetchLocalOrders(email);
        await dbSave("orders", { id: getOrderCacheKey(email), ...data });
        return data;
      } catch (error) {
        console.warn("Falling back to cached local orders:", error);
      }
    }

    const { data, fromCache } = await smartFetch(
      "orders",
      () => api.fetchOrderHistory(email),
      getOrderCacheKey(email)
    );
    if (fromCache) console.log("Orders loaded from IndexedDB (offline)");
    return data ?? { orders: [] };
  },

  async placeOrder(orderData: any, tableNumber?: number) {
    if (isLocalMode()) {
      try {
        const result = await placeOrderOnLocalServer(orderData);
        await prependOrderToCache(
          orderData.customer_email,
          buildLocalOrderRecord(orderData, "preparing", result.id)
        );
        return result;
      } catch (error) {
        console.warn("Local server unavailable, queueing order locally:", error);
      }
    }

    if (isOnline()) {
      const result = await api.placeOrder(orderData);

      if (result?.status === "success") {
        await prependOrderToCache(
          orderData.customer_email,
          buildLocalOrderRecord(orderData, "created", result.order_id)
        );
      }

      return result;
    }

    console.warn("Offline, order queued for sync");
    const queued = JSON.parse(localStorage.getItem("dineiq_queued_orders") || "[]");
    queued.push({ orderData, tableNumber, queuedAt: new Date().toISOString() });
    localStorage.setItem("dineiq_queued_orders", JSON.stringify(queued));

    await prependOrderToCache(
      orderData.customer_email,
      buildLocalOrderRecord(orderData, "preparing")
    );

    return { status: "queued", message: "Order saved and will sync when online" };
  },

  async syncQueuedOrders() {
    if (!isOnline()) return;

    const queued = JSON.parse(localStorage.getItem("dineiq_queued_orders") || "[]");
    if (queued.length === 0) return;

    console.log(`Syncing ${queued.length} queued orders...`);
    const failed = [];

    for (const item of queued) {
      try {
        const result = await api.placeOrder(item.orderData);
        if (result?.status === "success") {
          console.log(`Synced order: ${result.order_id}`);
        } else {
          failed.push(item);
        }
      } catch {
        failed.push(item);
      }
    }

    localStorage.setItem("dineiq_queued_orders", JSON.stringify(failed));
    if (failed.length === 0) console.log("All queued orders synced");
  },

  async fetchCoupons() {
    const { data } = await smartFetch(
      "offers",
      () => api.fetchCoupons(),
      "coupons_data"
    );
    return data;
  },

  generateCombos: api.generateCombos.bind(api),
  fetchRecommendations: api.fetchRecommendations?.bind(api),
  getPricingStrategy: api.getPricingStrategy.bind(api),
  placeOrderDirect: api.placeOrder.bind(api),
  signup: (api as any).signup?.bind(api),
  checkUser: (api as any).checkUser?.bind(api),
  verifyOtp: (api as any).verifyOtp?.bind(api),
  callWaiter: api.callWaiter.bind(api),
  fetchActiveOrder: api.fetchActiveOrder.bind(api),
  submitReview: api.submitReview.bind(api),
  savePreferences: api.savePreferences.bind(api),
  fetchAiPitch: api.fetchAiPitch.bind(api),
  fetchUpsellItems: api.fetchUpsellItems.bind(api),
  fetchLatestReview: api.fetchLatestReview.bind(api),
};
