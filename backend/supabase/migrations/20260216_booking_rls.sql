-- Enable RLS on tables
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_notes ENABLE ROW LEVEL SECURITY;

-- Bookings Policies
-- Care Recipients can view their own bookings
CREATE POLICY "Care recipients can view own bookings" ON bookings
    FOR SELECT
    USING (auth.uid() = care_recipient_id);

-- Care Recipients can create bookings (for themselves)
CREATE POLICY "Care recipients can insert own bookings" ON bookings
    FOR INSERT
    WITH CHECK (auth.uid() = care_recipient_id);

-- Care Recipients can update their own bookings (e.g. cancel)
CREATE POLICY "Care recipients can update own bookings" ON bookings
    FOR UPDATE
    USING (auth.uid() = care_recipient_id);

-- Caregivers can view bookings assigned to them
CREATE POLICY "Caregivers can view assigned bookings" ON bookings
    FOR SELECT
    USING (auth.uid() = caregiver_id);

-- Caregivers can update bookings assigned to them (accept/reject/complete)
CREATE POLICY "Caregivers can update assigned bookings" ON bookings
    FOR UPDATE
    USING (auth.uid() = caregiver_id);


-- Booking Notes Policies
-- Users can view notes for bookings they are part of
CREATE POLICY "Users can view notes for their bookings" ON booking_notes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = booking_notes.booking_id
            AND (bookings.care_recipient_id = auth.uid() OR bookings.caregiver_id = auth.uid())
        )
    );

-- Users can insert notes for bookings they are part of
CREATE POLICY "Users can insert notes for their bookings" ON booking_notes
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = booking_notes.booking_id
            AND (bookings.care_recipient_id = auth.uid() OR bookings.caregiver_id = auth.uid())
        )
    );

-- Booking History Policies
-- Users can view history for bookings they are part of
CREATE POLICY "Users can view history for their bookings" ON booking_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = booking_history.booking_id
            AND (bookings.care_recipient_id = auth.uid() OR bookings.caregiver_id = auth.uid())
        )
    );
