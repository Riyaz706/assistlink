-- Create video_calls table if it doesn't exist
CREATE TABLE IF NOT EXISTS video_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
    room_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created', -- created, active, ended
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;

-- Policies
-- Participants can view their video call info
CREATE POLICY "Participants can view video calls" ON video_calls
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = video_calls.booking_id
            AND (bookings.care_recipient_id = auth.uid() OR bookings.caregiver_id = auth.uid())
        )
    );

-- Backend (service role) usually handles inserts/updates, but if we allow frontend to update status (e.g. "ended"):
CREATE POLICY "Participants can update video calls" ON video_calls
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = video_calls.booking_id
            AND (bookings.care_recipient_id = auth.uid() OR bookings.caregiver_id = auth.uid())
        )
    );
