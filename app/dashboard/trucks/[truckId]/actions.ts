"use server";

import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth/require-manager";
import { todayIsoLocal } from "@/lib/dates/today";
import { createAdminClient } from "@/lib/supabase/admin";

export type ManagerBookingActionResult =
  | { ok: true; deletedCount?: number }
  | { ok: false; error: string };

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

/**
 * Hard-delete bookings that are today or in the future for this truck.
 * Past dates are rejected server-side — use mark as no-show instead.
 */
export async function cancelTruckBookings(
  truckId: string,
  bookingIds: string[],
): Promise<ManagerBookingActionResult> {
  const session = await requireManagerSession();
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const ids = uniqueIds(bookingIds);
  if (!truckId || ids.length === 0) {
    return { ok: false, error: "Select at least one booking to cancel." };
  }

  const todayIso = todayIsoLocal();
  const admin = createAdminClient();

  const { data: rows, error: fetchError } = await admin
    .from("bookings")
    .select("id, booking_date, truck_id")
    .eq("truck_id", truckId)
    .in("id", ids);

  if (fetchError) {
    return {
      ok: false,
      error: "Could not load those bookings. Please try again.",
    };
  }

  const found = rows ?? [];
  if (found.length !== ids.length) {
    return {
      ok: false,
      error: "One or more selected bookings could not be found for this truck.",
    };
  }

  const notCancelable = found.filter(
    (row) => (row.booking_date as string) < todayIso,
  );
  if (notCancelable.length > 0) {
    return {
      ok: false,
      error:
        "Past bookings cannot be canceled. Mark them as no-show instead.",
    };
  }

  const { error: deleteError, count } = await admin
    .from("bookings")
    .delete({ count: "exact" })
    .eq("truck_id", truckId)
    .in("id", ids)
    .gte("booking_date", todayIso);

  if (deleteError) {
    return {
      ok: false,
      error: "Could not cancel those bookings. Please try again.",
    };
  }

  revalidatePath(`/dashboard/trucks/${truckId}`);
  revalidatePath("/dashboard");
  return { ok: true, deletedCount: count ?? ids.length };
}

/**
 * Mark a past booking as no-show. Today/future bookings are rejected.
 */
export async function markBookingNoShow(
  truckId: string,
  bookingId: string,
): Promise<ManagerBookingActionResult> {
  const session = await requireManagerSession();
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  if (!truckId || !bookingId) {
    return { ok: false, error: "Booking not found." };
  }

  const todayIso = todayIsoLocal();
  const admin = createAdminClient();

  const { data: row, error: fetchError } = await admin
    .from("bookings")
    .select("id, booking_date, truck_id, no_show")
    .eq("id", bookingId)
    .eq("truck_id", truckId)
    .maybeSingle();

  if (fetchError || !row) {
    return { ok: false, error: "Booking not found." };
  }

  if ((row.booking_date as string) >= todayIso) {
    return {
      ok: false,
      error: "Only past bookings can be marked as no-show.",
    };
  }

  if (row.no_show) {
    return { ok: true };
  }

  const { error: updateError } = await admin
    .from("bookings")
    .update({ no_show: true })
    .eq("id", bookingId)
    .eq("truck_id", truckId)
    .lt("booking_date", todayIso);

  if (updateError) {
    return {
      ok: false,
      error: "Could not mark this booking as no-show. Please try again.",
    };
  }

  revalidatePath(`/dashboard/trucks/${truckId}`);
  return { ok: true };
}
