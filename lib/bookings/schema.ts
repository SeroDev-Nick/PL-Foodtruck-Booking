import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";

export const DEFAULT_START_TIME = "15:00";
export const DEFAULT_END_TIME = "20:00";
export const MAX_DAYS_PER_SUBMISSION = 50;

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const dayTimeSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
    startTime: z.string().regex(timeRegex, "Invalid start time."),
    endTime: z.string().regex(timeRegex, "Invalid end time."),
  })
  .refine((day) => day.endTime > day.startTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export const bookingSubmissionSchema = z.object({
  category: z.enum(CATEGORIES),
  truckId: z.string().uuid("Select your truck."),
  notes: z.string().trim().max(2000, "Notes are too long.").optional(),
  days: z
    .array(dayTimeSchema)
    .min(1, "Select at least one day.")
    .max(MAX_DAYS_PER_SUBMISSION),
});

export type BookingSubmission = z.infer<typeof bookingSubmissionSchema>;

export type BookingDayFailureReason =
  | "day_full"
  | "already_booked_same_truck"
  | "coi_expired"
  | "awaiting_approval"
  | "truck_ineligible"
  | "insert_failed";

export type BookingDayFailure = {
  date: string;
  reason: BookingDayFailureReason;
};

export type SubmitBookingsResult =
  | {
      ok: true;
      succeededDates: string[];
      failures: BookingDayFailure[];
    }
  | { ok: false; error: string };
