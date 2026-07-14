import type { BookingCategory } from "@/lib/categories";
import { DEFAULT_END_TIME, DEFAULT_START_TIME } from "@/lib/bookings/schema";

export const BOOKING_DRAFT_STORAGE_KEY = "bookingDraft";

export type BookingDraftDay = {
  startTime: string;
  endTime: string;
};

export type BookingDraft = {
  category: BookingCategory;
  selectedDays: Record<string, BookingDraftDay>;
  notes: string;
  step: "dates" | "identity";
};

export function createEmptyDayTimes(): BookingDraftDay {
  return {
    startTime: DEFAULT_START_TIME,
    endTime: DEFAULT_END_TIME,
  };
}

export function readBookingDraft(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as BookingDraft;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.category ||
      !parsed.selectedDays ||
      typeof parsed.selectedDays !== "object"
    ) {
      return null;
    }
    return {
      category: parsed.category,
      selectedDays: parsed.selectedDays,
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      step: parsed.step === "identity" ? "identity" : "dates",
    };
  } catch {
    return null;
  }
}

export function writeBookingDraft(draft: BookingDraft): void {
  sessionStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function clearBookingDraft(): void {
  sessionStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
}
