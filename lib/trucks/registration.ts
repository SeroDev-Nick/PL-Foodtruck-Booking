import { z } from "zod";

export const COI_BUCKET = "truck-cois";
export const COI_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_COI_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedCoiMimeType = (typeof ALLOWED_COI_MIME_TYPES)[number];

const ALLOWED_FILE_TYPE_IDS = new Set(["pdf", "jpg", "png", "webp"]);

const MIME_BY_FILE_TYPE_ID: Record<string, AllowedCoiMimeType> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Requires local@domain.tld with a real TLD (not just "a@b"). */
const EMAIL_WITH_TLD =
  /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

function digitCount(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

export const truckRegistrationFieldsSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, "Business name is required.")
    .max(200, "Business name is too long."),
  contactEmail: z
    .string()
    .trim()
    .max(254, "Email is too long.")
    .email("Enter a valid email address.")
    .refine(
      (value) => EMAIL_WITH_TLD.test(value),
      "Enter a valid email address (include @ and a domain like example.com).",
    ),
  phoneNumber: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .max(30, "Phone number is too long.")
    .refine(
      (value) => digitCount(value) === 10,
      "Enter a 10-digit phone number (dashes, spaces, or parentheses are fine).",
    ),
  coiExpirationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid expiration date.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00`);
      return !Number.isNaN(date.getTime());
    }, "Enter a valid expiration date."),
});

export function mimeFromDetectedFileType(
  fileTypeId: string | undefined,
): AllowedCoiMimeType | null {
  if (!fileTypeId || !ALLOWED_FILE_TYPE_IDS.has(fileTypeId)) {
    return null;
  }
  return MIME_BY_FILE_TYPE_ID[fileTypeId] ?? null;
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "coi";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "coi";
}
