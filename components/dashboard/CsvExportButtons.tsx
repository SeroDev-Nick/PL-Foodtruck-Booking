"use client";

import { useState, useTransition } from "react";
import {
  exportBookingsCsv,
  exportTrucksCsv,
  type CsvExportResult,
} from "@/app/dashboard/export-actions";

const buttonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm font-medium text-[var(--page-fg)] hover:bg-[var(--control-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

function downloadCsv(fileName: string, content: string) {
  // Prepend a UTF-8 BOM so Excel reads accented characters correctly.
  const blob = new Blob(["\uFEFF", content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function CsvExportButtons() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runExport(action: () => Promise<CsvExportResult>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        downloadCsv(result.fileName, result.content);
      } catch {
        setError("Could not export. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClassName}
          disabled={pending}
          onClick={() => runExport(exportTrucksCsv)}
        >
          Export trucks (CSV)
        </button>
        <button
          type="button"
          className={buttonClassName}
          disabled={pending}
          onClick={() => runExport(exportBookingsCsv)}
        >
          Export bookings (CSV)
        </button>
      </div>
      {error ? (
        <p
          className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
