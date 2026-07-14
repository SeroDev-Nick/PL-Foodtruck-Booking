"use server";

import { headers } from "next/headers";
import { isBookingSubmitRateLimited } from "@/lib/bookings/rate-limit";
import {
  bookingSubmissionSchema,
  MAX_DAYS_PER_SUBMISSION,
  type BookingDayFailure,
  type BookingDayFailureReason,
  type SubmitBookingsResult,
} from "@/lib/bookings/schema";
import { createAdminClient } from "@/lib/supabase/admin";

type SubmitBookingsInput = {
  category: string;
  truckId: string;
  notes?: string;
  days: Array<{ date: string; startTime: string; endTime: string }>;
  /** Honeypot — must be empty. */
  companyWebsite: string;
};

async function resolveClientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headerStore.get("x-real-ip")?.trim() || "unknown";
}

async function classifyTruckIneligibility(
  admin: ReturnType<typeof createAdminClient>,
  truckId: string,
): Promise<BookingDayFailureReason> {
  const { data: truck } = await admin
    .from("trucks")
    .select("manager_approved, coi_expiration_date")
    .eq("id", truckId)
    .maybeSingle();

  if (!truck) {
    return "truck_ineligible";
  }

  if (!truck.manager_approved) {
    return "awaiting_approval";
  }

  const expiration = truck.coi_expiration_date as string;
  const today = new Date();
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  if (expiration < todayIso) {
    return "coi_expired";
  }

  return "truck_ineligible";
}

export async function submitBookings(
  input: SubmitBookingsInput,
): Promise<SubmitBookingsResult> {
  // Silent rejection for bot honeypot — same generic response as rate limit.
  if (input.companyWebsite.trim() !== "") {
    return { ok: false, error: "Unable to submit booking. Please try again." };
  }

  const ip = await resolveClientIp();
  if (isBookingSubmitRateLimited(ip)) {
    return {
      ok: false,
      error: "Too many booking attempts. Please wait a minute and try again.",
    };
  }

  // Defensive ceiling against malformed/malicious payloads — not a user-facing limit.
  if (input.days.length > MAX_DAYS_PER_SUBMISSION) {
    return { ok: false, error: "Unable to submit booking. Please try again." };
  }

  const parsed = bookingSubmissionSchema.safeParse({
    category: input.category,
    truckId: input.truckId,
    notes: input.notes?.trim() ? input.notes.trim() : undefined,
    days: input.days,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid booking data.";
    return { ok: false, error: first };
  }

  const admin = createAdminClient();
  const { category, truckId, notes, days } = parsed.data;

  const succeededDates: string[] = [];
  const failures: BookingDayFailure[] = [];

  // CRITICAL: one insert per day — never a multi-row array insert — so a
  // 2-per-day trigger failure on one date cannot roll back other valid days.
  for (const day of days) {
    const { data: bookableTruck } = await admin
      .from("bookable_trucks")
      .select("id")
      .eq("id", truckId)
      .maybeSingle();

    if (!bookableTruck) {
      const reason = await classifyTruckIneligibility(admin, truckId);
      failures.push({ date: day.date, reason });
      continue;
    }

    const { count, error: countError } = await admin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("booking_date", day.date);

    if (countError) {
      failures.push({ date: day.date, reason: "insert_failed" });
      continue;
    }

    if ((count ?? 0) >= 2) {
      failures.push({ date: day.date, reason: "day_full" });
      continue;
    }

    const { error: insertError } = await admin.from("bookings").insert({
      truck_id: truckId,
      category,
      booking_date: day.date,
      start_time: day.startTime,
      end_time: day.endTime,
      notes: notes ?? null,
    });

    if (insertError) {
      const message = insertError.message.toLowerCase();
      if (message.includes("maximum 2 bookings") || message.includes("daily")) {
        failures.push({ date: day.date, reason: "day_full" });
      } else {
        failures.push({ date: day.date, reason: "insert_failed" });
      }
      continue;
    }

    succeededDates.push(day.date);
  }

  return { ok: true, succeededDates, failures };
}
