-- IMPORTANT SECURITY NOTE:
-- This view is intentionally public. It uses Postgres default view behavior
-- (owner privileges), which BYPASSES RLS on the underlying trucks table by design.
-- security_invoker is NOT enabled — do not set it to true or the view will break
-- for anon users while trucks remains locked down.
-- MUST NEVER be modified to expose additional columns from trucks (contact info,
-- COI path, approval flags, etc.) without a deliberate security review.
--
-- PURPOSE (distinct from bookable_trucks):
-- truck_names is for DISPLAY ONLY on historical/current bookings — every truck that
-- has ever been registered can show its business name, even if later unapproved or
-- expired. Do NOT conflate or replace bookable_trucks (who may select to book) with
-- this view (whose name may appear on the calendar).
CREATE VIEW truck_names AS
SELECT id, business_name
FROM trucks;

GRANT SELECT ON truck_names TO anon, authenticated;
