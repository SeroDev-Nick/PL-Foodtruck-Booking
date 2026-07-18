import { createAdminClient } from "@/lib/supabase/admin";
import {
  MESSAGE_SUBJECT_LABELS,
  type MessageSubject,
} from "@/lib/messages/subjects";

type NotifyMessageParams = {
  truckId: string;
  businessName: string;
  subject: MessageSubject;
  body: string;
  dashboardUrl: string;
};

function readEmailJsConfig(): {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey: string;
} | null {
  const serviceId = process.env.EMAILJS_SERVICE_ID?.trim();
  const templateId = process.env.EMAILJS_TEMPLATE_ID?.trim();
  const publicKey = process.env.EMAILJS_PUBLIC_KEY?.trim();
  const privateKey = process.env.EMAILJS_PRIVATE_KEY?.trim();

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.error(
      "[notifyPrimaryManagerOfMessage] EmailJS env vars incomplete; skipping notification.",
      {
        hasServiceId: Boolean(serviceId),
        hasTemplateId: Boolean(templateId),
        hasPublicKey: Boolean(publicKey),
        hasPrivateKey: Boolean(privateKey),
      },
    );
    return null;
  }

  return { serviceId, templateId, publicKey, privateKey };
}

/**
 * Best-effort EmailJS notification to the primary manager.
 * Never throws — callers must not fail message submission on email errors.
 */
export async function notifyPrimaryManagerOfMessage(
  params: NotifyMessageParams,
): Promise<void> {
  try {
    const config = readEmailJsConfig();
    if (!config) {
      return;
    }

    const admin = createAdminClient();
    const { data: primary, error: primaryError } = await admin
      .from("managers")
      .select("email")
      .eq("is_primary", true)
      .maybeSingle();

    if (primaryError || !primary?.email) {
      console.error(
        "[notifyPrimaryManagerOfMessage] No primary manager found; skipping notification.",
        { primaryError },
      );
      return;
    }

    const subjectLabel = MESSAGE_SUBJECT_LABELS[params.subject];
    const response = await fetch(
      "https://api.emailjs.com/api/v1.0/email/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: config.serviceId,
          template_id: config.templateId,
          user_id: config.publicKey,
          accessToken: config.privateKey,
          template_params: {
            to_email: primary.email,
            business_name: params.businessName,
            subject: subjectLabel,
            message_body: params.body,
            dashboard_url: params.dashboardUrl,
            // Plain-text summary for templates that use a single body field.
            message: [
              `New message from ${params.businessName}`,
              `Subject: ${subjectLabel}`,
              "",
              params.body,
              "",
              `Open in dashboard: ${params.dashboardUrl}`,
              "",
              "(Any attachment stays in the app — it is not included in this email.)",
            ].join("\n"),
          },
        }),
      },
    );

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.error(
        "[notifyPrimaryManagerOfMessage] EmailJS request failed.",
        {
          status: response.status,
          responseText,
          truckId: params.truckId,
        },
      );
    }
  } catch (error) {
    console.error(
      "[notifyPrimaryManagerOfMessage] Unexpected EmailJS error.",
      error,
    );
  }
}
