"use client";

import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
} from "date-fns";
import { useMemo, useRef } from "react";
import type { BookingCategory } from "@/lib/categories";
import {
  resolveDayState,
  type DayBooking,
  type DayState,
} from "@/lib/calendar/day-state";

const DAYS_PER_WEEK = 7;

type PlanAheadGridProps = {
  months: Date[];
  selectedCategory: BookingCategory;
  bookingsByDate: Record<string, DayBooking[]>;
  onOpenMonth: (month: Date, opener: HTMLButtonElement) => void;
};

const DOT_CLASS: Record<Exclude<DayState, "open">, string> = {
  recommended: "plan-ahead-dot plan-ahead-dot--recommended",
  same_category: "plan-ahead-dot plan-ahead-dot--same_category",
  full: "plan-ahead-dot plan-ahead-dot--full",
};

function buildMonthCells(month: Date): Array<Date | null> {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingCount = getDay(monthStart);
  const trailingCount =
    (DAYS_PER_WEEK - ((leadingCount + monthDays.length) % DAYS_PER_WEEK)) %
    DAYS_PER_WEEK;

  return [
    ...Array.from({ length: leadingCount }, () => null),
    ...monthDays,
    ...Array.from({ length: trailingCount }, () => null),
  ];
}

export function PlanAheadGrid({
  months,
  selectedCategory,
  bookingsByDate,
  onOpenMonth,
}: PlanAheadGridProps) {
  const tileRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const monthModels = useMemo(
    () =>
      months.map((month) => ({
        month,
        key: format(month, "yyyy-MM"),
        label: format(month, "MMM yyyy"),
        cells: buildMonthCells(month),
      })),
    [months],
  );

  if (months.length === 0) {
    return (
      <p className="text-[var(--page-muted)]">
        No remaining months this year. Switch to next year to plan ahead.
      </p>
    );
  }

  return (
    <ul className="plan-ahead-grid m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
      {monthModels.map(({ month, key, label, cells }) => (
        <li key={key} className="min-w-0">
          <button
            type="button"
            ref={(node) => {
              if (node) {
                tileRefs.current.set(key, node);
              } else {
                tileRefs.current.delete(key);
              }
            }}
            className="plan-ahead-tile flex w-full min-w-0 flex-col gap-2 rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            aria-label={`Open ${format(month, "MMMM yyyy")} booking calendar`}
            onClick={(event) => onOpenMonth(month, event.currentTarget)}
          >
            <span className="text-sm font-semibold text-[var(--page-fg)]">
              {label}
            </span>
            <span
              className="grid grid-cols-7 gap-0.5"
              aria-hidden="true"
            >
              {cells.map((day, index) => {
                if (!day) {
                  return (
                    <span
                      key={`empty-${key}-${index}`}
                      className="plan-ahead-cell"
                    />
                  );
                }

                const dateKey = format(day, "yyyy-MM-dd");
                const dayBookings = bookingsByDate[dateKey] ?? [];
                const state = resolveDayState(dayBookings, selectedCategory);
                const showDot = state !== "open" && dayBookings.length > 0;

                return (
                  <span key={dateKey} className="plan-ahead-cell">
                    {showDot ? (
                      <span
                        className={DOT_CLASS[state]}
                        title={state.replace("_", " ")}
                      />
                    ) : null}
                  </span>
                );
              })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
