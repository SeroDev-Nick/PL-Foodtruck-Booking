import type { BookingCategory } from "@/lib/categories";

export type DayState = "open" | "recommended" | "same_category" | "full";

export type DayBooking = {
  id: string;
  category: BookingCategory;
  truckId?: string | null;
  businessName?: string | null;
};

/**
 * Resolve the display state for a day given existing bookings and the viewer's category.
 * Priority: Full (2) → Same Category → Recommended → Open.
 */
export function resolveDayState(
  bookingsForDay: readonly DayBooking[],
  selectedCategory: BookingCategory,
): DayState {
  const count = bookingsForDay.length;

  if (count >= 2) {
    return "full";
  }

  if (count === 0) {
    return "open";
  }

  const hasSameCategory = bookingsForDay.some(
    (booking) => booking.category === selectedCategory,
  );

  if (hasSameCategory) {
    return "same_category";
  }

  return "recommended";
}

export function slotsRemaining(bookingCount: number, maxSlots = 2): number {
  return Math.max(0, maxSlots - bookingCount);
}
