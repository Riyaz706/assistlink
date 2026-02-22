-- Production-ready atomic slot booking for AssistLink
-- Prevents double booking and race conditions via advisory lock + overlap check.
-- All times in UTC.

-- 1. Slot availability check (for UI to show free/busy)
-- Returns true if the slot is free for the caregiver (no overlapping requested/accepted/confirmed/in_progress).
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
      AND (b.scheduled_date, COALESCE(b.end_date, b.scheduled_date + (b.duration_hours * interval '1 hour'))) OVERLAPS (p_start_time, p_end_time)
      AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id);

    RETURN (v_overlap_count = 0);
END;
$$;

COMMENT ON FUNCTION check_slot_available IS 'Returns true if slot (p_start_time, p_end_time) is free for caregiver. Overlap: (startA < endB) AND (endA > startB).';

-- 2. Atomic slot booking: lock, re-check, insert. Only one concurrent booking for same caregiver+slot wins.
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
    -- Validate time range (zero-duration and past rejected)
    IF p_scheduled_date IS NULL OR p_duration_hours IS NULL OR p_duration_hours <= 0 OR p_duration_hours > 24 THEN
        RAISE EXCEPTION 'SLOT_INVALID_TIME' USING ERRCODE = '22P02';
    END IF;

    v_end_time := p_scheduled_date + (p_duration_hours * interval '1 hour');

    -- Reject past bookings (UTC)
    IF v_end_time <= NOW() THEN
        RAISE EXCEPTION 'SLOT_IN_PAST' USING ERRCODE = '22P02';
    END IF;

    -- Advisory lock: same caregiver + slot start => only one transaction proceeds at a time
    -- pg_advisory_xact_lock(key1 int, key2 int) requires int; epoch::int is safe for dates through 2038
    PERFORM pg_advisory_xact_lock(
        abs(hashtext(p_caregiver_id::text)),
        (extract(epoch from p_scheduled_date))::int
    );

    -- Re-check overlap inside transaction (unless emergency override)
    IF NOT p_is_emergency THEN
        SELECT COUNT(*)::INTEGER INTO v_overlap_count
        FROM bookings b
        WHERE b.caregiver_id = p_caregiver_id
          AND b.status IN ('requested', 'accepted', 'confirmed', 'in_progress')
          AND (b.scheduled_date, COALESCE(b.end_date, b.scheduled_date + (b.duration_hours * interval '1 hour'))) OVERLAPS (p_scheduled_date, v_end_time);

        IF v_overlap_count > 0 THEN
            RAISE EXCEPTION 'SLOT_ALREADY_BOOKED' USING ERRCODE = '23P01';
        END IF;
    END IF;

    -- Insert booking (status requested; end_date set by trigger)
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

    -- Return created row as JSONB for API response
    SELECT to_jsonb(b) INTO v_result
    FROM bookings b
    WHERE b.id = v_booking_id;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION book_slot_atomic IS 'Atomically books a slot for a caregiver. Uses advisory lock to prevent race conditions. Emergency flag skips overlap check.';

-- Grant execute to authenticated and service role (Supabase)
GRANT EXECUTE ON FUNCTION check_slot_available(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_slot_available(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION book_slot_atomic(UUID, UUID, TEXT, TIMESTAMPTZ, DECIMAL, JSONB, TEXT, BOOLEAN, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION book_slot_atomic(UUID, UUID, TEXT, TIMESTAMPTZ, DECIMAL, JSONB, TEXT, BOOLEAN, UUID, UUID) TO service_role;
