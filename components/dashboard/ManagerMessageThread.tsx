"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  getMessageAttachmentDownloadUrl,
  getMessageAttachmentPreviewUrl,
} from "@/app/dashboard/trucks/[truckId]/messages/actions";
import {
  MESSAGE_SUBJECT_LABELS,
  type MessageSubject,
} from "@/lib/messages/subjects";

export type ManagerMessageRow = {
  id: string;
  subject: MessageSubject;
  body: string;
  createdAt: string;
  read: boolean;
  hasAttachment: boolean;
};

type ManagerMessageThreadProps = {
  truckId: string;
  businessName: string;
  contactEmail: string;
  messages: ManagerMessageRow[];
};

const buttonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm font-medium text-[var(--page-fg)] hover:bg-[var(--control-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function replyMailtoHref(contactEmail: string, subject: MessageSubject): string {
  const label = MESSAGE_SUBJECT_LABELS[subject];
  const params = new URLSearchParams({
    subject: `Re: ${label}`,
  });
  return `mailto:${contactEmail}?${params.toString()}`;
}

export function ManagerMessageThread({
  truckId,
  businessName,
  contactEmail,
  messages,
}: ManagerMessageThreadProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-[var(--page-muted)]">
          <Link
            href="/dashboard"
            className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            ← Back to trucks
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--page-fg)]">
          Messages for {businessName}
        </h1>
        <p className="text-base leading-relaxed text-[var(--page-muted)]">
          Newest messages appear first. Opening this page marks unread messages
          as read.
        </p>
      </div>

      {messages.length === 0 ? (
        <p className="text-base text-[var(--page-muted)]" role="status">
          No messages from this truck yet.
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-4 p-0">
          {messages.map((message) => (
            <li key={message.id}>
              <MessageCard
                truckId={truckId}
                contactEmail={contactEmail}
                message={message}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MessageCard({
  truckId,
  contactEmail,
  message,
}: {
  truckId: string;
  contactEmail: string;
  message: ManagerMessageRow;
}) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const subjectLabel = MESSAGE_SUBJECT_LABELS[message.subject];

  function runAction(action: () => Promise<void>) {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      try {
        await action();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <article className="rounded-xl border border-[var(--control-border)] bg-[var(--control-bg)] p-4 sm:p-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex flex-col gap-1">
            <h2 className="text-base font-semibold text-[var(--page-fg)]">
              {subjectLabel}
            </h2>
            <p className="text-sm text-[var(--page-muted)]">
              {formatTimestamp(message.createdAt)}
              {!message.read ? (
                <span className="ml-2 inline-flex items-center rounded-full bg-[var(--error-bg)] px-2 py-0.5 text-xs font-medium text-[var(--error-fg)]">
                  Was unread
                </span>
              ) : null}
            </p>
          </div>
          <a
            href={replyMailtoHref(contactEmail, message.subject)}
            className={buttonClassName}
          >
            Reply via email
          </a>
        </div>

        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--page-fg)]">
          {message.body}
        </p>

        {message.hasAttachment ? (
          <div className="flex flex-wrap gap-2 border-t border-[var(--control-border)] pt-3">
            <button
              type="button"
              className={buttonClassName}
              disabled={pending}
              onClick={() =>
                runAction(async () => {
                  const result = await getMessageAttachmentPreviewUrl(
                    truckId,
                    message.id,
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  window.open(result.url, "_blank", "noopener,noreferrer");
                  setStatus(
                    `Attachment preview opened (expires in about ${Math.round(result.expiresInSeconds / 60)} minutes).`,
                  );
                })
              }
            >
              Preview attachment
            </button>
            <button
              type="button"
              className={buttonClassName}
              disabled={pending}
              onClick={() =>
                runAction(async () => {
                  const result = await getMessageAttachmentDownloadUrl(
                    truckId,
                    message.id,
                  );
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
                  setStatus(
                    `Attachment download started (link expires in about ${Math.round(result.expiresInSeconds / 60)} minutes).`,
                  );
                })
              }
            >
              Download attachment
            </button>
          </div>
        ) : null}

        {error ? (
          <p
            className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {status ? (
          <p
            className="rounded-lg border border-[var(--day-recommended-border)] bg-[var(--day-recommended-bg)] px-3 py-2 text-sm text-[var(--day-recommended-fg)]"
            role="status"
          >
            {status}
          </p>
        ) : null}
      </div>
    </article>
  );
}
