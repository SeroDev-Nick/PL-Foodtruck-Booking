"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ContactManagerModal } from "@/components/ContactManagerModal";
import {
  BOOKING_CATEGORY_STORAGE_KEY,
  CATEGORIES,
  CATEGORY_LABELS,
  type BookingCategory,
} from "@/lib/categories";

export default function Home() {
  const router = useRouter();
  const [contactOpen, setContactOpen] = useState(false);

  function selectCategory(category: BookingCategory) {
    sessionStorage.setItem(BOOKING_CATEGORY_STORAGE_KEY, category);
    router.push(`/book?category=${category}`);
  }

  return (
    <div className="flex flex-1 flex-col bg-[var(--page-bg)]">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--page-fg)] sm:text-3xl">
            Food Truck Booking
          </h1>
          <p className="text-base leading-relaxed text-[var(--page-muted)]">
            Select your category to view the calendar.
          </p>
        </header>

        <ul className="flex list-none flex-col gap-3 p-0">
          {CATEGORIES.map((category) => (
            <li key={category}>
              <button
                type="button"
                onClick={() => selectCategory(category)}
                className="flex min-h-12 w-full items-center justify-center rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-4 py-3 text-base font-medium text-[var(--page-fg)] transition-colors hover:bg-[var(--control-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              >
                {CATEGORY_LABELS[category]}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-4 border-t border-[var(--control-border)] pt-6 text-center text-sm text-[var(--page-muted)]">
          <p>
            Clubhouse staff?{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--page-fg)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              Manager Login
            </Link>
          </p>

          <div
            aria-hidden="true"
            className="mx-auto h-px w-full max-w-[12rem] bg-[var(--control-border)]"
          />

          <p>
            Need to reach us?{" "}
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="font-medium text-[var(--page-fg)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              Contact the manager
            </button>
          </p>
        </div>
      </main>

      <ContactManagerModal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
      />
    </div>
  );
}
