"use client";

import { endOfMonth, format, startOfMonth } from "date-fns";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingFlow } from "@/components/BookingFlow";
import { MonthBookingModal } from "@/components/MonthBookingModal";
import { PlanAheadGrid } from "@/components/PlanAheadGrid";
import { fetchBookingsForRange } from "@/lib/bookings/fetch-range";
import {
  BOOKING_CATEGORY_STORAGE_KEY,
  CATEGORY_LABELS,
  isBookingCategory,
  type BookingCategory,
} from "@/lib/categories";
import type { DayBooking } from "@/lib/calendar/day-state";
import {
  getPlanAheadMonths,
  getPlanAheadRangeBounds,
  shiftMonthWithinWindow,
  type PlanAheadYearMode,
} from "@/lib/calendar/plan-ahead-months";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; bookingsByDate: Record<string, DayBooking[]> };

type BookTab = "thisMonth" | "planAhead";

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

const tabButtonClass = (active: boolean) =>
  `min-h-11 rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${
    active
      ? "bg-[var(--control-bg)] text-[var(--page-fg)] border border-[var(--control-border)]"
      : "text-[var(--page-muted)] hover:text-[var(--page-fg)]"
  }`;

function BookPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const category =
    categoryParam && isBookingCategory(categoryParam) ? categoryParam : null;
  const isClient = useIsClient();
  const sessionMatches = useSessionCategoryMatch(category);
  const isAllowed = isClient && category !== null && sessionMatches;

  const [tab, setTab] = useState<BookTab>("thisMonth");
  const [yearMode, setYearMode] =
    useState<PlanAheadYearMode>("currentRemaining");
  const [thisMonthLoad, setThisMonthLoad] = useState<LoadState>({
    status: "loading",
  });
  const [planAheadLoad, setPlanAheadLoad] = useState<LoadState>({
    status: "loading",
  });

  const [modalMonth, setModalMonth] = useState<Date | null>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

  const referenceDate = useMemo(() => new Date(), []);
  const thisMonth = useMemo(() => startOfMonth(referenceDate), [referenceDate]);
  const planAheadMonths = useMemo(
    () => getPlanAheadMonths(yearMode, referenceDate),
    [yearMode, referenceDate],
  );
  const planAheadBounds = useMemo(
    () => getPlanAheadRangeBounds(planAheadMonths),
    [planAheadMonths],
  );

  useEffect(() => {
    if (!isClient) {
      return;
    }
    if (!category || !sessionMatches) {
      router.replace("/");
    }
  }, [isClient, category, sessionMatches, router]);

  const refreshThisMonth = useCallback(async () => {
    const result = await fetchBookingsForRange(
      startOfMonth(thisMonth),
      endOfMonth(thisMonth),
    );
    if (!result.ok) {
      setThisMonthLoad({ status: "error", message: result.message });
      return;
    }
    setThisMonthLoad({
      status: "ready",
      bookingsByDate: result.bookingsByDate,
    });
  }, [thisMonth]);

  const refreshPlanAhead = useCallback(async () => {
    if (!planAheadBounds) {
      setPlanAheadLoad({ status: "ready", bookingsByDate: {} });
      return;
    }

    const result = await fetchBookingsForRange(
      planAheadBounds.rangeStart,
      planAheadBounds.rangeEnd,
    );
    if (!result.ok) {
      setPlanAheadLoad({ status: "error", message: result.message });
      return;
    }
    setPlanAheadLoad({
      status: "ready",
      bookingsByDate: result.bookingsByDate,
    });
  }, [planAheadBounds]);

  useEffect(() => {
    if (!isAllowed || !category || tab !== "thisMonth") {
      return;
    }

    let cancelled = false;

    async function run() {
      const result = await fetchBookingsForRange(
        startOfMonth(thisMonth),
        endOfMonth(thisMonth),
      );
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setThisMonthLoad({ status: "error", message: result.message });
        return;
      }
      setThisMonthLoad({
        status: "ready",
        bookingsByDate: result.bookingsByDate,
      });
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [isAllowed, category, tab, thisMonth]);

  useEffect(() => {
    if (!isAllowed || !category || tab !== "planAhead") {
      return;
    }

    let cancelled = false;

    async function run() {
      if (!planAheadBounds) {
        if (!cancelled) {
          setPlanAheadLoad({ status: "ready", bookingsByDate: {} });
        }
        return;
      }

      const result = await fetchBookingsForRange(
        planAheadBounds.rangeStart,
        planAheadBounds.rangeEnd,
      );
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setPlanAheadLoad({ status: "error", message: result.message });
        return;
      }
      setPlanAheadLoad({
        status: "ready",
        bookingsByDate: result.bookingsByDate,
      });
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [isAllowed, category, tab, planAheadBounds]);

  useEffect(() => {
    if (!modalMonth) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalMonth]);

  function selectTab(next: BookTab) {
    setTab(next);
    if (next === "thisMonth") {
      setThisMonthLoad({ status: "loading" });
      setModalMonth(null);
    } else {
      setPlanAheadLoad({ status: "loading" });
      setModalMonth(null);
    }
  }

  function selectYearMode(next: PlanAheadYearMode) {
    setYearMode(next);
    setPlanAheadLoad({ status: "loading" });
    setModalMonth(null);
  }

  function closeModal() {
    setModalMonth(null);
    const opener = returnFocusRef.current;
    requestAnimationFrame(() => {
      opener?.focus();
    });
  }

  function openMonth(month: Date, opener: HTMLButtonElement) {
    returnFocusRef.current = opener;
    setModalMonth(month);
  }

  const modalCanGoPrev = Boolean(
    modalMonth &&
      shiftMonthWithinWindow(modalMonth, -1, planAheadMonths) !== null,
  );
  const modalCanGoNext = Boolean(
    modalMonth &&
      shiftMonthWithinWindow(modalMonth, 1, planAheadMonths) !== null,
  );

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
        <header className="flex flex-col gap-3">
          <p className="text-sm font-medium text-[var(--page-muted)]">
            Category: {CATEGORY_LABELS[category]}
          </p>
          <div
            role="tablist"
            aria-label="Booking views"
            className="flex flex-wrap gap-2"
          >
            <button
              type="button"
              role="tab"
              id="tab-this-month"
              aria-selected={tab === "thisMonth"}
              aria-controls="panel-this-month"
              className={tabButtonClass(tab === "thisMonth")}
              onClick={() => selectTab("thisMonth")}
            >
              This month
            </button>
            <button
              type="button"
              role="tab"
              id="tab-plan-ahead"
              aria-selected={tab === "planAhead"}
              aria-controls="panel-plan-ahead"
              className={tabButtonClass(tab === "planAhead")}
              onClick={() => selectTab("planAhead")}
            >
              Plan Ahead
            </button>
          </div>
        </header>

        {tab === "thisMonth" ? (
          <div
            role="tabpanel"
            id="panel-this-month"
            aria-labelledby="tab-this-month"
            className="flex flex-col gap-6"
          >
            {thisMonthLoad.status === "loading" ? (
              <p className="text-[var(--page-muted)]" role="status">
                Loading calendar…
              </p>
            ) : null}
            {thisMonthLoad.status === "error" ? (
              <p
                className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-[var(--error-fg)]"
                role="alert"
              >
                {thisMonthLoad.message}
              </p>
            ) : null}
            {thisMonthLoad.status === "ready" ? (
              <BookingFlow
                category={category}
                month={thisMonth}
                bookingsByDate={thisMonthLoad.bookingsByDate}
                onRefreshBookings={refreshThisMonth}
              />
            ) : null}
          </div>
        ) : null}

        {tab === "planAhead" ? (
          <div
            role="tabpanel"
            id="panel-plan-ahead"
            aria-labelledby="tab-plan-ahead"
            className="flex flex-col gap-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--page-fg)] sm:text-3xl">
                Plan Ahead
              </h1>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={tabButtonClass(yearMode === "currentRemaining")}
                  aria-pressed={yearMode === "currentRemaining"}
                  disabled={yearMode === "currentRemaining"}
                  onClick={() => selectYearMode("currentRemaining")}
                >
                  {format(referenceDate, "yyyy")} remaining
                </button>
                <button
                  type="button"
                  className={tabButtonClass(yearMode === "nextFull")}
                  aria-pressed={yearMode === "nextFull"}
                  disabled={yearMode === "nextFull"}
                  onClick={() => selectYearMode("nextFull")}
                >
                  {Number(format(referenceDate, "yyyy")) + 1}
                </button>
              </div>
            </div>

            <p className="text-sm text-[var(--page-muted)]">
              {yearMode === "currentRemaining"
                ? planAheadMonths.length > 0
                  ? `Showing ${format(planAheadMonths[0]!, "MMMM")}–${format(planAheadMonths[planAheadMonths.length - 1]!, "MMMM yyyy")}.`
                  : `No remaining months in ${format(referenceDate, "yyyy")}.`
                : `Showing January–December ${Number(format(referenceDate, "yyyy")) + 1}.`}
            </p>

            {planAheadLoad.status === "loading" ? (
              <p className="text-[var(--page-muted)]" role="status">
                Loading year overview…
              </p>
            ) : null}
            {planAheadLoad.status === "error" ? (
              <p
                className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-[var(--error-fg)]"
                role="alert"
              >
                {planAheadLoad.message}
              </p>
            ) : null}
            {planAheadLoad.status === "ready" ? (
              <PlanAheadGrid
                months={planAheadMonths}
                selectedCategory={category}
                bookingsByDate={planAheadLoad.bookingsByDate}
                onOpenMonth={openMonth}
              />
            ) : null}
          </div>
        ) : null}
      </main>

      {modalMonth && planAheadLoad.status === "ready" ? (
        <MonthBookingModal
          isOpen
          month={modalMonth}
          category={category}
          bookingsByDate={planAheadLoad.bookingsByDate}
          canGoPrev={modalCanGoPrev}
          canGoNext={modalCanGoNext}
          onPrevMonth={() => {
            const next = shiftMonthWithinWindow(
              modalMonth,
              -1,
              planAheadMonths,
            );
            if (next) {
              setModalMonth(next);
            }
          }}
          onNextMonth={() => {
            const next = shiftMonthWithinWindow(modalMonth, 1, planAheadMonths);
            if (next) {
              setModalMonth(next);
            }
          }}
          onClose={closeModal}
          onRefreshBookings={refreshPlanAhead}
        />
      ) : null}
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
