-- Fix: Remove the trigger that tries to update non-existent updated_at column
-- Run this in Supabase SQL Editor if you already ran the notifications schema

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;

-- The notifications table doesn't need updated_at since we track read_at instead

