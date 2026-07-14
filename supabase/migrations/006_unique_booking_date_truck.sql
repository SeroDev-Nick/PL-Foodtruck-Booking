-- One truck may book a given date only once (cannot fill both daily slots).
-- Applies after existing 2-per-day trigger; both constraints must hold.
-- NOTE: Delete any duplicate (booking_date, truck_id) rows before applying,
-- or this ALTER will fail.

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_booking_date_truck_id_key
  UNIQUE (booking_date, truck_id);
