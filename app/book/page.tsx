"use client";

import { endOfMonth, format, startOfMonth } from "date-fns";
import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitBookings } from "@/app/book/actions";
import { MonthCalendar } from "@/components/MonthCalendar";
import {
  clearBookingDraft,
  createEmptyDayTimes,
  readBookingDraft,
  writeBookingDraft,
  type BookingDraftDay,
} from "@/lib/bookings/draft";
import { failureMessageForDay } from "@/lib/bookings/messages";
import type { SubmitBookingsResult } from "@/lib/bookings/schema";
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
  truck_id: string | null;
};

type TruckNameRow = {
  id: string;
  business_name: string;
};

type BookableTruck = {
  id: string;
  business_name: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; bookingsByDate: Record<string, DayBooking[]> };

type Step = "dates" | "identity" | "result";

const fieldClassName =
  "w-full rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-base text-[var(--page-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

const buttonClassName =
  "flex min-h-11 items-center justify-center rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-4 py-2.5 text-base font-medium text-[var(--page-fg)] transition-colors hover:bg-[var(--control-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

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

function managerMailtoHref(): string | null {
  const email = process.env.NEXT_PUBLIC_MANAGER_EMAIL?.trim();
  if (!email) {
    return null;
  }
  return `mailto:${email}`;
}

function useMatchingBookingDraft(category: BookingCategory | null) {
  return useSyncExternalStore(
    subscribeToNothing,
    () => {
      if (!category) {
        return null;
      }
      const draft = readBookingDraft();
      if (draft && draft.category === category) {
        return draft;
      }
      return null;
    },
    () => null,
  );
}

function timesAreValid(day: BookingDraftDay): boolean {
  return Boolean(day.startTime && day.endTime && day.endTime > day.startTime);
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
  const storedDraft = useMatchingBookingDraft(category);

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selectedDaysOverride, setSelectedDaysOverride] = useState<Record<
    string,
    BookingDraftDay
  > | null>(null);
  const [notesOverride, setNotesOverride] = useState<string | null>(null);
  const [stepOverride, setStepOverride] = useState<Step | null>(null);
  const [applyStart, setApplyStart] = useState("15:00");
  const [applyEnd, setApplyEnd] = useState("20:00");
  const [trucks, setTrucks] = useState<BookableTruck[] | null>(null);
  const [trucksError, setTrucksError] = useState<string | null>(null);
  const [truckId, setTruckId] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<Extract<
    SubmitBookingsResult,
    { ok: true }
  > | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedDays = useMemo(
    () => selectedDaysOverride ?? storedDraft?.selectedDays ?? {},
    [selectedDaysOverride, storedDraft],
  );
  const notes = notesOverride ?? storedDraft?.notes ?? "";
  const step: Step = useMemo(() => {
    if (stepOverride) {
      return stepOverride;
    }
    if (
      storedDraft?.step === "identity" &&
      Object.keys(storedDraft.selectedDays).length > 0
    ) {
      return "identity";
    }
    return "dates";
  }, [stepOverride, storedDraft]);

  const month = useMemo(() => new Date(), []);
  const monthLabel = format(month, "MMMM yyyy");
  const selectedDateSet = useMemo(
    () => new Set(Object.keys(selectedDays)),
    [selectedDays],
  );
  const selectedDateList = useMemo(
    () => Object.keys(selectedDays).sort(),
    [selectedDays],
  );
  const managerHref = managerMailtoHref();

  const persistDraft = useCallback(
    (
      nextSelected: Record<string, BookingDraftDay>,
      nextNotes: string,
      nextStep: "dates" | "identity",
    ) => {
      if (!category) {
        return;
      }
      writeBookingDraft({
        category,
        selectedDays: nextSelected,
        notes: nextNotes,
        step: nextStep,
      });
    },
    [category],
  );

  useEffect(() => {
    if (!isClient) {
      return;
    }
    if (!category || !sessionMatches) {
      router.replace("/");
    }
  }, [isClient, category, sessionMatches, router]);

  const fetchCalendarData = useCallback(async () => {
    setLoadState({ status: "loading" });

    const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");
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
      setLoadState({
        status: "error",
        message: "Could not load bookings. Please try again.",
      });
      return;
    }

    const nameById = new Map<string, string>();
    if (!namesResult.error) {
      for (const row of (namesResult.data ?? []) as TruckNameRow[]) {
        nameById.set(row.id, row.business_name);
      }
    }

    const bookingsByDate: Record<string, DayBooking[]> = {};
    for (const row of (bookingsResult.data ?? []) as BookingRow[]) {
      const key = row.booking_date;
      if (!bookingsByDate[key]) {
        bookingsByDate[key] = [];
      }
      bookingsByDate[key].push({
        id: row.id,
        category: row.category,
        truckId: row.truck_id,
        businessName: row.truck_id ? (nameById.get(row.truck_id) ?? null) : null,
      });
    }

    setLoadState({ status: "ready", bookingsByDate });
  }, [month]);

  useEffect(() => {
    if (!isAllowed || !category) {
      return;
    }

    let cancelled = false;

    async function run() {
      await fetchCalendarData();
      if (cancelled) {
        return;
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [isAllowed, category, fetchCalendarData]);

  useEffect(() => {
    if (!isClient || !category || step === "result") {
      return;
    }
    if (step === "dates" || step === "identity") {
      persistDraft(selectedDays, notes, step);
    }
  }, [isClient, category, selectedDays, notes, step, persistDraft]);

  useEffect(() => {
    if (step !== "identity" || trucks !== null || !category) {
      return;
    }

    let cancelled = false;

    async function loadTrucks() {
      setTrucksError(null);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bookable_trucks")
        .select("id, business_name")
        .order("business_name");

      if (cancelled) {
        return;
      }

      if (error) {
        setTrucksError("Could not load truck list. Please try again.");
        setTrucks([]);
        return;
      }

      setTrucks((data ?? []) as BookableTruck[]);
    }

    void loadTrucks();

    return () => {
      cancelled = true;
    };
  }, [step, trucks, category]);

  function toggleDate(dateKey: string) {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    if (dateKey <= todayKey) {
      return;
    }

    const next = { ...selectedDays };
    if (next[dateKey]) {
      delete next[dateKey];
    } else {
      next[dateKey] = createEmptyDayTimes();
    }
    setSelectedDaysOverride(next);
    setSubmitError(null);
  }

  function updateDayTime(
    dateKey: string,
    field: "startTime" | "endTime",
    value: string,
  ) {
    const existing = selectedDays[dateKey];
    if (!existing) {
      return;
    }
    setSelectedDaysOverride({
      ...selectedDays,
      [dateKey]: { ...existing, [field]: value },
    });
  }

  function applyTimesToAll() {
    if (!applyEnd || !applyStart || applyEnd <= applyStart) {
      setSubmitError("Apply-to-all needs an end time after the start time.");
      return;
    }
    setSubmitError(null);
    const next: Record<string, BookingDraftDay> = {};
    for (const key of Object.keys(selectedDays)) {
      next[key] = { startTime: applyStart, endTime: applyEnd };
    }
    setSelectedDaysOverride(next);
  }

  function goToIdentity() {
    if (selectedDateList.length === 0) {
      setSubmitError("Select at least one day.");
      return;
    }
    for (const dateKey of selectedDateList) {
      if (!timesAreValid(selectedDays[dateKey]!)) {
        setSubmitError("Each selected day needs an end time after its start time.");
        return;
      }
    }
    setSubmitError(null);
    setTrucks(null);
    setStepOverride("identity");
  }

  function onSubmitBooking() {
    if (!category) {
      return;
    }
    if (!truckId) {
      setSubmitError("Select your truck from the list.");
      return;
    }

    startTransition(async () => {
      setSubmitError(null);
      const result = await submitBookings({
        category,
        truckId,
        notes,
        days: selectedDateList.map((date) => ({
          date,
          startTime: selectedDays[date]!.startTime,
          endTime: selectedDays[date]!.endTime,
        })),
        companyWebsite: honeypot,
      });

      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      const remaining: Record<string, BookingDraftDay> = {};
      for (const failure of result.failures) {
        if (selectedDays[failure.date]) {
          remaining[failure.date] = selectedDays[failure.date]!;
        }
      }
      setSelectedDaysOverride(remaining);
      setSubmitResult(result);
      setStepOverride("result");
      clearBookingDraft();
      await fetchCalendarData();
    });
  }

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
          <>
            <MonthCalendar
              month={month}
              selectedCategory={category}
              bookingsByDate={loadState.bookingsByDate}
              selectedDates={selectedDateSet}
              onToggleDate={step === "dates" ? toggleDate : undefined}
            />

            {step === "dates" ? (
              <section className="flex flex-col gap-4" aria-label="Selected days and times">
                <h2 className="text-lg font-semibold text-[var(--page-fg)]">
                  Selected days
                </h2>
                {selectedDateList.length === 0 ? (
                  <p className="text-[var(--page-muted)]">
                    Tap open, recommended, or same-category days to select them.
                    Full days cannot be selected.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] p-3 sm:flex-row sm:items-end">
                      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
                        Start (apply to all)
                        <input
                          type="time"
                          step={900}
                          className={fieldClassName}
                          value={applyStart}
                          onChange={(event) => setApplyStart(event.target.value)}
                        />
                      </label>
                      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
                        End (apply to all)
                        <input
                          type="time"
                          step={900}
                          className={fieldClassName}
                          value={applyEnd}
                          onChange={(event) => setApplyEnd(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className={buttonClassName}
                        onClick={applyTimesToAll}
                      >
                        Apply to all
                      </button>
                    </div>

                    <ul className="flex list-none flex-col gap-3 p-0">
                      {selectedDateList.map((dateKey) => {
                        const times = selectedDays[dateKey]!;
                        return (
                          <li
                            key={dateKey}
                            className="flex flex-col gap-2 rounded-lg border border-[var(--control-border)] p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <p className="font-medium text-[var(--page-fg)]">
                              {format(new Date(`${dateKey}T00:00:00`), "EEE, MMM d")}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="flex items-center gap-2 text-sm">
                                <span className="sr-only">Start time for {dateKey}</span>
                                <input
                                  type="time"
                                  step={900}
                                  className={fieldClassName}
                                  value={times.startTime}
                                  onChange={(event) =>
                                    updateDayTime(dateKey, "startTime", event.target.value)
                                  }
                                />
                              </label>
                              <span className="text-[var(--page-muted)]">to</span>
                              <label className="flex items-center gap-2 text-sm">
                                <span className="sr-only">End time for {dateKey}</span>
                                <input
                                  type="time"
                                  step={900}
                                  className={fieldClassName}
                                  value={times.endTime}
                                  onChange={(event) =>
                                    updateDayTime(dateKey, "endTime", event.target.value)
                                  }
                                />
                              </label>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                {submitError ? (
                  <p
                    className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-[var(--error-fg)]"
                    role="alert"
                  >
                    {submitError}
                  </p>
                ) : null}

                <button
                  type="button"
                  className={buttonClassName}
                  onClick={goToIdentity}
                  disabled={selectedDateList.length === 0}
                >
                  Continue
                </button>
              </section>
            ) : null}

            {step === "identity" ? (
              <section className="flex flex-col gap-4" aria-label="Confirm truck identity">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-[var(--page-fg)]">
                    Confirm your truck
                  </h2>
                  <button
                    type="button"
                    className="text-sm font-medium text-[var(--focus-ring)] underline-offset-2 hover:underline"
                    onClick={() => {
                      setStepOverride("dates");
                      setSubmitError(null);
                    }}
                  >
                    Back to dates
                  </button>
                </div>

                <p className="text-sm text-[var(--page-muted)]">
                  {selectedDateList.length} day
                  {selectedDateList.length === 1 ? "" : "s"} selected.
                </p>

                {trucks === null ? (
                  <p className="text-[var(--page-muted)]" role="status">
                    Loading trucks…
                  </p>
                ) : (
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Your truck
                    <select
                      className={fieldClassName}
                      value={truckId}
                      onChange={(event) => setTruckId(event.target.value)}
                      required
                    >
                      <option value="">Select your truck…</option>
                      {trucks.map((truck) => (
                        <option key={truck.id} value={truck.id}>
                          {truck.business_name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {trucksError ? (
                  <p
                    className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-[var(--error-fg)]"
                    role="alert"
                  >
                    {trucksError}
                  </p>
                ) : null}

                <p className="text-sm text-[var(--page-muted)]">
                  <Link
                    href="/register"
                    className="font-medium text-[var(--focus-ring)] underline-offset-2 hover:underline"
                  >
                    Don&apos;t see your name here?
                  </Link>
                </p>
                <p className="text-sm text-[var(--page-muted)]">
                  Already registered but don&apos;t see your name?{" "}
                  {managerHref ? (
                    <a
                      href={managerHref}
                      className="font-medium text-[var(--focus-ring)] underline-offset-2 hover:underline"
                    >
                      Contact the manager about your booking status
                    </a>
                  ) : (
                    <span>Contact the manager about your booking status</span>
                  )}
                  .
                </p>

                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Notes (optional)
                  <textarea
                    className={`${fieldClassName} min-h-24`}
                    name="notes"
                    value={notes}
                    onChange={(event) => setNotesOverride(event.target.value)}
                    maxLength={2000}
                  />
                </label>

                {/* Honeypot — leave empty. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-[10000px] h-0 w-0 overflow-hidden opacity-0"
                >
                  <label>
                    Company website
                    <input
                      type="text"
                      name="companyWebsite"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(event) => setHoneypot(event.target.value)}
                    />
                  </label>
                </div>

                {submitError ? (
                  <p
                    className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-[var(--error-fg)]"
                    role="alert"
                  >
                    {submitError}
                  </p>
                ) : null}

                <button
                  type="button"
                  className={buttonClassName}
                  onClick={onSubmitBooking}
                  disabled={isPending || trucks === null || trucks.length === 0}
                >
                  {isPending ? "Submitting…" : "Submit booking"}
                </button>
              </section>
            ) : null}

            {step === "result" && submitResult ? (
              <section
                className="flex flex-col gap-4 rounded-lg border border-[var(--day-recommended-border)] bg-[var(--day-recommended-bg)] px-4 py-4 text-[var(--day-recommended-fg)]"
                aria-label="Booking result"
                role="status"
              >
                <p className="text-base font-medium leading-relaxed">
                  {submitResult.succeededDates.length} of{" "}
                  {submitResult.succeededDates.length + submitResult.failures.length}{" "}
                  day
                  {submitResult.succeededDates.length + submitResult.failures.length === 1
                    ? ""
                    : "s"}{" "}
                  booked successfully
                  {submitResult.succeededDates.length > 0
                    ? ". View them on the calendar."
                    : "."}
                </p>

                {submitResult.failures.length > 0 ? (
                  <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
                    {submitResult.failures.map((failure) => (
                      <li key={`${failure.date}-${failure.reason}`}>
                        {failureMessageForDay(failure)}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <button
                  type="button"
                  className={buttonClassName}
                  onClick={() => {
                    setSubmitResult(null);
                    setSubmitError(null);
                    setTruckId("");
                    setStepOverride("dates");
                    setNotesOverride("");
                  }}
                >
                  Book more days
                </button>
              </section>
            ) : null}
          </>
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
