"use server";

import { requireManagerSession } from "@/lib/auth/require-manager";
import { buildCsv } from "@/lib/csv";
import { todayIsoLocal } from "@/lib/dates/today";
import { createAdminClient } from "@/lib/supabase/admin";

export type CsvExportResult =
  | { ok: true; fileName: string; content: string }
  | { ok: false; error: string };

/** All trucks as a standalone CSV (truck-level attributes only). */
export async function exportTrucksCsv(): Promise<CsvExportResult> {
  const session = await requireManagerSession();
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("trucks")
    .select(
      "business_name, contact_email, phone_number, coi_expiration_date, manager_approved, created_at",
    )
    .order("business_name", { ascending: true });

  if (error) {
    return {
      ok: false,
      error: "Could not export trucks. Please try again.",
    };
  }

  const todayIso = todayIsoLocal();
  const headers = [
    "Business name",
    "Contact email",
    "Phone number",
    "COI expiration date",
    "COI status",
    "Approved to book",
    "Registered on",
  ];

  const rows = (data ?? []).map((truck) => {
    const expiration = String(truck.coi_expiration_date ?? "");
    // CSV uses a binary Valid/Expired label; the dashboard keeps its 30-day warning.
    const coiStatus =
      expiration && expiration >= todayIso ? "Valid" : "Expired";
    return [
      truck.business_name,
      truck.contact_email,
      truck.phone_number,
      expiration,
      coiStatus,
      truck.manager_approved ? "Yes" : "No",
      truck.created_at ? String(truck.created_at).slice(0, 10) : "",
    ];
  });

  return {
    ok: true,
    fileName: `trucks-${todayIso}.csv`,
    content: buildCsv(headers, rows),
  };
}

/** All bookings as a standalone CSV (one row per booking). */
export async function exportBookingsCsv(): Promise<CsvExportResult> {
  const session = await requireManagerSession();
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(
      "booking_date, start_time, end_time, category, notes, no_show, truck_id, trucks(business_name)",
    )
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    return {
      ok: false,
      error: "Could not export bookings. Please try again.",
    };
  }

  const todayIso = todayIsoLocal();
  const headers = [
    "Business name",
    "Booking date",
    "Start time",
    "End time",
    "Category",
    "Notes",
    "No-show",
  ];

  const rows = (data ?? []).map((booking) => {
    const truckRelation = booking.trucks as
      | { business_name?: string | null }
      | { business_name?: string | null }[]
      | null;
    const businessName = Array.isArray(truckRelation)
      ? (truckRelation[0]?.business_name ?? "")
      : (truckRelation?.business_name ?? "");

    return [
      businessName,
      booking.booking_date,
      String(booking.start_time ?? "").slice(0, 5),
      String(booking.end_time ?? "").slice(0, 5),
      booking.category,
      booking.notes ?? "",
      booking.no_show ? "Yes" : "No",
    ];
  });

  return {
    ok: true,
    fileName: `bookings-${todayIso}.csv`,
    content: buildCsv(headers, rows),
  };
}
