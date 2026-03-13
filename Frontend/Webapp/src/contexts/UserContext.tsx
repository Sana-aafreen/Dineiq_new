import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { api } from "@/api";
import { MenuItem } from "@/lib/data";
import { saveLog } from "@/utils/logger";

export interface Order {
  id: string;
  date: string | Date;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  status: "preparing" | "on_the_way" | "delivered" | "created";
  rating?: number;
}

interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
}

interface UserContextType {
  tableNumber: string;
  guestCount: number;
  guestName: string;
  phoneNumber: string;
  isLoggedIn: boolean;
  isVegMode: boolean;
  profile: UserProfile;
  user: UserProfile;
  orders: Order[];
  fullMenu: MenuItem[];
  setFullMenu: (menu: MenuItem[]) => void;
  login: (tableNumber: string, guestCount: number, guestName?: string, phone?: string, email?: string, id?: string) => void;
  logout: () => void;
  refreshOrders: () => Promise<void>;
  toggleVegMode: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  addOrder: (order: Order) => void;
  rateOrder: (orderId: string, rating: number) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Mock order history for demo
const mockOrders: Order[] = [
  {
    id: "ord1",
    date: new Date(2025, 0, 17, 20, 30),
    items: [
      { name: "Butter Naan", quantity: 2, price: 60 },
      { name: "Paneer Tikka", quantity: 1, price: 299 },
      { name: "Dal Makhani", quantity: 1, price: 220 },
    ],
    total: 639,
    status: "delivered",
    rating: 4,
  },
  {
    id: "ord2",
    date: new Date(2025, 0, 16, 13, 15),
    items: [
      { name: "Chicken Biryani Box", quantity: 2, price: 349 },
      { name: "Gulab Jamun", quantity: 2, price: 99 },
    ],
    total: 896,
    status: "delivered",
  },
  {
    id: "ord3",
    date: new Date(2025, 0, 15, 19, 45),
    items: [
      { name: "Pizza Party Deal", quantity: 1, price: 499 },
      { name: "Paneer Tikka", quantity: 1, price: 299 },
    ],
    total: 798,
    status: "delivered",
    rating: 5,
  },
];

export function UserProvider({ children }: { children: ReactNode }) {
  const [tableNumber, setTableNumber] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [guestName, setGuestName] = useState("Guest");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isVegMode, setIsVegMode] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem("dineiq_user");
    return saved ? JSON.parse(saved) : {
      id: "",
      name: "",
      phone: "",
      email: "",
      dateOfBirth: "",
    };
  });

  useEffect(() => {
    localStorage.setItem("dineiq_user", JSON.stringify(profile));
    // Update basic states when profile changes
    if (profile.email) {
      setGuestName(profile.name || "Guest");
      setPhoneNumber(profile.phone || "");
      setIsLoggedIn(true);
    } else {
      setGuestName("Guest");
      setPhoneNumber("");
      setIsLoggedIn(false);
    }
  }, [profile]);

  // Handle Dynamic Table Number from URL QR Code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get("table");

    if (tableParam) {
      const tableInt = parseInt(tableParam, 10);
      // Validate: Must be a number between 1 and 10
      if (!isNaN(tableInt) && tableInt >= 1 && tableInt <= 10) {
        const tableStr = tableInt.toString();
        console.log("📍 Valid Table Detected:", tableStr);
        setTableNumber(tableStr);
        localStorage.setItem("dineiq_table_number", tableStr);
      } else {
        console.warn("⚠️ Invalid Table Number in URL:", tableParam);
      }
    } else {
      // Restore from storage if URL doesn't have it
      const savedTable = localStorage.getItem("dineiq_table_number");
      if (savedTable) setTableNumber(savedTable);
    }
  }, []);

  const [fullMenu, setFullMenuState] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem("dineiq_full_menu");
    return saved ? JSON.parse(saved) : [];
  });

  const setFullMenu = (menu: MenuItem[]) => {
    setFullMenuState(menu);
    localStorage.setItem("dineiq_full_menu", JSON.stringify(menu));
  };

  const [orders, setOrders] = useState<Order[]>([]);

  const fetchOrders = async () => {
    if (isLoggedIn && profile.email) {
      const data = await api.fetchOrderHistory(profile.email);
      if (data && data.orders) {
        setOrders(data.orders);
      }
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [isLoggedIn, profile.email]);

  const refreshOrders = async () => {
    await fetchOrders();
  };

  const login = (table: string, count: number, name?: string, phone?: string, email: string = "", id: string = "") => {
  setTableNumber(table);
  localStorage.setItem("dineiq_table_number", table);  // ← add this line
  setGuestCount(count);
    const newProfile = {
      id: id,
      name: name || "Guest",
      phone: phone || "",
      email: email,
      dateOfBirth: profile.dateOfBirth,
    };
    setProfile(newProfile);
    setIsLoggedIn(true);
  };

  const logout = () => {
    setTableNumber("");
    setGuestCount(1);
    setProfile({
      id: "",
      name: "",
      phone: "",
      email: "",
      dateOfBirth: "",
    });
    setIsLoggedIn(false);
    localStorage.removeItem("dineiq_user");
  };

  const toggleVegMode = () => {
    setIsVegMode((prev) => {
      const newState = !prev;
      saveLog(profile.email || "Guest", "VEG_FILTER_TOGGLE", newState ? "Enabled" : "Disabled");
      return newState;
    });
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
    if (updates.name) setGuestName(updates.name);
    if (updates.phone) setPhoneNumber(updates.phone);
  };

  const addOrder = (order: Order) => {
    setOrders((prev) => [order, ...prev]);
  };

  const rateOrder = (orderId: string, rating: number) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, rating } : order
      )
    );
  };

  return (
    <UserContext.Provider
      value={{
        tableNumber,
        guestCount,
        guestName,
        phoneNumber,
        isLoggedIn,
        isVegMode,
        profile,
        user: profile,
        orders,
        fullMenu,
        setFullMenu,
        login,
        logout,
        refreshOrders,
        toggleVegMode,
        updateProfile,
        addOrder,
        rateOrder,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}