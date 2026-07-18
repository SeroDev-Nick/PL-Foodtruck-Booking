import { addDays, format, parseISO } from "date-fns";
import { notFound, redirect } from "next/navigation";
import {
  ManagerBookingHistory,
  type ManagerBookingRow,
} from "@/components/dashboard/ManagerBookingHistory";
import { requireManagerSession } from "@/lib/auth/require-manager";
import { isStoredBookingCategory } from "@/lib/categories";
import { todayIsoLocal } from "@/lib/dates/today";
import { createAdminClient } from "@/lib/supabase/admin";

type TruckBookingsPageProps = {
  params: Promise<{ truckId: string }>;
  searchParams: Promise<{ fullHistory?: string }>;
};

export default async function TruckBookingsPage({
  params,
  searchParams,
}: TruckBookingsPageProps) {
  const session = await requireManagerSession();
  if (!session.ok) {
    redirect("/login");
  }

  const { truckId } = await params;
  const { fullHistory } = await searchParams;
  const showingFullHistory = fullHistory === "1";

  const admin = createAdminClient();
  const { data: truck, error: truckError } = await admin
    .from("trucks")
    .select("id, business_name")
    .eq("id", truckId)
    .maybeSingle();

  if (truckError || !truck) {
    notFound();
  }

  const todayIso = todayIsoLocal();
  const rangeStart = format(addDays(parseISO(todayIso), -30), "yyyy-MM-dd");

  let query = admin
    .from("bookings")
    .select(
      "id, booking_date, start_time, end_time, category, notes, no_show",
    )
    .eq("truck_id", truckId)
    .order("booking_date", { ascending: false })
    .order("start_time", { ascending: true });

  if (!showingFullHistory) {
    query = query.gte("booking_date", rangeStart);
  }

  const { data: bookingRows, error: bookingsError } = await query;

  const bookings: ManagerBookingRow[] = (bookingRows ?? [])
    .filter((row) => isStoredBookingCategory(String(row.category)))
    .map((row) => {
      const bookingDate = row.booking_date as string;
      return {
        id: row.id as string,
        bookingDate,
        startTime: String(row.start_time),
        endTime: String(row.end_time),
        category: row.category as ManagerBookingRow["category"],
        notes: (row.notes as string | null) ?? null,
        noShow: Boolean(row.no_show),
        isCancelable: bookingDate >= todayIso,
      };
    });

  return (
    <main>
      {bookingsError ? (
        <p
          className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]"
          role="alert"
        >
          Could not load bookings. If you just deployed, confirm migration 007
          (`bookings.no_show`) has been applied.
        </p>
      ) : null}
      <ManagerBookingHistory
        truckId={truck.id as string}
        businessName={truck.business_name as string}
        bookings={bookings}
        showingFullHistory={showingFullHistory}
      />
    </main>
  );
}
