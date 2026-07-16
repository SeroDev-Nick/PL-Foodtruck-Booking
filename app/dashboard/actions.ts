"use server";

import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth/require-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COI_BUCKET,
  COI_SIGNED_URL_SECONDS,
  truckRegistrationFieldsSchema,
  validateCoiFile,
} from "@/lib/trucks/registration";

export type ManagerActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type CoiSignedUrlResult =
  | { ok: true; url: string; expiresInSeconds: number }
  | { ok: false; error: string };

const expirationOnlySchema = truckRegistrationFieldsSchema.pick({
  coiExpirationDate: true,
});

export async function setTruckApproval(
  truckId: string,
  approved: boolean,
): Promise<ManagerActionResult> {
  const session = await requireManagerSession();
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  if (!truckId) {
    return { ok: false, error: "Truck not found." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("trucks")
    .update({ manager_approved: approved })
    .eq("id", truckId);

  if (error) {
    return {
      ok: false,
      error: "Could not update approval. Please try again.",
    };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

async function createCoiSignedUrl(
  truckId: string,
  mode: "preview" | "download",
): Promise<CoiSignedUrlResult> {
  const session = await requireManagerSession();
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  if (!truckId) {
    return { ok: false, error: "Truck not found." };
  }

  const admin = createAdminClient();
  const { data: truck, error: truckError } = await admin
    .from("trucks")
    .select("coi_storage_path, business_name")
    .eq("id", truckId)
    .maybeSingle();

  if (truckError || !truck?.coi_storage_path) {
    return {
      ok: false,
      error: "No COI document is on file for this truck.",
    };
  }

  const path = truck.coi_storage_path as string;
  const fileName = path.split("/").pop() || `${truck.business_name}-coi`;

  const { data, error } = await admin.storage
    .from(COI_BUCKET)
    .createSignedUrl(
      path,
      COI_SIGNED_URL_SECONDS,
      mode === "download" ? { download: fileName } : undefined,
    );

  if (error || !data?.signedUrl) {
    return {
      ok: false,
      error: "Could not open the COI document. Please try again.",
    };
  }

  return {
    ok: true,
    url: data.signedUrl,
    expiresInSeconds: COI_SIGNED_URL_SECONDS,
  };
}

/** Fresh short-lived URL to view the COI in the browser. */
export async function getCoiPreviewUrl(
  truckId: string,
): Promise<CoiSignedUrlResult> {
  return createCoiSignedUrl(truckId, "preview");
}

/** Fresh short-lived URL that prompts a file download. */
export async function getCoiDownloadUrl(
  truckId: string,
): Promise<CoiSignedUrlResult> {
  return createCoiSignedUrl(truckId, "download");
}

export async function reuploadTruckCoi(
  formData: FormData,
): Promise<ManagerActionResult> {
  const session = await requireManagerSession();
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const truckId = String(formData.get("truckId") ?? "").trim();
  if (!truckId) {
    return { ok: false, error: "Truck not found." };
  }

  const parsedExpiration = expirationOnlySchema.safeParse({
    coiExpirationDate: formData.get("coiExpirationDate"),
  });
  if (!parsedExpiration.success) {
    return {
      ok: false,
      error:
        parsedExpiration.error.issues[0]?.message ??
        "Enter a valid expiration date.",
    };
  }

  const file = formData.get("coiFile");
  if (!(file instanceof File)) {
    return { ok: false, error: "Please upload a COI document." };
  }

  const validated = await validateCoiFile(file);
  if (!validated.ok) {
    return validated;
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("trucks")
    .select("coi_storage_path")
    .eq("id", truckId)
    .maybeSingle();

  if (existingError || !existing) {
    return { ok: false, error: "Truck not found." };
  }

  const previousPath = existing.coi_storage_path as string | null;
  const storagePath = `cois/${truckId}/${validated.safeName}`;

  const { error: uploadError } = await admin.storage
    .from(COI_BUCKET)
    .upload(storagePath, validated.bytes, {
      contentType: validated.contentType,
      upsert: true,
    });

  if (uploadError) {
    return {
      ok: false,
      error: "Could not upload COI file. Please try again.",
    };
  }

  const { error: updateError } = await admin
    .from("trucks")
    .update({
      coi_storage_path: storagePath,
      coi_expiration_date: parsedExpiration.data.coiExpirationDate,
    })
    .eq("id", truckId);

  if (updateError) {
    await admin.storage.from(COI_BUCKET).remove([storagePath]);
    return {
      ok: false,
      error: "Could not save the new COI. Please try again.",
    };
  }

  if (previousPath && previousPath !== storagePath) {
    await admin.storage.from(COI_BUCKET).remove([previousPath]);
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
