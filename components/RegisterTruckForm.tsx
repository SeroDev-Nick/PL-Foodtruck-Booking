"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  registerTruck,
  type RegisterTruckResult,
} from "@/app/register/actions";
import { COI_MAX_BYTES } from "@/lib/trucks/registration";

const SUCCESS_MESSAGE =
  "Profile submitted. Your COI will be reviewed and your profile approved before you're able to book. You'll be able to select your truck from the booking dropdown once approved.";

const fieldClassName =
  "w-full rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2.5 text-base text-[var(--page-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

const labelClassName =
  "flex flex-col gap-1.5 text-sm font-medium text-[var(--page-fg)]";

export function RegisterTruckForm() {
  const [result, setResult] = useState<RegisterTruckResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const file = formData.get("coiFile");
    if (file instanceof File && file.size > COI_MAX_BYTES) {
      setResult({
        ok: false,
        error: "COI file must be 10MB or smaller.",
      });
      return;
    }

    startTransition(async () => {
      const next = await registerTruck(formData);
      setResult(next);
      if (next.ok) {
        form.reset();
      }
    });
  }

  if (result?.ok) {
    return (
      <div
        className="rounded-lg border border-[var(--day-recommended-border)] bg-[var(--day-recommended-bg)] px-4 py-4 text-[var(--day-recommended-fg)]"
        role="status"
      >
        <p className="text-base leading-relaxed">{SUCCESS_MESSAGE}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <label className={labelClassName}>
        Business name
        <input
          className={fieldClassName}
          type="text"
          name="businessName"
          required
          autoComplete="organization"
          maxLength={200}
          disabled={isPending}
        />
      </label>

      <label className={labelClassName}>
        Contact email
        <input
          className={fieldClassName}
          type="email"
          name="contactEmail"
          required
          autoComplete="email"
          maxLength={254}
          disabled={isPending}
        />
      </label>

      <label className={labelClassName}>
        Phone number
        <input
          className={fieldClassName}
          type="tel"
          name="phoneNumber"
          required
          autoComplete="tel"
          maxLength={30}
          disabled={isPending}
        />
      </label>

      <label className={labelClassName}>
        COI document (PDF or image, max 10MB)
        <input
          className="w-full text-sm text-[var(--page-fg)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--control-bg-hover)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--page-fg)]"
          type="file"
          name="coiFile"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
          disabled={isPending}
        />
      </label>

      <label className={labelClassName}>
        COI expiration date
        <input
          className={fieldClassName}
          type="date"
          name="coiExpirationDate"
          required
          disabled={isPending}
        />
      </label>

      {result && !result.ok ? (
        <p
          className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-[var(--error-fg)]"
          role="alert"
        >
          {result.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex min-h-12 w-full items-center justify-center rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-4 py-3 text-base font-medium text-[var(--page-fg)] transition-colors hover:bg-[var(--control-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Submitting…" : "Submit registration"}
      </button>
    </form>
  );
}
