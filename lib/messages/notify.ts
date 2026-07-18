import sgMail from "@sendgrid/mail";
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readSendGridConfig(): {
  apiKey: string;
  fromEmail: string;
} | null {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();

  if (!apiKey || !fromEmail) {
    console.error(
      "[notifyPrimaryManagerOfMessage] SendGrid env vars incomplete; skipping notification.",
      {
        hasApiKey: Boolean(apiKey),
        hasFromEmail: Boolean(fromEmail),
      },
    );
    return null;
  }

  return { apiKey, fromEmail };
}

function buildPlainText(params: {
  businessName: string;
  subjectLabel: string;
  body: string;
  dashboardUrl: string;
}): string {
  return [
    `New message from ${params.businessName}`,
    `Subject: ${params.subjectLabel}`,
    "",
    params.body,
    "",
    `Open in dashboard: ${params.dashboardUrl}`,
    "",
    "(Any attachment stays in the app — it is not included in this email.)",
  ].join("\n");
}

function buildHtml(params: {
  businessName: string;
  subjectLabel: string;
  body: string;
  dashboardUrl: string;
}): string {
  const businessName = escapeHtml(params.businessName);
  const subjectLabel = escapeHtml(params.subjectLabel);
  const body = escapeHtml(params.body).replaceAll("\n", "<br />");
  const dashboardUrl = escapeHtml(params.dashboardUrl);

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;padding:24px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:14px;color:#475569;">New truck message</p>
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${businessName}</h1>
                <p style="margin:0 0 8px;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Subject:</strong> ${subjectLabel}</p>
                <div style="margin:16px 0;padding:16px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;font-size:15px;line-height:1.5;">
                  ${body}
                </div>
                <p style="margin:0 0 20px;font-size:13px;color:#64748b;">
                  Any attachment stays in the app — it is not included in this email.
                </p>
                <a href="${dashboardUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:8px;">
                  View in Dashboard
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Best-effort SendGrid notification to the primary manager.
 * Never throws — callers must not fail message submission on email errors.
 */
export async function notifyPrimaryManagerOfMessage(
  params: NotifyMessageParams,
): Promise<void> {
  try {
    const config = readSendGridConfig();
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
    const emailSubject = `New message from ${params.businessName}: ${subjectLabel}`;
    const text = buildPlainText({
      businessName: params.businessName,
      subjectLabel,
      body: params.body,
      dashboardUrl: params.dashboardUrl,
    });
    const html = buildHtml({
      businessName: params.businessName,
      subjectLabel,
      body: params.body,
      dashboardUrl: params.dashboardUrl,
    });

    sgMail.setApiKey(config.apiKey);
    await sgMail.send({
      to: primary.email,
      from: config.fromEmail,
      subject: emailSubject,
      text,
      html,
    });
  } catch (error) {
    console.error(
      "[notifyPrimaryManagerOfMessage] SendGrid notification failed.",
      {
        truckId: params.truckId,
        error,
      },
    );
  }
}
