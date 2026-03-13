import { API_BASE_URL } from "./config";


export const api = {
    // Fetch Menu (Personalized)
    fetchMenu: async (email: string, tableNumber?: number) => {
        try {
            const response = await fetch(`${API_BASE_URL}/menu`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customer_email: email,
                    table_number: tableNumber
                })
            });
            const data = await response.json();
            // Backend returns { "menu": { "status": "success", ... } }
            // We need to unwrap it for the frontend to access "status" directly
            return data.menu || data;
        } catch (error) {
            console.error("Fetch Menu Error:", error);
            return null;
        }
    },

    // Fetch Offers
    fetchOffers: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/offers`);
            return await response.json();
        } catch (error) {
            console.error("Fetch Offers Error:", error);
            return { offers: [] };
        }
    },

    // Save Preferences
    savePreferences: async (email: string, preferences: any) => {
        try {
            const response = await fetch(`${API_BASE_URL}/save-preferences`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, preferences }),
            });
            return await response.json();
        } catch (error) {
            console.error("Save Prefs Error:", error);
            return null;
        }
    },

    // Get Recommendations (Pairing)
    fetchRecommendations: async (email: string, itemId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/item-addons`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customer_email: email, item_id: itemId }),
            });
            return await response.json();
        } catch (error) {
            console.error("Fetch Recs Error:", error);
            return null;
        }
    },

    // Get Pricing Strategy (Nudge)
    async getPricingStrategy(email: string, cartItems: any[]) {
        try {
            const res = await fetch(`${API_BASE_URL}/pricing-strategy`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customer_email: email, cart_items: cartItems }),
            });
            return await res.json();
        } catch (e) {
            console.error("Pricing Strategy Error:", e);
            return null;
        }
    },

    async fetchUpsellItems() {
        try {
            const res = await fetch(`${API_BASE_URL}/upsell-items`);
            return await res.json();
        } catch (e) {
            console.error("Upsell Fetch Error:", e);
            return null;
        }
    },

    async fetchCoupons() {
        try {
            const res = await fetch(`${API_BASE_URL}/coupons`);
            return await res.json();
        } catch (e) {
            console.error("Coupon Fetch Error:", e);
            return null;
        }
    },

    async generateCombos(num: number = 3, customerId?: string) {
        try {
            const res = await fetch(`${API_BASE_URL}/generate-combos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ num_combos: num, customer_id: customerId }),
            });
            return await res.json();
        } catch (e) {
            console.error("Combo Gen Error:", e);
            return null;
        }
    },

    async fetchOrderHistory(email: string) {
        try {
            const res = await fetch(`${API_BASE_URL}/order-history/${email}`);
            return await res.json();
        } catch (e) {
            console.error("Order History Error:", e);
            return { orders: [] };
        }
    },

    async placeOrder(orderData: any, tableNumber?: number) {
        try {
            const res = await fetch(`${API_BASE_URL}/place-order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...orderData, table_number: tableNumber }),
            });
            return await res.json();
        } catch (e) {
            console.error("Place Order Error:", e);
            return null;
        }
    },

    async submitReview(reviewData: any) {
        try {
            const res = await fetch(`${API_BASE_URL}/reviews/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reviewData),
            });
            return await res.json();
        } catch (e) {
            console.error("Submit Review Error:", e);
            return null;
        }
    },

    async fetchLatestReview(email: string) {
        try {
            const res = await fetch(`${API_BASE_URL}/reviews/customer/${email}`);
            return await res.json();
        } catch (e) {
            console.error("Fetch Latest Review Error:", e);
            return null;
        }
    },

    // AUTH APIs
signup: async(name: string, email: string, mobile: string, tableNumber?: number) => {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name,
            email,
            mobile,
            table_number: tableNumber
        })
    });
    return await res.json();
},

async checkUser(method: string, value: string, tableNumber?: number) {
    const res = await fetch(`${API_BASE_URL}/auth/check-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            method,
            value,
            table_number: tableNumber
        })
    });
    return await res.json();
},

async verifyOtp(email: string, otp: string) {
    const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
    });
    return await res.json();
},
callWaiter: async (tableNumber: number, customerName: string) => {
  try {
    const res = await fetch(`${API_BASE_URL}/call-waiter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table_number: tableNumber, customer_name: customerName }),
    });
    return await res.json();
  } catch (e) {
    console.warn("callWaiter failed:", e);
    return null;
  }
},

fetchActiveOrder: async (tableNumber: number) => {
  try {
    const res = await fetch(`${API_BASE_URL}/active-order/${tableNumber}`);
    return await res.json();
  } catch (e) {
    console.warn("fetchActiveOrder failed:", e);
    return null;
  }
},
};
