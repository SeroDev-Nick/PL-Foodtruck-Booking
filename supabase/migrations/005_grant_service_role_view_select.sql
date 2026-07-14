-- service_role bypasses RLS but still needs explicit privileges on views.
-- bookable_trucks / truck_names were previously granted only to anon and
-- authenticated; without SELECT for service_role, Server Action eligibility
-- checks against bookable_trucks return empty and bookings falsely fail.
--
-- Additive only: do not alter anon/authenticated grants, view definitions,
-- WHERE filters, or security_invoker settings.

GRANT SELECT ON TABLE public.bookable_trucks TO service_role;
GRANT SELECT ON TABLE public.truck_names TO service_role;
