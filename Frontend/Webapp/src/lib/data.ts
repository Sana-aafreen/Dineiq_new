export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  goldPrice?: number;
  rating: number;
  ratingCount: number;
  image: string;
  isVeg: boolean;
  category: string;
  isCombo?: boolean;
  isChefSpecial?: boolean;
  isBestseller?: boolean;
  comboItems?: string[];
  tableNumber?: number;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  tagline?: string;
}

export interface Offer {
  id: string;
  title: string;
  subtitle: string;
  discount: string;
  bgColor: string;
  image: string;
}

export const categories: Category[] = [
  { id: "1", name: "Rice", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=200&h=200&fit=crop" },
  { id: "2", name: "Bread", image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=200&h=200&fit=crop" },
  { id: "3", name: "Gravy", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=200&h=200&fit=crop" },
  { id: "4", name: "Dry Veg", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop" },
  { id: "5", name: "Starter", image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=200&h=200&fit=crop" },
  { id: "6", name: "Dessert", image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&h=200&fit=crop" },
  { id: "7", name: "Beverages", image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=200&h=200&fit=crop" },
];

export const offers: Offer[] = [
  {
    id: "1",
    title: "Flat 50% OFF",
    subtitle: "On All Combos",
    discount: "50%",
    bgColor: "gradient-primary",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=200&fit=crop",
  },
  {
    id: "2",
    title: "Chef's Special",
    subtitle: "Today Only",
    discount: "40%",
    bgColor: "gradient-gold",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=200&fit=crop",
  },
  {
    id: "3",
    title: "Gold Members",
    subtitle: "Extra 20% OFF",
    discount: "20%",
    bgColor: "gradient-dark",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=200&fit=crop",
  },
];

export const combos: MenuItem[] = [
  {
    id: "c1",
    name: "Paneer Feast Combo",
    description: "Paneer Tikka + 2 Naan + Dal Makhani + Coke",
    price: 449,
    originalPrice: 650,
    goldPrice: 399,
    rating: 4.5,
    ratingCount: 234,
    image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop",
    isVeg: true,
    category: "Combos",
    isCombo: true,
    comboItems: ["Paneer Tikka", "2 Butter Naan", "Dal Makhani", "Coke 300ml"],
  },
  {
    id: "c2",
    name: "Chicken Biryani Box",
    description: "Chicken Biryani + Raita + Gulab Jamun",
    price: 349,
    originalPrice: 480,
    goldPrice: 299,
    rating: 4.7,
    ratingCount: 567,
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop",
    isVeg: false,
    category: "Combos",
    isCombo: true,
    comboItems: ["Chicken Biryani", "Raita", "Gulab Jamun x2"],
  },
  {
    id: "c3",
    name: "Pizza Party Deal",
    description: "Medium Pizza + Garlic Bread + 2 Pepsi",
    price: 499,
    originalPrice: 720,
    goldPrice: 449,
    rating: 4.4,
    ratingCount: 189,
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
    isVeg: true,
    category: "Combos",
    isCombo: true,
    comboItems: ["Medium Margherita", "Garlic Bread", "2x Pepsi 300ml"],
  },
];

export const chefSpecials: MenuItem[] = [
  {
    id: "cs1",
    name: "Truffle Mushroom Risotto",
    description: "Creamy arborio rice with wild mushrooms and truffle oil",
    price: 650,
    goldPrice: 550,
    rating: 4.9,
    ratingCount: 156,
    image: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&h=300&fit=crop",
    isVeg: true,
    category: "Chef Special",
    isChefSpecial: true,
  },
  {
    id: "cs2",
    name: "Butter Chicken Supreme",
    description: "Signature butter chicken with cashew gravy & fresh cream",
    price: 450,
    goldPrice: 380,
    rating: 4.8,
    ratingCount: 892,
    image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&h=300&fit=crop",
    isVeg: false,
    category: "Chef Special",
    isChefSpecial: true,
    isBestseller: true,
  },
  {
    id: "cs3",
    name: "Tandoori Platter Royale",
    description: "Assorted kebabs with mint chutney & onion rings",
    price: 780,
    goldPrice: 680,
    rating: 4.7,
    ratingCount: 423,
    image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop",
    isVeg: false,
    category: "Chef Special",
    isChefSpecial: true,
  },
];

export const menuItems: MenuItem[] = [
  {
    id: "m1",
    name: "Veg Biryani",
    description: "Aromatic basmati rice with seasonal vegetables",
    price: 249,
    goldPrice: 220,
    rating: 4.3,
    ratingCount: 345,
    image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&h=300&fit=crop",
    isVeg: true,
    category: "Biryani",
  },
  {
    id: "m2",
    name: "Paneer Tikka",
    description: "Grilled cottage cheese with spices",
    price: 299,
    goldPrice: 259,
    rating: 4.5,
    ratingCount: 567,
    image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
    isVeg: true,
    category: "Starters",
    isBestseller: true,
  },
  {
    id: "m3",
    name: "Chicken Tikka",
    description: "Tender chicken marinated in yogurt & spices",
    price: 349,
    goldPrice: 299,
    rating: 4.6,
    ratingCount: 789,
    image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop",
    isVeg: false,
    category: "Starters",
  },
  {
    id: "m4",
    name: "Dal Makhani",
    description: "Slow-cooked black lentils with butter & cream",
    price: 220,
    goldPrice: 189,
    rating: 4.4,
    ratingCount: 456,
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop",
    isVeg: true,
    category: "Main Course",
  },
  {
    id: "m5",
    name: "Butter Naan",
    description: "Soft leavened bread with butter",
    price: 60,
    goldPrice: 50,
    rating: 4.2,
    ratingCount: 234,
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop",
    isVeg: true,
    category: "Breads",
  },
  {
    id: "m6",
    name: "Gulab Jamun",
    description: "Soft dumplings soaked in sugar syrup",
    price: 99,
    goldPrice: 79,
    rating: 4.7,
    ratingCount: 678,
    image: "https://images.unsplash.com/photo-1666190053048-1c09553d2db4?w=400&h=300&fit=crop",
    isVeg: true,
    category: "Dessert",
  },
];

export const restaurantInfo = {
  name: "Harvest DineIQ",
  tagline: "Experience the Bounty of the Valley",
};
