"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  cancelTruckBookings,
  markBookingNoShow,
} from "@/app/dashboard/trucks/[truckId]/actions";
import { CATEGORY_LABELS, type BookingCategory } from "@/lib/categories";

export type ManagerBookingRow = {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  category: BookingCategory;
  notes: string | null;
  noShow: boolean;
  /** True when booking_date >= today — Cancel action only. */
  isCancelable: boolean;
};

type ManagerBookingHistoryProps = {
  truckId: string;
  businessName: string;
  bookings: ManagerBookingRow[];
  showingFullHistory: boolean;
};

const buttonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-sm font-medium text-[var(--page-fg)] hover:bg-[var(--control-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

function formatTime(value: string): string {
  // Supabase time may be "15:00:00" — show HH:MM.
  return value.slice(0, 5);
}

export function ManagerBookingHistory({
  truckId,
  businessName,
  bookings,
  showingFullHistory,
}: ManagerBookingHistoryProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCancelIds, setPendingCancelIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cancelableIds = bookings
    .filter((booking) => booking.isCancelable)
    .map((booking) => booking.id);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllCancelable() {
    setSelectedIds((prev) => {
      if (
        cancelableIds.length > 0 &&
        cancelableIds.every((id) => prev.has(id))
      ) {
        return new Set();
      }
      return new Set(cancelableIds);
    });
  }

  function openConfirm(ids: string[]) {
    setError(null);
    setMessage(null);
    setPendingCancelIds(ids);
    setConfirmOpen(true);
  }

  function runCancel() {
    const ids = pendingCancelIds;
    startTransition(async () => {
      const result = await cancelTruckBookings(truckId, ids);
      if (!result.ok) {
        setError(result.error);
        setConfirmOpen(false);
        return;
      }
      setSelectedIds(new Set());
      setConfirmOpen(false);
      setPendingCancelIds([]);
      setMessage(
        ids.length === 1
          ? "Booking canceled."
          : `${ids.length} bookings canceled.`,
      );
      router.refresh();
    });
  }

  function runNoShow(bookingId: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await markBookingNoShow(truckId, bookingId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Marked as no-show.");
      router.refresh();
    });
  }

  const selectedCancelableCount = [...selectedIds].filter((id) =>
    cancelableIds.includes(id),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
            Bookings for {businessName}
          </h1>
          <p className="text-base leading-relaxed text-[var(--page-muted)]">
            {showingFullHistory
              ? "Showing all bookings for this truck."
              : "Showing the past 30 days plus all upcoming bookings."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showingFullHistory ? (
            <Link href={`/dashboard/trucks/${truckId}`} className={buttonClassName}>
              Show recent + upcoming
            </Link>
          ) : (
            <Link
              href={`/dashboard/trucks/${truckId}?fullHistory=1`}
              className={buttonClassName}
            >
              Full booking history
            </Link>
          )}
          {selectedCancelableCount > 0 ? (
            <button
              type="button"
              className={buttonClassName}
              disabled={pending}
              onClick={() =>
                openConfirm(
                  [...selectedIds].filter((id) => cancelableIds.includes(id)),
                )
              }
            >
              Cancel selected ({selectedCancelableCount})
            </button>
          ) : null}
        </div>
      </div>

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

      {confirmOpen ? (
        <div
          className="rounded-xl border border-[var(--control-border)] bg-[var(--control-bg)] p-4"
          role="alertdialog"
          aria-labelledby="cancel-confirm-title"
          aria-describedby="cancel-confirm-desc"
        >
          <h2
            id="cancel-confirm-title"
            className="text-lg font-semibold text-[var(--page-fg)]"
          >
            Cancel{" "}
            {pendingCancelIds.length === 1
              ? "this booking"
              : `these ${pendingCancelIds.length} bookings`}
            ?
          </h2>
          <p
            id="cancel-confirm-desc"
            className="mt-2 text-sm text-[var(--page-muted)]"
          >
            This permanently removes the booking
            {pendingCancelIds.length === 1 ? "" : "s"} so the day can be booked
            again. This cannot be undone.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClassName}
              disabled={pending}
              onClick={runCancel}
            >
              {pending ? "Canceling…" : "Yes, cancel"}
            </button>
            <button
              type="button"
              className={buttonClassName}
              disabled={pending}
              onClick={() => {
                setConfirmOpen(false);
                setPendingCancelIds([]);
              }}
            >
              Keep booking{pendingCancelIds.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      ) : null}

      {bookings.length === 0 ? (
        <p className="text-base text-[var(--page-muted)]" role="status">
          No bookings in this date range.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--control-border)] text-[var(--page-muted)]">
                <th className="px-2 py-3 font-medium">
                  {cancelableIds.length > 0 ? (
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={
                          cancelableIds.length > 0 &&
                          cancelableIds.every((id) => selectedIds.has(id))
                        }
                        onChange={toggleSelectAllCancelable}
                        disabled={pending}
                        aria-label="Select all cancelable bookings"
                      />
                      <span className="sr-only">Select</span>
                    </label>
                  ) : (
                    <span className="sr-only">Select</span>
                  )}
                </th>
                <th className="px-2 py-3 font-medium">Date</th>
                <th className="px-2 py-3 font-medium">Time</th>
                <th className="px-2 py-3 font-medium">Category</th>
                <th className="px-2 py-3 font-medium">Notes</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-2 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-b border-[var(--control-border)] align-top"
                >
                  <td className="px-2 py-3">
                    {booking.isCancelable ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(booking.id)}
                        onChange={() => toggleSelected(booking.id)}
                        disabled={pending}
                        aria-label={`Select booking on ${booking.bookingDate}`}
                      />
                    ) : null}
                  </td>
                  <td className="px-2 py-3 text-[var(--page-fg)]">
                    {booking.bookingDate}
                  </td>
                  <td className="px-2 py-3 text-[var(--page-fg)]">
                    {formatTime(booking.startTime)}–
                    {formatTime(booking.endTime)}
                  </td>
                  <td className="px-2 py-3 text-[var(--page-fg)]">
                    {CATEGORY_LABELS[booking.category]}
                  </td>
                  <td className="max-w-[14rem] px-2 py-3 text-[var(--page-muted)]">
                    {booking.notes?.trim() ? booking.notes : "—"}
                  </td>
                  <td className="px-2 py-3 text-[var(--page-fg)]">
                    {booking.noShow ? "No-show" : "—"}
                  </td>
                  <td className="px-2 py-3">
                    <BookingRowMenu
                      booking={booking}
                      disabled={pending}
                      onCancel={() => openConfirm([booking.id])}
                      onNoShow={() => runNoShow(booking.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BookingRowMenu({
  booking,
  disabled,
  onCancel,
  onNoShow,
}: {
  booking: ManagerBookingRow;
  disabled: boolean;
  onCancel: () => void;
  onNoShow: () => void;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    visibility: "hidden",
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const GAP = 4;
    const VIEWPORT_PAD = 8;
    const ESTIMATED_MENU_HEIGHT = 48;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const menuHeight =
        menuRef.current?.getBoundingClientRect().height || ESTIMATED_MENU_HEIGHT;
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
      const spaceAbove = rect.top - VIEWPORT_PAD;
      const openUpward =
        spaceBelow < menuHeight + GAP && spaceAbove > spaceBelow;

      const top = openUpward
        ? Math.max(VIEWPORT_PAD, rect.top - GAP - menuHeight)
        : Math.min(
            rect.bottom + GAP,
            window.innerHeight - VIEWPORT_PAD - menuHeight,
          );

      const menuWidth = menuRef.current?.offsetWidth ?? 160;
      const left = Math.min(
        Math.max(VIEWPORT_PAD, rect.right - menuWidth),
        window.innerWidth - VIEWPORT_PAD - menuWidth,
      );

      // Defer so this isn't a synchronous setState inside the effect body.
      requestAnimationFrame(() => {
        setMenuStyle({
          position: "fixed",
          top,
          left,
          zIndex: 50,
          minWidth: Math.max(160, rect.width),
        });
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const actionLabel = booking.isCancelable
    ? "Cancel"
    : booking.noShow
      ? null
      : "Mark as No-show";

  if (!actionLabel) {
    return <span className="text-[var(--page-muted)]">—</span>;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={buttonClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => {
          setOpen((value) => {
            if (!value) {
              setMenuStyle({
                position: "fixed",
                top: 0,
                left: 0,
                visibility: "hidden",
              });
            }
            return !value;
          });
        }}
        aria-label={`Actions for ${booking.bookingDate}`}
      >
        ⋯
      </button>
      {typeof document !== "undefined" && open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              style={menuStyle}
              className="rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] p-1 shadow-sm"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full min-h-10 items-center rounded-md px-3 text-left text-sm text-[var(--page-fg)] hover:bg-[var(--control-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                onClick={() => {
                  setOpen(false);
                  if (booking.isCancelable) {
                    onCancel();
                  } else {
                    onNoShow();
                  }
                }}
              >
                {actionLabel}
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
