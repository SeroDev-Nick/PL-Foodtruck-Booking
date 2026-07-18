"use server";

import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { MESSAGE_ATTACHMENTS_BUCKET } from "@/lib/messages/constants";
import { notifyPrimaryManagerOfMessage } from "@/lib/messages/notify";
import { isMessageSubmitRateLimited } from "@/lib/messages/rate-limit";
import { messageSubmissionSchema } from "@/lib/messages/schema";
import { validateCoiFile } from "@/lib/trucks/registration";

export type SubmitMessageResult =
  | { ok: true }
  | { ok: false; error: string };

type SubmitMessageInput = {
  truckId: string;
  subject: string;
  body: string;
  /** Honeypot — must be empty. */
  companyWebsite: string;
  attachment?: File | null;
};

async function resolveClientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headerStore.get("x-real-ip")?.trim() || "unknown";
}

async function resolveAppBaseUrl(): Promise<string> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headerStore.get("host")?.trim();
  if (!host) {
    return "";
  }
  const proto =
    headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  return `${proto}://${host}`;
}

export async function submitMessage(
  input: SubmitMessageInput,
): Promise<SubmitMessageResult> {
  // Silent rejection for bot honeypot — same generic response as rate limit.
  if (input.companyWebsite.trim() !== "") {
    return { ok: false, error: "Unable to send message. Please try again." };
  }

  const ip = await resolveClientIp();
  if (isMessageSubmitRateLimited(ip)) {
    return {
      ok: false,
      error: "Too many messages. Please wait a minute and try again.",
    };
  }

  const parsed = messageSubmissionSchema.safeParse({
    truckId: input.truckId,
    subject: input.subject,
    body: input.body,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid message.";
    return { ok: false, error: first };
  }

  const { truckId, subject, body } = parsed.data;
  const needsAttachment = subject === "coi_replacement";
  const attachment = input.attachment ?? null;

  if (needsAttachment) {
    if (!(attachment instanceof File) || attachment.size === 0) {
      return {
        ok: false,
        error: "Please upload a COI document for a COI replacement request.",
      };
    }
  } else if (attachment instanceof File && attachment.size > 0) {
    return {
      ok: false,
      error: "Only COI replacement messages can include an attachment.",
    };
  }

  let validatedAttachment: Awaited<ReturnType<typeof validateCoiFile>> | null =
    null;
  if (needsAttachment && attachment instanceof File) {
    validatedAttachment = await validateCoiFile(attachment);
    if (!validatedAttachment.ok) {
      return validatedAttachment;
    }
  }

  const admin = createAdminClient();

  const { data: truck, error: truckError } = await admin
    .from("truck_names")
    .select("id, business_name")
    .eq("id", truckId)
    .maybeSingle();

  if (truckError || !truck) {
    return { ok: false, error: "Select a valid truck." };
  }

  const messageId = randomUUID();
  let attachmentPath: string | null = null;

  if (validatedAttachment && validatedAttachment.ok) {
    attachmentPath = `messages/${truckId}/${messageId}/${validatedAttachment.safeName}`;
    const { error: uploadError } = await admin.storage
      .from(MESSAGE_ATTACHMENTS_BUCKET)
      .upload(attachmentPath, validatedAttachment.bytes, {
        contentType: validatedAttachment.contentType,
        upsert: false,
      });

    if (uploadError) {
      return {
        ok: false,
        error: "Could not upload the attachment. Please try again.",
      };
    }
  }

  const { error: insertError } = await admin.from("messages").insert({
    id: messageId,
    truck_id: truckId,
    subject,
    body,
    attachment_storage_path: attachmentPath,
    read: false,
  });

  if (insertError) {
    if (attachmentPath) {
      await admin.storage
        .from(MESSAGE_ATTACHMENTS_BUCKET)
        .remove([attachmentPath]);
    }
    return {
      ok: false,
      error: "Could not send your message. Please try again.",
    };
  }

  // Best-effort only — never fail the saved message if EmailJS is down.
  const baseUrl = await resolveAppBaseUrl();
  await notifyPrimaryManagerOfMessage({
    truckId,
    businessName: String(truck.business_name ?? "Unknown truck"),
    subject,
    body,
    dashboardUrl: baseUrl
      ? `${baseUrl}/dashboard/trucks/${truckId}/messages`
      : `/dashboard/trucks/${truckId}/messages`,
  });

  return { ok: true };
}
