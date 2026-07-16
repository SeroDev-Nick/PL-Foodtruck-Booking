"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import {
  getCoiDownloadUrl,
  getCoiPreviewUrl,
  reuploadTruckCoi,
  setTruckApproval,
} from "@/app/dashboard/actions";
import { COI_MAX_BYTES } from "@/lib/trucks/registration";
import {
  coiUrgencyLabel,
  type CoiUrgency,
} from "@/lib/trucks/coi-status";

export type ManagerTruckRow = {
  id: string;
  businessName: string;
  contactEmail: string;
  phoneNumber: string;
  coiExpirationDate: string;
  coiUrgency: CoiUrgency;
  managerApproved: boolean;
  hasCoiDocument: boolean;
};

const buttonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm font-medium text-[var(--page-fg)] hover:bg-[var(--control-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

const fieldClassName =
  "min-h-10 w-full rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm text-[var(--page-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

type ManagerTruckListProps = {
  trucks: ManagerTruckRow[];
};

export function ManagerTruckList({ trucks }: ManagerTruckListProps) {
  const [query, setQuery] = useState("");

  if (trucks.length === 0) {
    return (
      <p className="text-base text-[var(--page-muted)]" role="status">
        No trucks have registered yet.
      </p>
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredTrucks =
    normalizedQuery.length === 0
      ? trucks
      : trucks.filter((truck) =>
          truck.businessName.toLowerCase().includes(normalizedQuery),
        );

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--page-fg)]">
        Search by business name
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a name to filter…"
          className={fieldClassName}
          autoComplete="off"
        />
      </label>

      {filteredTrucks.length === 0 ? (
        <p className="text-base text-[var(--page-muted)]" role="status">
          No trucks match “{query.trim()}”.
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-4 p-0">
          {filteredTrucks.map((truck) => (
            <li key={truck.id}>
              <ManagerTruckCard truck={truck} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ManagerTruckCard({ truck }: { truck: ManagerTruckRow }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReupload, setShowReupload] = useState(false);
  const [pending, startTransition] = useTransition();

  function clearFeedback() {
    setMessage(null);
    setError(null);
  }

  function runAction(action: () => Promise<void>) {
    clearFeedback();
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  const urgencyLabel = coiUrgencyLabel(truck.coiUrgency);
  const expirationClass =
    truck.coiUrgency === "expired"
      ? "border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-fg)]"
      : truck.coiUrgency === "expiring_soon"
        ? "border-[var(--day-same-border)] bg-[var(--day-same-bg)] text-[var(--day-same-fg)]"
        : "border-[var(--control-border)] bg-[var(--control-bg)] text-[var(--page-fg)]";

  return (
    <article className="rounded-xl border border-[var(--control-border)] bg-[var(--control-bg)] p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-[var(--page-fg)]">
              {truck.businessName}
            </h2>
            <p className="text-sm text-[var(--page-muted)]">
              {truck.managerApproved
                ? "Approved to book"
                : "Waiting for approval"}
            </p>
          </div>
          <Link
            href={`/dashboard/trucks/${truck.id}`}
            className={`${buttonClassName} shrink-0`}
          >
            View bookings
          </Link>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-[var(--page-muted)]">Email</dt>
            <dd className="text-[var(--page-fg)]">
              <a
                className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                href={`mailto:${truck.contactEmail}`}
              >
                {truck.contactEmail}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--page-muted)]">Phone</dt>
            <dd className="text-[var(--page-fg)]">{truck.phoneNumber}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-[var(--page-muted)]">
              COI expiration
            </dt>
            <dd>
              <span
                className={`mt-1 inline-flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${expirationClass}`}
              >
                <span className="font-medium">{truck.coiExpirationDate}</span>
                {urgencyLabel ? (
                  <span className="text-sm">({urgencyLabel})</span>
                ) : null}
              </span>
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3 border-t border-[var(--control-border)] pt-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClassName}
              disabled={pending || !truck.hasCoiDocument}
              onClick={() =>
                runAction(async () => {
                  const result = await getCoiPreviewUrl(truck.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  window.open(result.url, "_blank", "noopener,noreferrer");
                  setMessage(
                    `COI preview link opened (expires in about ${Math.round(result.expiresInSeconds / 60)} minutes).`,
                  );
                })
              }
            >
              Preview COI
            </button>

            <button
              type="button"
              className={buttonClassName}
              disabled={pending || !truck.hasCoiDocument}
              onClick={() =>
                runAction(async () => {
                  const result = await getCoiDownloadUrl(truck.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  const link = document.createElement("a");
                  link.href = result.url;
                  link.rel = "noopener noreferrer";
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  setMessage(
                    `COI download started (link expires in about ${Math.round(result.expiresInSeconds / 60)} minutes).`,
                  );
                })
              }
            >
              Download COI
            </button>

            <button
              type="button"
              className={buttonClassName}
              disabled={pending}
              aria-expanded={showReupload}
              onClick={() => {
                clearFeedback();
                setShowReupload((open) => !open);
              }}
            >
              {showReupload ? "Cancel re-upload" : "Replace COI"}
            </button>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {truck.managerApproved ? (
              <button
                type="button"
                className={buttonClassName}
                disabled={pending}
                onClick={() =>
                  runAction(async () => {
                    const result = await setTruckApproval(truck.id, false);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setMessage(
                      "Approval removed. This truck can no longer book.",
                    );
                  })
                }
              >
                Remove approval
              </button>
            ) : (
              <button
                type="button"
                className={buttonClassName}
                disabled={pending}
                onClick={() =>
                  runAction(async () => {
                    const result = await setTruckApproval(truck.id, true);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setMessage(
                      "Truck approved. It can book when its COI is valid.",
                    );
                  })
                }
              >
                Approve
              </button>
            )}
          </div>
        </div>
        {showReupload ? (
          <form
            className="flex flex-col gap-3 border-t border-[var(--control-border)] pt-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              const file = formData.get("coiFile");
              if (file instanceof File && file.size > COI_MAX_BYTES) {
                setError("COI file must be 10MB or smaller.");
                return;
              }
              runAction(async () => {
                const result = await reuploadTruckCoi(formData);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setMessage("COI replaced successfully.");
                setShowReupload(false);
                form.reset();
              });
            }}
          >
            <input type="hidden" name="truckId" value={truck.id} />
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--page-fg)]">
              New COI file (PDF or image)
              <input
                className={fieldClassName}
                type="file"
                name="coiFile"
                accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                required
                disabled={pending}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--page-fg)]">
              New expiration date
              <input
                className={fieldClassName}
                type="date"
                name="coiExpirationDate"
                required
                defaultValue={truck.coiExpirationDate}
                disabled={pending}
              />
            </label>
            <button type="submit" className={buttonClassName} disabled={pending}>
              {pending ? "Uploading…" : "Save new COI"}
            </button>
          </form>
        ) : null}

        {error ? (
          <p
            className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {message ? (
          <p
            className="rounded-lg border border-[var(--day-recommended-border)] bg-[var(--day-recommended-bg)] px-3 py-2 text-sm text-[var(--day-recommended-fg)]"
            role="status"
          >
            {message}
          </p>
        ) : null}
      </div>
    </article>
  );
}
