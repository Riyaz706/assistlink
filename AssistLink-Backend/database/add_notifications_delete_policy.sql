-- Add DELETE policy for notifications table
-- Run this in Supabase SQL Editor to allow users to delete their own notifications

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

