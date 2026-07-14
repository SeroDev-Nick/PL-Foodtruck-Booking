"use client";

import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { BookingCategory } from "@/lib/categories";
import {
  resolveDayState,
  slotsRemaining,
  type DayBooking,
  type DayState,
} from "@/lib/calendar/day-state";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const DAYS_PER_WEEK = 7;

const STATE_TAG_MOBILE: Record<Exclude<DayState, "open">, string> = {
  recommended: "Rec.",
  same_category: "Same Cat",
  full: "Full",
};

const STATE_TAG_DESKTOP: Record<Exclude<DayState, "open">, string> = {
  recommended: "✓ Recommended",
  same_category: "⚠ Same Category",
  full: "Full",
};

type MonthCalendarProps = {
  month: Date;
  selectedCategory: BookingCategory;
  bookingsByDate: Record<string, DayBooking[]>;
  selectedDates?: ReadonlySet<string>;
  onToggleDate?: (dateKey: string) => void;
};

const STATE_LABEL: Record<DayState, string> = {
  open: "open",
  recommended: "recommended",
  same_category: "same category",
  full: "full",
};

function todayIsoLocal(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function buildAriaLabel(
  day: Date,
  state: DayState,
  bookingCount: number,
  isSelected: boolean,
  isUnavailable: boolean,
  truckNames: string[],
): string {
  const dateLabel = format(day, "MMMM d");
  const remaining = slotsRemaining(bookingCount);
  const truckWord = bookingCount === 1 ? "truck" : "trucks";
  const slotWord = remaining === 1 ? "slot" : "slots";
  const selection = isSelected ? ", selected" : "";
  const names =
    truckNames.length > 0 ? `, booked by ${truckNames.join(" and ")}` : "";

  if (isUnavailable) {
    return `${dateLabel}, unavailable, past or current day, not selectable${names}`;
  }

  if (state === "full") {
    return `${dateLabel}, ${STATE_LABEL[state]}, ${bookingCount} trucks booked${names}${selection}`;
  }

  return `${dateLabel}, ${STATE_LABEL[state]}, ${bookingCount} ${truckWord} booked, ${remaining} ${slotWord} remaining${names}${selection}`;
}

export function MonthCalendar({
  month,
  selectedCategory,
  bookingsByDate,
  selectedDates,
  onToggleDate,
}: MonthCalendarProps) {
  const gridId = useId();
  const selectionEnabled = typeof onToggleDate === "function";
  const days = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const leadingCount = getDay(monthStart);
    const trailingCount =
      (DAYS_PER_WEEK - ((leadingCount + monthDays.length) % DAYS_PER_WEEK)) %
      DAYS_PER_WEEK;

    const cells: Array<Date | null> = [
      ...Array.from({ length: leadingCount }, () => null),
      ...monthDays,
      ...Array.from({ length: trailingCount }, () => null),
    ];

    const weeks: Array<Array<Date | null>> = [];
    for (let i = 0; i < cells.length; i += DAYS_PER_WEEK) {
      weeks.push(cells.slice(i, i + DAYS_PER_WEEK));
    }
    return { monthDays, weeks };
  }, [month]);

  const focusableDays = days.monthDays;
  const firstDayKey = format(
    focusableDays[0] ?? startOfMonth(month),
    "yyyy-MM-dd",
  );
  const [focusedDateKey, setFocusedDateKey] = useState(firstDayKey);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const focusDay = useCallback((dateKey: string) => {
    setFocusedDateKey(dateKey);
    requestAnimationFrame(() => {
      cellRefs.current.get(dateKey)?.focus();
    });
  }, []);

  const moveFocus = useCallback(
    (current: Date, deltaDays: number) => {
      const next = addDays(current, deltaDays);
      if (!isSameMonth(next, month)) {
        return;
      }
      focusDay(format(next, "yyyy-MM-dd"));
    },
    [focusDay, month],
  );

  const todayKey = todayIsoLocal();

  const onKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLButtonElement>,
      day: Date,
      isNotSelectable: boolean,
    ) => {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          moveFocus(day, -1);
          break;
        case "ArrowRight":
          event.preventDefault();
          moveFocus(day, 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveFocus(day, -DAYS_PER_WEEK);
          break;
        case "ArrowDown":
          event.preventDefault();
          moveFocus(day, DAYS_PER_WEEK);
          break;
        case "Home": {
          event.preventDefault();
          const weekStart = startOfWeek(day);
          const target = isSameMonth(weekStart, month)
            ? weekStart
            : startOfMonth(month);
          focusDay(format(target, "yyyy-MM-dd"));
          break;
        }
        case "End": {
          event.preventDefault();
          const weekEnd = addDays(startOfWeek(day), 6);
          const target = isSameMonth(weekEnd, month)
            ? weekEnd
            : endOfMonth(month);
          focusDay(format(target, "yyyy-MM-dd"));
          break;
        }
        case " ":
        case "Enter": {
          if (!selectionEnabled || isNotSelectable) {
            break;
          }
          event.preventDefault();
          onToggleDate?.(format(day, "yyyy-MM-dd"));
          break;
        }
        default:
          break;
      }
    },
    [focusDay, moveFocus, month, onToggleDate, selectionEnabled],
  );

  return (
    <div className="w-full min-w-0 max-w-full">
      <div
        className="mb-2 grid grid-cols-7 gap-0.5 text-center text-xs font-medium tracking-wide text-[var(--page-muted)] sm:gap-1 sm:text-sm"
        aria-hidden="true"
      >
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="min-w-0 py-1">
            {label}
          </div>
        ))}
      </div>

      <div
        role="grid"
        id={gridId}
        aria-label={`${format(month, "MMMM yyyy")} availability`}
        className="flex min-w-0 flex-col gap-0.5 sm:gap-1"
      >
        {days.weeks.map((week, weekIndex) => (
          <div
            key={weekIndex}
            role="row"
            className="grid min-w-0 grid-cols-7 gap-0.5 sm:gap-1"
          >
            {week.map((day, dayIndex) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${weekIndex}-${dayIndex}`}
                    role="gridcell"
                    className="min-h-14 min-w-0 rounded-md sm:min-h-16"
                    aria-hidden="true"
                  />
                );
              }

              const dateKey = format(day, "yyyy-MM-dd");
              const dayBookings = bookingsByDate[dateKey] ?? [];
              const state = resolveDayState(dayBookings, selectedCategory);
              const isFull = state === "full";
              const isUnavailable = dateKey <= todayKey;
              const isNotSelectable = isFull || isUnavailable;
              const isSelected = selectedDates?.has(dateKey) ?? false;
              const isFocused = focusedDateKey === dateKey;
              const truckNames = dayBookings
                .map((booking) => booking.businessName)
                .filter((name): name is string => Boolean(name));
              const ariaLabel = buildAriaLabel(
                day,
                state,
                dayBookings.length,
                isSelected,
                isUnavailable,
                truckNames,
              );
              const cellStateClass = isUnavailable
                ? "day-cell--unavailable"
                : `day-cell--${state}`;

              return (
                <div key={dateKey} role="gridcell" className="min-w-0">
                  <button
                    type="button"
                    ref={(node) => {
                      if (node) {
                        cellRefs.current.set(dateKey, node);
                      } else {
                        cellRefs.current.delete(dateKey);
                      }
                    }}
                    tabIndex={isFocused ? 0 : -1}
                    aria-label={ariaLabel}
                    aria-disabled={isNotSelectable || undefined}
                    aria-pressed={selectionEnabled ? isSelected : undefined}
                    onFocus={() => setFocusedDateKey(dateKey)}
                    onKeyDown={(event) =>
                      onKeyDown(event, day, isNotSelectable)
                    }
                    onClick={() => {
                      if (!selectionEnabled || isNotSelectable) {
                        return;
                      }
                      onToggleDate?.(dateKey);
                    }}
                    className={`day-cell ${cellStateClass} flex min-h-14 min-w-0 w-full flex-col items-stretch gap-0.5 overflow-hidden rounded-md border px-0.5 py-1 text-left sm:min-h-16 sm:px-1.5 sm:py-2 ${isNotSelectable ? "cursor-not-allowed" : selectionEnabled ? "cursor-pointer" : ""} ${isSelected ? "day-cell--selected" : ""}`}
                  >
                    <span className="text-sm font-semibold leading-none sm:text-base">
                      {format(day, "d")}
                    </span>
                    {isUnavailable ? (
                      <span className="day-cell__tag break-words text-[0.6rem] leading-tight font-medium sm:text-xs">
                        Unavailable
                      </span>
                    ) : state !== "open" ? (
                      <span className="day-cell__tag break-words text-[0.6rem] leading-tight font-medium sm:text-xs">
                        <span className="sm:hidden">{STATE_TAG_MOBILE[state]}</span>
                        <span className="hidden sm:inline">
                          {STATE_TAG_DESKTOP[state]}
                        </span>
                      </span>
                    ) : null}
                    {dayBookings.some((booking) => booking.businessName) ? (
                      <span className="hidden flex-col gap-0.5 sm:flex">
                        {dayBookings.map((booking) =>
                          booking.businessName ? (
                            <span
                              key={booking.id}
                              className="truncate text-[0.55rem] leading-tight opacity-90"
                            >
                              {booking.businessName}
                            </span>
                          ) : null,
                        )}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
