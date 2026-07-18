import { CsvExportButtons } from "@/components/dashboard/CsvExportButtons";
import {
  ManagerTruckList,
  type ManagerTruckRow,
} from "@/components/dashboard/ManagerTruckList";
import { requireManagerSession } from "@/lib/auth/require-manager";
import { todayIsoLocal } from "@/lib/dates/today";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCoiUrgency } from "@/lib/trucks/coi-status";
import { redirect } from "next/navigation";

type MessageCountRow = {
  truck_id: string;
  read: boolean;
};

export default async function DashboardPage() {
  const session = await requireManagerSession();
  if (!session.ok) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const [trucksResult, messagesResult] = await Promise.all([
    admin
      .from("trucks")
      .select(
        "id, business_name, contact_email, phone_number, coi_expiration_date, coi_storage_path, manager_approved, created_at",
      )
      .order("business_name", { ascending: true }),
    admin.from("messages").select("truck_id, read"),
  ]);

  const countsByTruck = new Map<
    string,
    { total: number; unread: number }
  >();
  for (const row of (messagesResult.data ?? []) as MessageCountRow[]) {
    const existing = countsByTruck.get(row.truck_id) ?? {
      total: 0,
      unread: 0,
    };
    existing.total += 1;
    if (!row.read) {
      existing.unread += 1;
    }
    countsByTruck.set(row.truck_id, existing);
  }

  const todayIso = todayIsoLocal();
  const trucks: ManagerTruckRow[] = trucksResult.error
    ? []
    : (trucksResult.data ?? []).map((row) => {
        const expiration = row.coi_expiration_date as string;
        const counts = countsByTruck.get(row.id as string) ?? {
          total: 0,
          unread: 0,
        };
        return {
          id: row.id as string,
          businessName: row.business_name as string,
          contactEmail: row.contact_email as string,
          phoneNumber: row.phone_number as string,
          coiExpirationDate: expiration,
          coiUrgency: resolveCoiUrgency(expiration, todayIso),
          managerApproved: Boolean(row.manager_approved),
          hasCoiDocument: Boolean(row.coi_storage_path),
          messageCount: counts.total,
          unreadMessageCount: counts.unread,
        };
      });

  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--page-fg)]">
            Trucks
          </h1>
          <p className="text-base leading-relaxed text-[var(--page-muted)]">
            Review registrations, insurance documents, and booking approval.
          </p>
        </div>
        <CsvExportButtons />
      </header>

      {trucksResult.error ? (
        <p
          className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]"
          role="alert"
        >
          Could not load trucks. Please refresh the page.
        </p>
      ) : null}

      <ManagerTruckList trucks={trucks} />
    </main>
  );
}
