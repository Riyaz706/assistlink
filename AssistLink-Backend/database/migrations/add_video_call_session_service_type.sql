-- Migration: Add 'video_call_session' to bookings.service_type enum
-- Run this migration on existing databases to allow video_call_session bookings

-- Drop the existing constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_service_type_check;

-- Add the new constraint with video_call_session included
ALTER TABLE bookings ADD CONSTRAINT bookings_service_type_check 
  CHECK (service_type IN ('exam_assistance', 'daily_care', 'one_time', 'recurring', 'video_call_session'));

