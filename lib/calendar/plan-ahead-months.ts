import {
  addMonths,
  eachMonthOfInterval,
  endOfMonth,
  endOfYear,
  getMonth,
  getYear,
  startOfMonth,
  startOfYear,
} from "date-fns";

export type PlanAheadYearMode = "currentRemaining" | "nextFull";

/**
 * Months for Plan Ahead current-year view: NEXT month through December
 * of the reference year (excludes the current month shown on the main tab).
 *
 * Example (reference = July 2026): Aug, Sep, Oct, Nov, Dec 2026.
 */
export function getCurrentYearRemainingMonths(referenceDate: Date): Date[] {
  const nextMonth = startOfMonth(addMonths(referenceDate, 1));
  const december = endOfYear(referenceDate);

  if (nextMonth > december) {
    return [];
  }

  return eachMonthOfInterval({
    start: nextMonth,
    end: startOfMonth(december),
  });
}

/**
 * Months for Plan Ahead next-year view: full January–December of (year + 1).
 *
 * Example (reference = July 2026): Jan–Dec 2027.
 */
export function getNextYearMonths(referenceDate: Date): Date[] {
  const nextYearStart = startOfYear(
    new Date(getYear(referenceDate) + 1, 0, 1),
  );
  const nextYearEnd = endOfYear(nextYearStart);

  return eachMonthOfInterval({
    start: nextYearStart,
    end: startOfMonth(nextYearEnd),
  });
}

export function getPlanAheadMonths(
  yearMode: PlanAheadYearMode,
  referenceDate: Date = new Date(),
): Date[] {
  return yearMode === "currentRemaining"
    ? getCurrentYearRemainingMonths(referenceDate)
    : getNextYearMonths(referenceDate);
}

export function getPlanAheadRangeBounds(months: Date[]): {
  rangeStart: Date;
  rangeEnd: Date;
} | null {
  if (months.length === 0) {
    return null;
  }
  return {
    rangeStart: startOfMonth(months[0]!),
    rangeEnd: endOfMonth(months[months.length - 1]!),
  };
}

export function shiftMonthWithinWindow(
  current: Date,
  delta: -1 | 1,
  windowMonths: Date[],
): Date | null {
  if (windowMonths.length === 0) {
    return null;
  }

  const key = (d: Date) => `${getYear(d)}-${getMonth(d)}`;
  const index = windowMonths.findIndex((m) => key(m) === key(current));
  if (index < 0) {
    return null;
  }

  const next = windowMonths[index + delta];
  return next ?? null;
}
