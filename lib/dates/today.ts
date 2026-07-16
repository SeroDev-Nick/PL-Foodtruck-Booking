import { format } from "date-fns";

/** Local calendar date as YYYY-MM-DD (not UTC midnight). */
export function todayIsoLocal(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}
