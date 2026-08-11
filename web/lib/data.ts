import raw from "./foodpilot-data.json";
import type { FoodPilotData, Truck, MenuItem } from "./types";

const data = raw as unknown as FoodPilotData;

export const foodpilot = data;
export const trucks: Truck[] = data.trucks;
export const overall = data.overall;
export const featuredDishes = data.featured_dishes;
export const cuisineEmoji = data.cuisine_emoji;

export function getTruck(id: string): Truck | undefined {
  return trucks.find((t) => t.id === id);
}

/** Trucks that have completed sales — used to scope the Owner truck picker. */
export const salesTrucks: Truck[] = trucks.filter((t) => t.sales.orders > 0);

/** Every menu item across featured trucks, tagged with its truck. */
export function allMenuItems(): (MenuItem & { truckId: string; truckName: string })[] {
  return trucks.flatMap((t) =>
    t.menu.map((m) => ({ ...m, truckId: t.id, truckName: t.name })),
  );
}

export const CUISINES = Array.from(
  new Set(trucks.flatMap((t) => t.cuisines)),
).sort();

export function findTruckByName(name: string): Truck | undefined {
  const n = name.toLowerCase();
  return trucks.find((t) => t.name.toLowerCase().includes(n));
}

/** Owner-side scope: a specific truck, or the "All trucks" aggregate. */
export function scopeData(truckId: string | null) {
  if (truckId) {
    const t = getTruck(truckId);
    if (t)
      return {
        name: t.name,
        sales: t.sales,
        intel: t.review_intel,
        rating: t.avg_rating_reviews ?? t.rating,
        truck: t as Truck | null,
      };
  }
  return {
    name: "All trucks",
    sales: overall.sales,
    intel: overall.review_intel,
    rating: overall.avg_rating_reviews,
    truck: null as Truck | null,
  };
}
