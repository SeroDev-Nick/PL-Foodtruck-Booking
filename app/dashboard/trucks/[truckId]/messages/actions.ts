"use server";

import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth/require-manager";
import {
  MESSAGE_ATTACHMENTS_BUCKET,
  MESSAGE_SIGNED_URL_SECONDS,
} from "@/lib/messages/constants";
import { createAdminClient } from "@/lib/supabase/admin";

export type MessageActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type MessageSignedUrlResult =
  | { ok: true; url: string; expiresInSeconds: number }
  | { ok: false; error: string };

/** Mark every unread message for this truck as read. */
export async function markTruckMessagesRead(
  truckId: string,
): Promise<MessageActionResult> {
  const session = await requireManagerSession();
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  if (!truckId) {
    return { ok: false, error: "Truck not found." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("messages")
    .update({ read: true })
    .eq("truck_id", truckId)
    .eq("read", false);

  if (error) {
    return {
      ok: false,
      error: "Could not update message status. Please try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/trucks/${truckId}/messages`);
  return { ok: true };
}

async function createMessageAttachmentSignedUrl(
  truckId: string,
  messageId: string,
  mode: "preview" | "download",
): Promise<MessageSignedUrlResult> {
  const session = await requireManagerSession();
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  if (!truckId || !messageId) {
    return { ok: false, error: "Message not found." };
  }

  const admin = createAdminClient();
  const { data: message, error: messageError } = await admin
    .from("messages")
    .select("id, truck_id, attachment_storage_path")
    .eq("id", messageId)
    .eq("truck_id", truckId)
    .maybeSingle();

  if (messageError || !message?.attachment_storage_path) {
    return {
      ok: false,
      error: "No attachment is on file for this message.",
    };
  }

  const path = message.attachment_storage_path as string;
  const fileName = path.split("/").pop() || "attachment";

  const { data, error } = await admin.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .createSignedUrl(
      path,
      MESSAGE_SIGNED_URL_SECONDS,
      mode === "download" ? { download: fileName } : undefined,
    );

  if (error || !data?.signedUrl) {
    return {
      ok: false,
      error: "Could not open the attachment. Please try again.",
    };
  }

  return {
    ok: true,
    url: data.signedUrl,
    expiresInSeconds: MESSAGE_SIGNED_URL_SECONDS,
  };
}

export async function getMessageAttachmentPreviewUrl(
  truckId: string,
  messageId: string,
): Promise<MessageSignedUrlResult> {
  return createMessageAttachmentSignedUrl(truckId, messageId, "preview");
}

export async function getMessageAttachmentDownloadUrl(
  truckId: string,
  messageId: string,
): Promise<MessageSignedUrlResult> {
  return createMessageAttachmentSignedUrl(truckId, messageId, "download");
}
