-- Booking category enum
CREATE TYPE booking_category AS ENUM (
  'meal',
  'coffee',
  'beverage',
  'dessert',
  'snacks'
);

-- Bookings table
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  contact_email text NOT NULL,
  phone_number text NOT NULL,
  category booking_category NOT NULL,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce max 2 bookings per booking_date at the database level
CREATE OR REPLACE FUNCTION enforce_booking_daily_limit()
RETURNS TRIGGER AS $$
DECLARE
  booking_count integer;
BEGIN
  SELECT COUNT(*) INTO booking_count
  FROM bookings
  WHERE booking_date = NEW.booking_date
    AND (TG_OP = 'INSERT' OR id != NEW.id);

  IF booking_count >= 2 THEN
    RAISE EXCEPTION 'Maximum 2 bookings per day allowed for date %', NEW.booking_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_daily_limit_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_booking_daily_limit();

-- Row Level Security: public read, no public write
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on bookings"
  ON bookings
  FOR SELECT
  TO anon, authenticated
  USING (true);
