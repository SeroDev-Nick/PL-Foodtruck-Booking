-- service_role bypasses RLS but still needs table-level GRANT privileges.
-- Without these, Server Actions using the service-role key fail with
-- "permission denied for table ..." even though RLS is not the blocker.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trucks TO service_role;

-- Prompt 4 booking writes will use the same service-role client pattern.
-- Confirm equivalent privileges exist on bookings now to avoid the same failure later.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO service_role;
