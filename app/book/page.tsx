"use client";

import { endOfMonth, format, startOfMonth } from "date-fns";
import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MonthCalendar } from "@/components/MonthCalendar";
import {
  BOOKING_CATEGORY_STORAGE_KEY,
  CATEGORY_LABELS,
  isBookingCategory,
  type BookingCategory,
} from "@/lib/categories";
import type { DayBooking } from "@/lib/calendar/day-state";
import { createClient } from "@/lib/supabase/client";

type BookingRow = {
  id: string;
  category: BookingCategory;
  booking_date: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; bookingsByDate: Record<string, DayBooking[]> };

function subscribeToNothing() {
  return () => {};
}

function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

function useSessionCategoryMatch(category: BookingCategory | null): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => {
      if (!category) {
        return false;
      }
      return sessionStorage.getItem(BOOKING_CATEGORY_STORAGE_KEY) === category;
    },
    () => false,
  );
}

function BookPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const category =
    categoryParam && isBookingCategory(categoryParam) ? categoryParam : null;
  const isClient = useIsClient();
  const sessionMatches = useSessionCategoryMatch(category);
  const isAllowed = isClient && category !== null && sessionMatches;

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const month = useMemo(() => new Date(), []);
  const monthLabel = format(month, "MMMM yyyy");

  useEffect(() => {
    if (!isClient) {
      return;
    }
    if (!category || !sessionMatches) {
      router.replace("/");
    }
  }, [isClient, category, sessionMatches, router]);

  useEffect(() => {
    if (!isAllowed || !category) {
      return;
    }

    let cancelled = false;

    async function fetchBookings() {
      setLoadState({ status: "loading" });

      const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("bookings")
        .select("id, category, booking_date")
        .gte("booking_date", monthStart)
        .lte("booking_date", monthEnd);

      if (cancelled) {
        return;
      }

      if (error) {
        setLoadState({
          status: "error",
          message: "Could not load bookings. Please try again.",
        });
        return;
      }

      const bookingsByDate: Record<string, DayBooking[]> = {};
      for (const row of (data ?? []) as BookingRow[]) {
        const key = row.booking_date;
        if (!bookingsByDate[key]) {
          bookingsByDate[key] = [];
        }
        bookingsByDate[key].push({ category: row.category });
      }

      setLoadState({ status: "ready", bookingsByDate });
    }

    void fetchBookings();

    return () => {
      cancelled = true;
    };
  }, [isAllowed, category, month]);

  if (!isAllowed || !category) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <p className="text-[var(--page-muted)]" role="status">
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[var(--page-bg)]">
      <main className="mx-auto flex w-full min-w-0 max-w-3xl flex-1 flex-col gap-6 px-3 py-8 sm:px-6">
        <header className="flex flex-col gap-1">
          <p className="text-sm font-medium text-[var(--page-muted)]">
            Category: {CATEGORY_LABELS[category]}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--page-fg)] sm:text-3xl">
            {monthLabel}
          </h1>
        </header>

        {loadState.status === "loading" ? (
          <p className="text-[var(--page-muted)]" role="status">
            Loading calendar…
          </p>
        ) : null}

        {loadState.status === "error" ? (
          <p
            className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-[var(--error-fg)]"
            role="alert"
          >
            {loadState.message}
          </p>
        ) : null}

        {loadState.status === "ready" ? (
          <MonthCalendar
            month={month}
            selectedCategory={category}
            bookingsByDate={loadState.bookingsByDate}
          />
        ) : null}
      </main>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <p className="text-[var(--page-muted)]" role="status">
            Loading…
          </p>
        </div>
      }
    >
      <BookPageContent />
    </Suspense>
  );
}
