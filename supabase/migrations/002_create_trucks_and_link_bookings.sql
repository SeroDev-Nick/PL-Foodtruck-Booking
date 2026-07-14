-- Trucks table: persistent profiles with COI tracking
CREATE TABLE trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  contact_email text NOT NULL,
  phone_number text NOT NULL,
  coi_storage_path text,
  coi_expiration_date date NOT NULL,
  manager_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fully locked down: no public SELECT/INSERT/UPDATE/DELETE policies.
-- Writes go through the service-role client only.
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;

-- IMPORTANT SECURITY NOTE:
-- This view is intentionally public. It uses Postgres default view behavior
-- (owner privileges), which BYPASSES RLS on the underlying trucks table by design.
-- security_invoker is NOT enabled — do not set it to true or the view will break
-- for anon users while trucks remains locked down.
-- MUST NEVER be modified to expose additional columns from trucks (contact info,
-- COI path, approval flags, etc.) without a deliberate security review.
CREATE VIEW bookable_trucks AS
SELECT id, business_name
FROM trucks
WHERE manager_approved = true
  AND coi_expiration_date >= current_date;

GRANT SELECT ON bookable_trucks TO anon, authenticated;

-- Link bookings to trucks; drop per-row contact fields now owned by trucks.
-- truck_id is nullable so any existing test booking rows survive this migration.
ALTER TABLE bookings
  ADD COLUMN truck_id uuid REFERENCES trucks(id);

ALTER TABLE bookings
  DROP COLUMN business_name,
  DROP COLUMN contact_email,
  DROP COLUMN phone_number;

-- Private COI document bucket (not publicly readable).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'truck-cois',
  'truck-cois',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
);
