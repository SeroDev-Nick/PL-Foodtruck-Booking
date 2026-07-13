"use server";

import { randomUUID } from "crypto";
import { fileTypeFromBuffer } from "file-type";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COI_BUCKET,
  COI_MAX_BYTES,
  mimeFromDetectedFileType,
  sanitizeFileName,
  truckRegistrationFieldsSchema,
} from "@/lib/trucks/registration";

export type RegisterTruckResult =
  | { ok: true }
  | { ok: false; error: string };

export async function registerTruck(
  formData: FormData,
): Promise<RegisterTruckResult> {
  const parsed = truckRegistrationFieldsSchema.safeParse({
    businessName: formData.get("businessName"),
    contactEmail: formData.get("contactEmail"),
    phoneNumber: formData.get("phoneNumber"),
    coiExpirationDate: formData.get("coiExpirationDate"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid form data.";
    return { ok: false, error: first };
  }

  const file = formData.get("coiFile");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please upload a COI document." };
  }

  if (file.size > COI_MAX_BYTES) {
    return {
      ok: false,
      error: "COI file must be 10MB or smaller.",
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(bytes);
  const contentType = mimeFromDetectedFileType(detected?.ext);

  if (!contentType) {
    return {
      ok: false,
      error:
        "COI must be a PDF or image file (JPEG, PNG, or WebP). File content did not match an allowed type.",
    };
  }

  const truckId = randomUUID();
  const safeName = sanitizeFileName(file.name);
  const storagePath = `cois/${truckId}/${safeName}`;

  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from(COI_BUCKET)
    .upload(storagePath, bytes, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    return {
      ok: false,
      error: "Could not upload COI file. Please try again.",
    };
  }

  const { error: insertError } = await admin.from("trucks").insert({
    id: truckId,
    business_name: parsed.data.businessName,
    contact_email: parsed.data.contactEmail,
    phone_number: parsed.data.phoneNumber,
    coi_storage_path: storagePath,
    coi_expiration_date: parsed.data.coiExpirationDate,
    manager_approved: false,
  });

  if (insertError) {
    await admin.storage.from(COI_BUCKET).remove([storagePath]);
    return {
      ok: false,
      error: "Could not save your truck profile. Please try again.",
    };
  }

  return { ok: true };
}
