// Types mirroring lib/foodpilot-data.json (generated from real project data).

export interface AddOn {
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  emoji: string;
  description: string | null;
  price: number;
  dietary: string[];
  spice: "mild" | "medium" | "spicy" | null;
  calories: number | null;
  protein_g: number | null;
  prep_min: number | null;
  popularity: number;
  available: boolean;
  base_ingredients: string[];
  removable: string[];
  add_ons: AddOn[];
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  sentiment: "positive" | "neutral" | "negative";
  topics: string[];
  date: string;
}

export interface SalesByDay {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopItem {
  name: string;
  qty: number;
  revenue: number;
}

export interface Sales {
  revenue: number;
  orders: number;
  aov: number;
  sales_by_day: SalesByDay[];
  top_items: TopItem[];
}

export interface Complaint {
  topic: string;
  count: number;
  pct: number;
}

export interface ReviewExample {
  author: string;
  rating: number;
  text: string;
  date: string;
}

export interface ReviewIntel {
  counts: { positive: number; neutral: number; negative: number };
  total: number;
  complaints: Complaint[];
  examples: Record<string, ReviewExample[]>;
  highlights: ReviewExample[];
}

export interface Truck {
  id: string;
  name: string;
  slug: string;
  cuisines: string[];
  emoji: string;
  rating: number | null;
  review_count: number | null;
  price_tier: string;
  status: string;
  prep_min: number | null;
  queue_min: number | null;
  address: string | null;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  amenities: string[];
  payment_methods: string[];
  order_type: string[];
  hours_today: string | null;
  blurb: string | null;
  image: string | null;
  photo: string | null;
  menu: MenuItem[];
  reviews: Review[];
  sales: Sales;
  avg_rating_reviews: number | null;
  review_intel: ReviewIntel;
}

export interface FeaturedDish {
  truck: string;
  truckId: string;
  emoji: string;
  name: string;
  price: number;
  dietary: string[];
  rating: number | null;
}

export interface Overall {
  sales: Sales;
  review_intel: ReviewIntel;
  avg_rating_reviews: number | null;
  truck_count: number;
  menu_count: number;
  review_count: number;
  order_count: number;
}

export interface FoodPilotData {
  generatedFrom: string;
  trucks: Truck[];
  overall: Overall;
  featured_dishes: FeaturedDish[];
  cuisine_emoji: Record<string, string>;
}

// ---- Order builder / cart -------------------------------------------------

export type ModStatus = "applied" | "rejected" | "pending";

export interface OrderMod {
  type: "add" | "remove";
  name: string;
  priceDelta: number;
  status: ModStatus;
  reason?: string;
  condition?: string | null;
  appliesTo: number; // how many units
}

export interface OrderLine {
  id: string;
  itemId: string;
  truckId: string;
  truckName: string;
  name: string;
  emoji: string;
  basePrice: number;
  quantity: number;
  mods: OrderMod[];
  note?: string;
}

export interface ConfirmedOrder {
  id: string;
  lines: OrderLine[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  truckId: string;
  truckName: string;
  placedAt: string;
  etaMin: number;
  pickup: string | null;
}

// ---- Parsed customer query (Phase 1) --------------------------------------

export interface ParsedQuery {
  diet?: "vegetarian" | "vegan" | null;
  spice_level?: "mild" | "medium" | "spicy" | null;
  max_price?: number | null;
  cuisine?: string | null;
  max_wait_min?: number | null;
  meal?: string | null;
  open_now?: boolean | null;
}
