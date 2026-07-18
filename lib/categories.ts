/** Selectable categories offered by the app UI (new bookings only). */
export const CATEGORIES = ["meal", "beverage", "dessert"] as const;

export type BookingCategory = (typeof CATEGORIES)[number];

/**
 * Former selectable values that may still appear on historical booking rows.
 * The Postgres booking_category enum still includes these; the app no longer offers them.
 */
export const HISTORICAL_CATEGORIES = ["coffee", "snacks"] as const;

export type HistoricalBookingCategory = (typeof HISTORICAL_CATEGORIES)[number];

/** Any category that can appear on a stored booking row. */
export type StoredBookingCategory = BookingCategory | HistoricalBookingCategory;

export const CATEGORY_LABELS: Record<BookingCategory, string> = {
  meal: "Meal",
  beverage: "Beverage",
  dessert: "Dessert",
};

const HISTORICAL_CATEGORY_LABELS: Record<HistoricalBookingCategory, string> = {
  coffee: "Coffee",
  snacks: "Snacks",
};

export const BOOKING_CATEGORY_STORAGE_KEY = "bookingCategory";

export function isBookingCategory(value: string): value is BookingCategory {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isStoredBookingCategory(
  value: string,
): value is StoredBookingCategory {
  return (
    isBookingCategory(value) ||
    (HISTORICAL_CATEGORIES as readonly string[]).includes(value)
  );
}

/** Human-readable label for selectable or historical categories. */
export function labelForCategory(category: string): string {
  if (isBookingCategory(category)) {
    return CATEGORY_LABELS[category];
  }
  if (
    (HISTORICAL_CATEGORIES as readonly string[]).includes(
      category as HistoricalBookingCategory,
    )
  ) {
    return HISTORICAL_CATEGORY_LABELS[category as HistoricalBookingCategory];
  }
  return category;
}
