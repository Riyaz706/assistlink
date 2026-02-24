-- =============================================================================
-- AssistLink: Booking Slots Schema - Zero Overlap Guarantee
-- =============================================================================
-- This schema ensures NO overlapping bookings for the same caregiver.
-- Uses: (1) EXCLUDE constraint at DB level, (2) Advisory locks, (3) Atomic RPC.
-- All times in UTC. Overlap rule: (startA < endB) AND (endA > startB).
--
-- USAGE:
--   - New install: Run schema.sql first, then this file.
--   - Existing DB: Ensure bookings table exists. This adds end_date, constraint,
--     functions, and triggers. Run in Supabase SQL Editor.
--
-- BLOCKING STATUSES: requested, accepted, confirmed, in_progress
-- NON-BLOCKING: draft, completed, cancelled (caregiver slot is free)
-- =============================================================================

-- 1. Enable btree_gist for EXCLUDE with (caregiver_id, tstzrange)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Create/ensure booking_status enum
DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM (
        'draft', 'requested', 'accepted', 'confirmed', 'in_progress', 'completed', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Ensure bookings has required columns (for new installs or migrations)
-- If bookings already exists with old structure, run migrations 20260216_complete_booking_system first

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- Drop old CHECK if exists (allows migration from text status)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Migrate legacy status values (only if column is text; skip if already enum)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='status' AND udt_name != 'booking_status') THEN
        UPDATE bookings SET status = 'requested' WHERE status IN ('pending', 'requested');
        UPDATE bookings SET status = 'cancelled' WHERE status IN ('declined', 'cancelled');
        ALTER TABLE bookings ALTER COLUMN status TYPE booking_status USING status::text::booking_status;
    END IF;
    ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'draft'::booking_status;
EXCEPTION WHEN OTHERS THEN null;
END $$;

-- 4. Trigger: auto-calculate end_date from scheduled_date + duration_hours
CREATE OR REPLACE FUNCTION calculate_booking_end_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.scheduled_date IS NOT NULL AND NEW.duration_hours IS NOT NULL THEN
        NEW.end_date := NEW.scheduled_date + (NEW.duration_hours * interval '1 hour');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_booking_end_date ON bookings;
CREATE TRIGGER trg_calculate_booking_end_date
    BEFORE INSERT OR UPDATE OF scheduled_date, duration_hours ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION calculate_booking_end_date();

-- Backfill end_date for existing rows (required before EXCLUDE - expression must be immutable)
UPDATE bookings SET end_date = scheduled_date + (duration_hours * interval '1 hour') 
WHERE end_date IS NULL AND scheduled_date IS NOT NULL AND duration_hours IS NOT NULL;

-- 4b. Resolve existing overlaps (required before EXCLUDE can be added)
-- For overlapping bookings: keep the "best" one (in_progress > confirmed > accepted > requested, then earliest created), cancel the rest
UPDATE bookings b1
SET status = 'cancelled'
WHERE b1.caregiver_id IS NOT NULL
  AND b1.status IN ('requested', 'accepted', 'confirmed', 'in_progress')
  AND b1.end_date IS NOT NULL
  AND b1.scheduled_date IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM bookings b2
    WHERE b2.caregiver_id = b1.caregiver_id
      AND b2.id != b1.id
      AND b2.status IN ('requested', 'accepted', 'confirmed', 'in_progress')
      AND b2.end_date IS NOT NULL
      AND b2.scheduled_date IS NOT NULL
      AND (b2.scheduled_date, b2.end_date) OVERLAPS (b1.scheduled_date, b1.end_date)
      AND (
        (CASE b2.status WHEN 'in_progress' THEN 4 WHEN 'confirmed' THEN 3 WHEN 'accepted' THEN 2 ELSE 1 END)
        > (CASE b1.status WHEN 'in_progress' THEN 4 WHEN 'confirmed' THEN 3 WHEN 'accepted' THEN 2 ELSE 1 END)
        OR (
          (CASE b2.status WHEN 'in_progress' THEN 4 WHEN 'confirmed' THEN 3 WHEN 'accepted' THEN 2 ELSE 1 END)
          = (CASE b1.status WHEN 'in_progress' THEN 4 WHEN 'confirmed' THEN 3 WHEN 'accepted' THEN 2 ELSE 1 END)
          AND b2.created_at < b1.created_at
        )
      )
  );

-- 5. EXCLUDE constraint: no overlapping slots for same caregiver
-- Use plain columns only (scheduled_date, end_date) - immutable for index
-- Blocking statuses: requested, accepted, confirmed, in_progress
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS prevent_caregiver_double_booking;

ALTER TABLE bookings
    ADD CONSTRAINT prevent_caregiver_double_booking
    EXCLUDE USING gist (
        caregiver_id WITH =,
        tstzrange(scheduled_date, end_date) WITH &&
    )
    WHERE (
        caregiver_id IS NOT NULL
        AND status IN ('requested', 'accepted', 'confirmed', 'in_progress')
        AND end_date IS NOT NULL
        AND scheduled_date IS NOT NULL
    );

COMMENT ON CONSTRAINT prevent_caregiver_double_booking ON bookings IS 
    'Prevents overlapping bookings for the same caregiver. Blocking statuses: requested, accepted, confirmed, in_progress.';

-- 6. Status transition enforcement (valid state machine)
CREATE OR REPLACE FUNCTION enforce_booking_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

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

DROP TRIGGER IF EXISTS trg_enforce_booking_status ON bookings;
CREATE TRIGGER trg_enforce_booking_status
    BEFORE UPDATE OF status ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION enforce_booking_status_transition();

-- 7. Slot availability check (for UI free/busy)
CREATE OR REPLACE FUNCTION check_slot_available(
    p_caregiver_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_overlap_count INTEGER;
BEGIN
    IF p_start_time >= p_end_time THEN
        RETURN FALSE;
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_overlap_count
    FROM bookings b
    WHERE b.caregiver_id = p_caregiver_id
      AND b.status IN ('requested', 'accepted', 'confirmed', 'in_progress')
      AND (b.scheduled_date, COALESCE(b.end_date, b.scheduled_date + (b.duration_hours * interval '1 hour'))) 
          OVERLAPS (p_start_time, p_end_time)
      AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id);

    RETURN (v_overlap_count = 0);
END;
$$;

COMMENT ON FUNCTION check_slot_available IS 
    'Returns true if slot (p_start_time, p_end_time) is free for caregiver. Overlap: (startA < endB) AND (endA > startB).';

-- 8. Atomic slot booking: advisory lock + re-check + insert (prevents race conditions)
CREATE OR REPLACE FUNCTION book_slot_atomic(
    p_care_recipient_id UUID,
    p_caregiver_id UUID,
    p_service_type TEXT,
    p_scheduled_date TIMESTAMPTZ,
    p_duration_hours DECIMAL,
    p_location JSONB DEFAULT NULL,
    p_specific_needs TEXT DEFAULT NULL,
    p_is_emergency BOOLEAN DEFAULT FALSE,
    p_video_call_request_id UUID DEFAULT NULL,
    p_chat_session_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_end_time TIMESTAMPTZ;
    v_overlap_count INTEGER;
    v_booking_id UUID;
    v_result JSONB;
BEGIN
    IF p_scheduled_date IS NULL OR p_duration_hours IS NULL OR p_duration_hours <= 0 OR p_duration_hours > 24 THEN
        RAISE EXCEPTION 'SLOT_INVALID_TIME' USING ERRCODE = '22P02';
    END IF;

    v_end_time := p_scheduled_date + (p_duration_hours * interval '1 hour');

    IF v_end_time <= NOW() THEN
        RAISE EXCEPTION 'SLOT_IN_PAST' USING ERRCODE = '22P02';
    END IF;

    -- Advisory lock: one concurrent booking per (caregiver, slot_start)
    PERFORM pg_advisory_xact_lock(
        abs(hashtext(p_caregiver_id::text)),
        (extract(epoch from p_scheduled_date))::int
    );

    IF NOT p_is_emergency THEN
        SELECT COUNT(*)::INTEGER INTO v_overlap_count
        FROM bookings b
        WHERE b.caregiver_id = p_caregiver_id
          AND b.status IN ('requested', 'accepted', 'confirmed', 'in_progress')
          AND (b.scheduled_date, COALESCE(b.end_date, b.scheduled_date + (b.duration_hours * interval '1 hour'))) 
              OVERLAPS (p_scheduled_date, v_end_time);

        IF v_overlap_count > 0 THEN
            RAISE EXCEPTION 'SLOT_ALREADY_BOOKED' USING ERRCODE = '23P01';
        END IF;
    END IF;

    INSERT INTO bookings (
        care_recipient_id,
        caregiver_id,
        service_type,
        scheduled_date,
        duration_hours,
        location,
        specific_needs,
        status,
        video_call_request_id,
        chat_session_id
    ) VALUES (
        p_care_recipient_id,
        p_caregiver_id,
        p_service_type,
        p_scheduled_date,
        p_duration_hours,
        p_location,
        p_specific_needs,
        'requested',
        p_video_call_request_id,
        p_chat_session_id
    )
    RETURNING id INTO v_booking_id;

    SELECT to_jsonb(b) INTO v_result
    FROM bookings b
    WHERE b.id = v_booking_id;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION book_slot_atomic IS 
    'Atomically books a slot. Uses advisory lock to prevent race conditions. is_emergency skips overlap check.';

-- 9. Grants
GRANT EXECUTE ON FUNCTION check_slot_available(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_slot_available(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION book_slot_atomic(UUID, UUID, TEXT, TIMESTAMPTZ, DECIMAL, JSONB, TEXT, BOOLEAN, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION book_slot_atomic(UUID, UUID, TEXT, TIMESTAMPTZ, DECIMAL, JSONB, TEXT, BOOLEAN, UUID, UUID) TO service_role;

-- 10. Indexes for overlap/range queries
CREATE INDEX IF NOT EXISTS idx_bookings_caregiver_status_range 
    ON bookings (caregiver_id, status) 
    WHERE status IN ('requested', 'accepted', 'confirmed', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_end 
    ON bookings (scheduled_date, end_date) 
    WHERE caregiver_id IS NOT NULL AND status IN ('requested', 'accepted', 'confirmed', 'in_progress');
