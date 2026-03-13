import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { MenuItem } from "@/lib/data";
import { useUser } from "./UserContext";
import { saveLog } from "@/utils/logger";

interface CartItem extends MenuItem {
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: MenuItem, silent?: boolean, source?: string) => void;
  removeItem: (itemId: string, silent?: boolean, source?: string) => void;
  updateQuantity: (itemId: string, quantity: number, silent?: boolean, source?: string) => void;
  getItemQuantity: (itemId: string) => number;
  totalItems: number;
  totalPrice: number;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export default function CartProvider({ children }: { children: ReactNode }) {
  const { user, fullMenu } = useUser();
  const userEmail = user?.email || "Guest";

  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("dineiq_cart");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("dineiq_cart", JSON.stringify(items));
  }, [items]);

  const addItem = (item: MenuItem, silent: boolean = false, source: string = "Menu") => {
    // If it's a combo, deconstruct it into individual items
    if (item.isCombo && item.comboItems && item.comboItems.length > 0) {
      item.comboItems.forEach(componentName => {
        // Clean the component name (remove multipliers like "2x", "2 ")
        const cleanName = componentName.replace(/^\d+x?\s+/, '').trim().toLowerCase();

        // Find matching item in fullMenu
        const matchedItem = fullMenu.find(m => m.name.toLowerCase() === cleanName);

        if (matchedItem) {
          addItem(matchedItem, true); // Keep silent while deconstructing combo
        } else {
          // Fallback: If not found in fullMenu, add it as a new standard item with a placeholder ID
          addItem({
            ...item,
            id: `ind-${Date.now()}-${Math.random()}`,
            name: componentName,
            isCombo: false,
            comboItems: [],
            price: 0,
          }, true);
        }
      });

      // Log combo addition once if not silent
      if (!silent) {
        saveLog(
          userEmail,
          "CART_ADD",
          `${item.name} (Combo) from ${source}`
        );
      }
      return;
    }

    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      const newQuantity = existing ? existing.quantity + 1 : 1;

      // Log the addition if not silent
      if (!silent) {
        saveLog(
          userEmail,
          "CART_ADD",
          `${item.name} (Qty: ${newQuantity}) from ${source}`
        );
      }

      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (itemId: string, silent: boolean = false, source: string = "Menu") => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (!existing) return prev;

      const newQuantity = existing.quantity - 1;

      // Log the removal if not silent
      if (!silent) {
        saveLog(
          userEmail,
          "CART_REMOVE",
          `${existing.name} (New Qty: ${newQuantity}) from ${source}`
        );
      }

      if (existing.quantity > 1) {
        return prev.map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter((i) => i.id !== itemId);
    });
  };

  const updateQuantity = (itemId: string, quantity: number, silent: boolean = false, source: string = "Menu") => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (!existing) return prev;

      if (!silent) {
        saveLog(
          userEmail,
          "CART_UPDATE",
          `${existing.name} (New Qty: ${quantity}) from ${source}`
        );
      }

      if (quantity <= 0) {
        return prev.filter((i) => i.id !== itemId);
      }
      return prev.map((i) => (i.id === itemId ? { ...i, quantity } : i));
    });
  };

  const getItemQuantity = (itemId: string) => {
    return items.find((i) => i.id === itemId)?.quantity || 0;
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const clearCart = () => setItems([]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        getItemQuantity,
        totalItems,
        totalPrice,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
