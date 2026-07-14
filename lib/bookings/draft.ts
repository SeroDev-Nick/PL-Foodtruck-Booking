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

/**
 * Cache parsed draft by raw sessionStorage string so useSyncExternalStore
 * getSnapshot returns a stable reference when storage has not changed.
 */
let cachedRaw: string | null | undefined = undefined;
let cachedDraft: BookingDraft | null = null;

export function createEmptyDayTimes(): BookingDraftDay {
  return {
    startTime: DEFAULT_START_TIME,
    endTime: DEFAULT_END_TIME,
  };
}

function normalizeDraft(parsed: BookingDraft): BookingDraft | null {
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
}

export function readBookingDraft(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);
    if (raw === cachedRaw) {
      return cachedDraft;
    }

    cachedRaw = raw;

    if (!raw) {
      cachedDraft = null;
      return null;
    }

    const normalized = normalizeDraft(JSON.parse(raw) as BookingDraft);
    cachedDraft = normalized;
    return cachedDraft;
  } catch {
    cachedRaw = undefined;
    cachedDraft = null;
    return null;
  }
}

export function writeBookingDraft(draft: BookingDraft): void {
  const normalized = normalizeDraft(draft);
  if (!normalized) {
    return;
  }

  const raw = JSON.stringify(normalized);
  // Same content → keep the cached object reference for useSyncExternalStore.
  if (raw === cachedRaw) {
    return;
  }

  sessionStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedDraft = normalized;
}

export function clearBookingDraft(): void {
  sessionStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
  cachedRaw = null;
  cachedDraft = null;
}
