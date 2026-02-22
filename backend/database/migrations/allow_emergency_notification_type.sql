-- Allow 'emergency' in notifications.type (in case a strict CHECK was applied)
-- Run this if notifications with type='emergency' fail to insert.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'notifications'
    AND constraint_name LIKE '%type%'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignore if constraint name differs or no constraint
END $$;

-- Ensure type column accepts any value (no restrictive CHECK)
-- If your DB has no CHECK, this is a no-op.
