-- Fix: pg_advisory_xact_lock(key1 int, key2 int) requires int args; previous migration used bigint.
-- Replaces the lock call inside book_slot_atomic with correct types.
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

    -- Advisory lock: use int args (pg_advisory_xact_lock(int, int)); epoch::int safe through 2038
    PERFORM pg_advisory_xact_lock(
        abs(hashtext(p_caregiver_id::text)),
        (extract(epoch from p_scheduled_date))::int
    );

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
