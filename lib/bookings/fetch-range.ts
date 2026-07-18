import { format } from "date-fns";
import type { StoredBookingCategory } from "@/lib/categories";
import { isStoredBookingCategory } from "@/lib/categories";
import type { DayBooking } from "@/lib/calendar/day-state";
import { createClient } from "@/lib/supabase/client";

type BookingRow = {
  id: string;
  category: string;
  booking_date: string;
  truck_id: string | null;
};

type TruckNameRow = {
  id: string;
  business_name: string;
};

export type FetchBookingsResult =
  | { ok: true; bookingsByDate: Record<string, DayBooking[]> }
  | { ok: false; message: string };

/**
 * Fetch bookings (with truck display names) for an inclusive local date range.
 */
export async function fetchBookingsForRange(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<FetchBookingsResult> {
  const monthStart = format(rangeStart, "yyyy-MM-dd");
  const monthEnd = format(rangeEnd, "yyyy-MM-dd");
  const supabase = createClient();

  const [bookingsResult, namesResult] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, category, booking_date, truck_id")
      .gte("booking_date", monthStart)
      .lte("booking_date", monthEnd),
    supabase.from("truck_names").select("id, business_name"),
  ]);

  if (bookingsResult.error) {
    return {
      ok: false,
      message: "Could not load bookings. Please try again.",
    };
  }

  const nameById = new Map<string, string>();
  if (!namesResult.error) {
    for (const row of (namesResult.data ?? []) as TruckNameRow[]) {
      nameById.set(row.id, row.business_name);
    }
  }

  const bookingsByDate: Record<string, DayBooking[]> = {};
  for (const row of (bookingsResult.data ?? []) as BookingRow[]) {
    if (!isStoredBookingCategory(row.category)) {
      continue;
    }
    const key = row.booking_date;
    if (!bookingsByDate[key]) {
      bookingsByDate[key] = [];
    }
    bookingsByDate[key].push({
      id: row.id,
      category: row.category as StoredBookingCategory,
      truckId: row.truck_id,
      businessName: row.truck_id ? (nameById.get(row.truck_id) ?? null) : null,
    });
  }

  return { ok: true, bookingsByDate };
}
