-- Fix: Allow payment_status = 'captured' (used by Razorpay and backend)
-- Run this if bookings.payment_status has a CHECK that excludes 'captured'

-- Drop existing check constraint (name may vary; try common names)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check1;

-- Re-add constraint including 'captured'
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('pending', 'initiated', 'processing', 'completed', 'captured', 'failed', 'refunded'));
