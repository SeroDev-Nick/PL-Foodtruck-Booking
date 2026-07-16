"use server";

import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COI_BUCKET,
  truckRegistrationFieldsSchema,
  validateCoiFile,
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
  if (!(file instanceof File)) {
    return { ok: false, error: "Please upload a COI document." };
  }

  const validated = await validateCoiFile(file);
  if (!validated.ok) {
    return validated;
  }

  const truckId = randomUUID();
  const storagePath = `cois/${truckId}/${validated.safeName}`;

  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from(COI_BUCKET)
    .upload(storagePath, validated.bytes, {
      contentType: validated.contentType,
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
