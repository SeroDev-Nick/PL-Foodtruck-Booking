import type { Metadata } from "next";
import { RegisterTruckForm } from "@/components/RegisterTruckForm";

export const metadata: Metadata = {
  title: "Register your truck",
  description:
    "Submit your food truck profile and certificate of insurance for review.",
};

export default function RegisterPage() {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[var(--page-bg)]">
      <main className="mx-auto flex w-full min-w-0 max-w-md flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--page-fg)] sm:text-3xl">
            Register your truck
          </h1>
          <p className="text-base leading-relaxed text-[var(--page-muted)]">
            Submit your business details and certificate of insurance. A manager
            will review your COI before your truck can be selected for booking.
          </p>
        </header>

        <RegisterTruckForm />
      </main>
    </div>
  );
}
