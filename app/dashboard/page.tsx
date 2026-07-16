import {
  ManagerTruckList,
  type ManagerTruckRow,
} from "@/components/dashboard/ManagerTruckList";
import { requireManagerSession } from "@/lib/auth/require-manager";
import { todayIsoLocal } from "@/lib/dates/today";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCoiUrgency } from "@/lib/trucks/coi-status";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await requireManagerSession();
  if (!session.ok) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("trucks")
    .select(
      "id, business_name, contact_email, phone_number, coi_expiration_date, coi_storage_path, manager_approved, created_at",
    )
    .order("business_name", { ascending: true });

  const todayIso = todayIsoLocal();
  const trucks: ManagerTruckRow[] = error
    ? []
    : (data ?? []).map((row) => {
        const expiration = row.coi_expiration_date as string;
        return {
          id: row.id as string,
          businessName: row.business_name as string,
          contactEmail: row.contact_email as string,
          phoneNumber: row.phone_number as string,
          coiExpirationDate: expiration,
          coiUrgency: resolveCoiUrgency(expiration, todayIso),
          managerApproved: Boolean(row.manager_approved),
          hasCoiDocument: Boolean(row.coi_storage_path),
        };
      });

  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--page-fg)]">
          Trucks
        </h1>
        <p className="text-base leading-relaxed text-[var(--page-muted)]">
          Review registrations, insurance documents, and booking approval.
        </p>
      </header>

      {error ? (
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
