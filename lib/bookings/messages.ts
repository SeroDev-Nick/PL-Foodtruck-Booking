import { format } from "date-fns";
import type { BookingDayFailure } from "@/lib/bookings/schema";

export function formatBookingDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return format(date, "MMMM d");
}

export function failureMessageForDay(failure: BookingDayFailure): string {
  const label = formatBookingDateLabel(failure.date);

  switch (failure.reason) {
    case "day_full":
      return `${label} just became fully booked by another truck. Your other selected days were booked successfully — please choose a different day for ${label}.`;
    case "coi_expired":
      return `Your COI on file has expired, so ${label} could not be booked. Contact the manager about renewing your COI.`;
    case "awaiting_approval":
      return `Your profile is still awaiting approval, so ${label} could not be booked.`;
    case "truck_ineligible":
      return `Your truck is not currently eligible to book, so ${label} could not be booked.`;
    case "insert_failed":
      return `${label} could not be booked. Please try again.`;
    default:
      return `${label} could not be booked.`;
  }
}
