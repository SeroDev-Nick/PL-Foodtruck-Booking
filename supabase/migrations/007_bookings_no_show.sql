-- Historical no-show label for past bookings only.
-- Does not affect availability, daily-limit trigger, or unique (booking_date, truck_id).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS no_show boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bookings.no_show IS
  'Manager-set historical label for past dates; unused by live calendar logic.';
