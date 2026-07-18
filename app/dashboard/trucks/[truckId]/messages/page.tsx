import { notFound, redirect } from "next/navigation";
import { markTruckMessagesRead } from "@/app/dashboard/trucks/[truckId]/messages/actions";
import {
  ManagerMessageThread,
  type ManagerMessageRow,
} from "@/components/dashboard/ManagerMessageThread";
import { requireManagerSession } from "@/lib/auth/require-manager";
import { isMessageSubject } from "@/lib/messages/subjects";
import { createAdminClient } from "@/lib/supabase/admin";

type TruckMessagesPageProps = {
  params: Promise<{ truckId: string }>;
};

export default async function TruckMessagesPage({
  params,
}: TruckMessagesPageProps) {
  const session = await requireManagerSession();
  if (!session.ok) {
    redirect("/login");
  }

  const { truckId } = await params;
  const admin = createAdminClient();

  const { data: truck, error: truckError } = await admin
    .from("trucks")
    .select("id, business_name, contact_email")
    .eq("id", truckId)
    .maybeSingle();

  if (truckError || !truck) {
    notFound();
  }

  const { data: messageRows, error: messagesError } = await admin
    .from("messages")
    .select(
      "id, subject, body, created_at, read, attachment_storage_path",
    )
    .eq("truck_id", truckId)
    .order("created_at", { ascending: false });

  // Mark unread as read after loading so the UI can still show which were unread.
  await markTruckMessagesRead(truckId);

  const messages: ManagerMessageRow[] = (messageRows ?? [])
    .filter((row) => isMessageSubject(String(row.subject)))
    .map((row) => ({
      id: row.id as string,
      subject: row.subject as ManagerMessageRow["subject"],
      body: String(row.body ?? ""),
      createdAt: String(row.created_at),
      read: Boolean(row.read),
      hasAttachment: Boolean(row.attachment_storage_path),
    }));

  return (
    <main>
      {messagesError ? (
        <p
          className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]"
          role="alert"
        >
          Could not load messages. Please refresh the page.
        </p>
      ) : null}
      <ManagerMessageThread
        truckId={truck.id as string}
        businessName={truck.business_name as string}
        contactEmail={truck.contact_email as string}
        messages={messages}
      />
    </main>
  );
}
