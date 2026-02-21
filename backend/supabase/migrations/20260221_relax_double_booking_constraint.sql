-- Relax double-booking constraint so only committed bookings block the slot.
-- Before: status IN ('requested', 'accepted', 'confirmed', 'in_progress') — any request blocked the slot.
-- After:  status IN ('accepted', 'confirmed', 'in_progress') — multiple care recipients can request
--         the same slot; only accepted/confirmed/in_progress bookings prevent new requests.

ALTER TABLE bookings
    DROP CONSTRAINT IF EXISTS prevent_caregiver_double_booking;

ALTER TABLE bookings
    ADD CONSTRAINT prevent_caregiver_double_booking
    EXCLUDE USING gist (
        caregiver_id WITH =,
        tstzrange(scheduled_date, end_date) WITH &&
    )
    WHERE (status IN ('accepted', 'confirmed', 'in_progress'));
