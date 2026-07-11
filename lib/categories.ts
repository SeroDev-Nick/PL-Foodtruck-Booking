export const CATEGORIES = [
  "meal",
  "coffee",
  "beverage",
  "dessert",
  "snacks",
] as const;

export type BookingCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<BookingCategory, string> = {
  meal: "Meal",
  coffee: "Coffee",
  beverage: "Beverage",
  dessert: "Dessert",
  snacks: "Snacks",
};

export const BOOKING_CATEGORY_STORAGE_KEY = "bookingCategory";

export function isBookingCategory(value: string): value is BookingCategory {
  return (CATEGORIES as readonly string[]).includes(value);
}
