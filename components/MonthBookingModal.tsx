"use client";

import { format } from "date-fns";
import FocusTrap from "focus-trap-react";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
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
  onClose: () => void;
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
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    console.error("[PlanAheadModal] Escape debug: modal mounted", {
      month: format(month, "yyyy-MM"),
      dialogHandlerAttached: true,
      dialogRefPresent: Boolean(dialogRef.current),
      headingRefPresent: Boolean(headingRef.current),
      activeElement: document.activeElement?.tagName ?? null,
      activeElementId: document.activeElement?.id ?? null,
      activeElementClass: document.activeElement?.className ?? null,
    });

    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      console.error("[PlanAheadModal] Escape debug: document keydown (capture)", {
        key: event.key,
        code: event.code,
        targetTag: target?.tagName ?? null,
        targetRole: target?.getAttribute("role") ?? null,
        targetAriaLabel: target?.getAttribute("aria-label") ?? null,
        dialogContainsTarget: dialogRef.current?.contains(target ?? null) ?? false,
        defaultPrevented: event.defaultPrevented,
      });
    }

    document.addEventListener("keydown", onDocumentKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown, true);
      console.error("[PlanAheadModal] Escape debug: modal unmounted", {
        month: format(month, "yyyy-MM"),
      });
    };
  }, [isOpen, month]);

  if (!isOpen) {
    return null;
  }

  function onDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    console.error("[PlanAheadModal] Escape debug: dialog onKeyDown (bubble)", {
      key: event.key,
      code: event.code,
      targetTag: target.tagName,
      targetRole: target.getAttribute("role"),
      currentTargetRole: event.currentTarget.getAttribute("role"),
      defaultPrevented: event.defaultPrevented,
    });

    if (event.key === "Escape") {
      console.error("[PlanAheadModal] Escape debug: Escape matched on dialog — calling onClose");
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <div className="plan-ahead-modal-root fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
      />
      {/*
        Do NOT wire onDeactivate → onClose. focus-trap-react documents that in
        React Strict Mode the trap deactivates on the immediate remount cycle;
        using onDeactivate to update React open-state closes the modal instantly.
        Escape and outside clicks are handled explicitly below instead.
      */}
      <FocusTrap
        focusTrapOptions={{
          initialFocus: () => headingRef.current,
          escapeDeactivates: false,
          clickOutsideDeactivates: false,
          allowOutsideClick: true,
          returnFocusOnDeactivate: false,
          delayInitialFocus: true,
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="plan-ahead-modal relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border border-[var(--control-border)] bg-[var(--page-bg)] shadow-lg sm:rounded-xl"
          onKeyDown={onDialogKeyDown}
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
              onClick={onClose}
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
