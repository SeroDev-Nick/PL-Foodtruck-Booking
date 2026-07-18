-- Prompt 8 Stage 1: messaging data layer only (no UI).
-- Tables are locked down like trucks/bookings: RLS on, no policies.
-- All app access goes through the service-role client.

-- ---------------------------------------------------------------------------
-- Message subject enum (application also validates these labels)
-- ---------------------------------------------------------------------------
CREATE TYPE public.message_subject AS ENUM (
  'general_question',
  'coi_replacement',
  'booking_change',
  'profile_correction',
  'eligibility_inquiry'
);

-- ---------------------------------------------------------------------------
-- messages: one-way truck → manager messages
-- ---------------------------------------------------------------------------
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES public.trucks (id),
  subject public.message_subject NOT NULL,
  body text NOT NULL,
  attachment_storage_path text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.messages IS
  'One-way messages from trucks to managers. Attachments live in message-attachments, not truck-cois.';

COMMENT ON COLUMN public.messages.attachment_storage_path IS
  'Optional path in the private message-attachments bucket. Not the truck official COI.';

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated have no direct access.

CREATE INDEX messages_truck_id_created_at_idx
  ON public.messages (truck_id, created_at DESC);

CREATE INDEX messages_truck_id_unread_idx
  ON public.messages (truck_id)
  WHERE read = false;

-- ---------------------------------------------------------------------------
-- managers: Auth users who receive inbox access + optional primary email
-- ---------------------------------------------------------------------------
CREATE TABLE public.managers (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE public.managers IS
  'Manager Auth users. is_primary designates the SendGrid notification recipient.';

ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated have no direct access.

-- At most one primary manager at a time.
CREATE UNIQUE INDEX managers_one_primary_idx
  ON public.managers (is_primary)
  WHERE is_primary = true;

-- ---------------------------------------------------------------------------
-- Private bucket for message attachments (separate from truck-cois)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
);

-- ---------------------------------------------------------------------------
-- service_role table grants (RLS bypass still needs GRANT privileges)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.managers TO service_role;
