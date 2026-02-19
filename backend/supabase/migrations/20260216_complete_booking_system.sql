-- Migration: Complete Booking System
-- Description: Implements role-based lifecycle, status transitions, and double-booking prevention.

-- 1. Enable btree_gist extension for overlapping constraints if not already enabled
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Create Booking Status Enum (dropping if exists for a clean slate, but usually you'd migrate)
-- Note: Supabase/Postgres might not allow dropping enums if used. 
-- We'll try to create it if it doesn't exist.
DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM (
        'draft', 'requested', 'accepted', 'confirmed', 'in_progress', 'completed', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Update Bookings Table
-- First, drop the default constraint to avoid casting errors
ALTER TABLE bookings ALTER COLUMN status DROP DEFAULT;

-- DROP THE OLD CHECK CONSTRAINT so we can update values to new ones
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Second, migrate old status values to new enum values
-- 'pending' -> 'requested'
-- 'declined' -> 'cancelled' (or keep declined if valid, but it's not in new enum)
UPDATE bookings SET status = 'requested' WHERE status = 'pending';
UPDATE bookings SET status = 'cancelled' WHERE status = 'declined';

-- Third, alter the column type
ALTER TABLE bookings 
    ALTER COLUMN status TYPE booking_status USING status::booking_status,
    ALTER COLUMN status SET DEFAULT 'draft'::booking_status;

-- Add a helper for time ranges to prevent double booking
-- We use a regular column + trigger because generated columns with timestamptz math are not immutable
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- Function to calculate end_date
CREATE OR REPLACE FUNCTION calculate_booking_end_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle potential nulls if necessary
    IF NEW.scheduled_date IS NOT NULL AND NEW.duration_hours IS NOT NULL THEN
        NEW.end_date := NEW.scheduled_date + (NEW.duration_hours * interval '1 hour');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to keep end_date updated
DROP TRIGGER IF EXISTS trg_calculate_booking_end_date ON bookings;
CREATE TRIGGER trg_calculate_booking_end_date
    BEFORE INSERT OR UPDATE OF scheduled_date, duration_hours ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION calculate_booking_end_date();

-- Backfill existing data
UPDATE bookings SET end_date = scheduled_date + (duration_hours * interval '1 hour') WHERE end_date IS NULL;

-- 4. Double Booking Prevention (Exclusion Constraint)
-- Prevent overlapping 'confirmed' or 'in_progress' bookings for the same caregiver
ALTER TABLE bookings
    DROP CONSTRAINT IF EXISTS prevent_caregiver_double_booking;

ALTER TABLE bookings
    ADD CONSTRAINT prevent_caregiver_double_booking
    EXCLUDE USING gist (
        caregiver_id WITH =,
        tstzrange(scheduled_date, end_date) WITH &&
    )
    WHERE (status IN ('requested', 'accepted', 'confirmed', 'in_progress'));

-- 5. Status Transition Enforcement Function
CREATE OR REPLACE FUNCTION enforce_booking_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Only handle status changes
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Define valid transitions
    -- draft -> requested
    -- requested -> accepted, cancelled
    -- accepted -> confirmed, cancelled
    -- confirmed -> in_progress, cancelled
    -- in_progress -> completed, cancelled
    -- No transitions from completed or cancelled

    IF OLD.status = 'draft' AND NEW.status NOT IN ('requested', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from draft to %', NEW.status;
    ELSIF OLD.status = 'requested' AND NEW.status NOT IN ('accepted', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from requested to %', NEW.status;
    ELSIF OLD.status = 'accepted' AND NEW.status NOT IN ('confirmed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from accepted to %', NEW.status;
    ELSIF OLD.status = 'confirmed' AND NEW.status NOT IN ('in_progress', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from confirmed to %', NEW.status;
    ELSIF OLD.status = 'in_progress' AND NEW.status NOT IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from in_progress to %', NEW.status;
    ELSIF OLD.status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot change status from %', OLD.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Attach Trigger
DROP TRIGGER IF EXISTS trg_enforce_booking_status ON bookings;
CREATE TRIGGER trg_enforce_booking_status
    BEFORE UPDATE OF status ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION enforce_booking_status_transition();

-- 7. RLS Policies (Comprehensive)
-- Clear existing policies to avoid conflicts
DROP POLICY IF EXISTS "Care recipients can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Care recipients can insert own bookings" ON bookings;
DROP POLICY IF EXISTS "Care recipients can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Caregivers can view assigned bookings" ON bookings;
DROP POLICY IF EXISTS "Caregivers can update assigned bookings" ON bookings;

-- Select
CREATE POLICY "Users can view relevant bookings" ON bookings
    FOR SELECT
    USING (auth.uid() = care_recipient_id OR auth.uid() = caregiver_id);

-- Insert (CR only, always starts as draft or requested)
CREATE POLICY "Care recipients can create bookings" ON bookings
    FOR INSERT
    WITH CHECK (
        auth.uid() = care_recipient_id 
        AND status IN ('draft', 'requested')
    );

-- Update (Role-based)
-- RLS checks 'USING' for visibility of the row being updated (pre-update)
-- RLS checks 'WITH CHECK' for validity of the new row state (post-update)
-- We rely on the trigger `enforce_booking_status_transition` for state machine logic.
CREATE POLICY "Role-based booking updates" ON bookings
    FOR UPDATE
    USING (auth.uid() = care_recipient_id OR auth.uid() = caregiver_id)
    WITH CHECK (auth.uid() = care_recipient_id OR auth.uid() = caregiver_id);

-- Enable Realtime
ALTER TABLE bookings REPLICA IDENTITY FULL;
-- Note: Realtime for 'bookings' table must be enabled in the Supabase Dashboard 
-- or via 'ALTER PUBLICATION supabase_realtime ADD TABLE bookings;'
