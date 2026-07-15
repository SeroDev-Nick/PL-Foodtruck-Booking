"use client";

import { format } from "date-fns";
import FocusTrap from "focus-trap-react";
import { useId, useRef } from "react";
import { BookingFlow } from "@/components/BookingFlow";
import type { BookingCategory } from "@/lib/categories";
import type { DayBooking } from "@/lib/calendar/day-state";

type MonthBookingModalProps = {
  isOpen: boolean;
  month: Date;
  category: BookingCategory;
  bookingsByDate: Record<string, DayBooking[]>;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onClose: (reason: string) => void;
  onRefreshBookings: () => Promise<void>;
};

const navButtonClassName =
  "flex min-h-10 items-center justify-center rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm font-medium text-[var(--page-fg)] hover:bg-[var(--control-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50";

export function MonthBookingModal({
  isOpen,
  month,
  category,
  bookingsByDate,
  canGoPrev,
  canGoNext,
  onPrevMonth,
  onNextMonth,
  onClose,
  onRefreshBookings,
}: MonthBookingModalProps) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="plan-ahead-modal-root fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={() => {
          console.error("[PlanAheadModal] close requested", {
            reason: "backdrop_click",
            month: format(month, "yyyy-MM"),
          });
          onClose("backdrop_click");
        }}
      />
      <FocusTrap
        focusTrapOptions={{
          initialFocus: () => headingRef.current,
          escapeDeactivates: true,
          allowOutsideClick: true,
          onDeactivate: () => {
            console.error("[PlanAheadModal] close requested", {
              reason: "focus_trap_onDeactivate",
              month: format(month, "yyyy-MM"),
              note: "focus-trap deactivate (Escape, outside click, or trap teardown)",
            });
            onClose("focus_trap_onDeactivate");
          },
          returnFocusOnDeactivate: false,
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="plan-ahead-modal relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border border-[var(--control-border)] bg-[var(--page-bg)] shadow-lg sm:rounded-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--control-border)] px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h2
                id={titleId}
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-semibold tracking-tight text-[var(--page-fg)] outline-none"
              >
                {format(month, "MMMM yyyy")}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={navButtonClassName}
                  onClick={onPrevMonth}
                  disabled={!canGoPrev}
                >
                  Previous month
                </button>
                <button
                  type="button"
                  className={navButtonClassName}
                  onClick={onNextMonth}
                  disabled={!canGoNext}
                >
                  Next month
                </button>
              </div>
            </div>
            <button
              type="button"
              className={navButtonClassName}
              onClick={() => {
                console.error("[PlanAheadModal] close requested", {
                  reason: "close_button",
                  month: format(month, "yyyy-MM"),
                });
                onClose("close_button");
              }}
              aria-label="Close month calendar"
            >
              Close
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            <BookingFlow
              category={category}
              month={month}
              bookingsByDate={bookingsByDate}
              onRefreshBookings={onRefreshBookings}
              showCalendarHeading={false}
            />
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
