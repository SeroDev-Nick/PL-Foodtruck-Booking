"use client";

import FocusTrap from "focus-trap-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { submitMessage } from "@/app/messages/actions";
import { MESSAGE_BODY_MAX_LENGTH } from "@/lib/messages/schema";
import {
  MESSAGE_SUBJECTS,
  MESSAGE_SUBJECT_LABELS,
  type MessageSubject,
} from "@/lib/messages/subjects";
import { createClient } from "@/lib/supabase/client";
import { COI_MAX_BYTES } from "@/lib/trucks/registration";

type NamedTruck = {
  id: string;
  business_name: string;
};

const fieldClassName =
  "w-full rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-base text-[var(--page-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

const buttonClassName =
  "flex min-h-11 items-center justify-center rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-4 py-2.5 text-base font-medium text-[var(--page-fg)] transition-colors hover:bg-[var(--control-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

type ContactManagerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Prefill when the booking flow already has a truck selected. */
  initialTruckId?: string;
};

export function ContactManagerModal({
  isOpen,
  onClose,
  initialTruckId = "",
}: ContactManagerModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <ContactManagerModalContent
      onClose={onClose}
      initialTruckId={initialTruckId}
    />
  );
}

function ContactManagerModalContent({
  onClose,
  initialTruckId,
}: {
  onClose: () => void;
  initialTruckId: string;
}) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);

  const [trucks, setTrucks] = useState<NamedTruck[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [truckId, setTruckId] = useState(initialTruckId);
  const [subject, setSubject] = useState<MessageSubject | "">("");
  const [body, setBody] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const { data, error: queryError } = await supabase
        .from("truck_names")
        .select("id, business_name")
        .order("business_name", { ascending: true });

      if (cancelled) {
        return;
      }

      if (queryError) {
        setLoadError("Could not load trucks. Please try again.");
        setTrucks([]);
        return;
      }

      setTrucks((data ?? []) as NamedTruck[]);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const showAttachment = subject === "coi_replacement";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("attachment");

    if (showAttachment && file instanceof File && file.size > COI_MAX_BYTES) {
      setError("COI file must be 10MB or smaller.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await submitMessage({
        truckId: String(formData.get("truckId") ?? ""),
        subject: String(formData.get("subject") ?? ""),
        body: String(formData.get("body") ?? ""),
        companyWebsite: String(formData.get("companyWebsite") ?? ""),
        attachment: file instanceof File ? file : null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      form.reset();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
      />
      <FocusTrap
        focusTrapOptions={{
          initialFocus: () => headingRef.current,
          escapeDeactivates: () => {
            onCloseRef.current();
            return false;
          },
          clickOutsideDeactivates: false,
          allowOutsideClick: true,
          returnFocusOnDeactivate: false,
          delayInitialFocus: true,
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-[var(--control-border)] bg-[var(--page-bg)] shadow-lg sm:rounded-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--control-border)] px-4 py-3 sm:px-5">
            <h2
              id={titleId}
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-semibold tracking-tight text-[var(--page-fg)] outline-none"
            >
              Message the manager
            </h2>
            <button
              type="button"
              className={buttonClassName}
              onClick={onClose}
              aria-label="Close message form"
            >
              Close
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            {success ? (
              <div className="flex flex-col gap-4">
                <p
                  className="rounded-lg border border-[var(--day-recommended-border)] bg-[var(--day-recommended-bg)] px-4 py-3 text-[var(--day-recommended-fg)]"
                  role="status"
                >
                  Your message was sent. The manager will review it and follow
                  up by email if needed.
                </p>
                <button
                  type="button"
                  className={buttonClassName}
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            ) : (
              <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--page-fg)]">
                  Your truck
                  <select
                    className={fieldClassName}
                    name="truckId"
                    required
                    value={truckId}
                    onChange={(event) => setTruckId(event.target.value)}
                    disabled={pending || trucks === null}
                  >
                    <option value="">Select your truck…</option>
                    {(trucks ?? []).map((truck) => (
                      <option key={truck.id} value={truck.id}>
                        {truck.business_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--page-fg)]">
                  Subject
                  <select
                    className={fieldClassName}
                    name="subject"
                    required
                    value={subject}
                    onChange={(event) =>
                      setSubject(event.target.value as MessageSubject | "")
                    }
                    disabled={pending}
                  >
                    <option value="">Select a subject…</option>
                    {MESSAGE_SUBJECTS.map((value) => (
                      <option key={value} value={value}>
                        {MESSAGE_SUBJECT_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>

                {showAttachment ? (
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--page-fg)]">
                    COI document (PDF or image)
                    <input
                      className={fieldClassName}
                      type="file"
                      name="attachment"
                      accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                      required
                      disabled={pending}
                    />
                    <span className="font-normal text-[var(--page-muted)]">
                      Required for COI replacement. This does not automatically
                      update your official COI on file.
                    </span>
                  </label>
                ) : null}

                <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--page-fg)]">
                  Message
                  <textarea
                    className={`${fieldClassName} min-h-32`}
                    name="body"
                    required
                    maxLength={MESSAGE_BODY_MAX_LENGTH}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    disabled={pending}
                  />
                </label>

                <div
                  className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden"
                  aria-hidden="true"
                >
                  <label>
                    Company website
                    <input
                      type="text"
                      name="companyWebsite"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(event) => setHoneypot(event.target.value)}
                    />
                  </label>
                </div>

                {loadError ? (
                  <p
                    className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]"
                    role="alert"
                  >
                    {loadError}
                  </p>
                ) : null}

                {error ? (
                  <p
                    className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className={buttonClassName}
                  disabled={pending || trucks === null || trucks.length === 0}
                >
                  {pending ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
