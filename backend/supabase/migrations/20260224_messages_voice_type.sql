-- Allow voice message type in messages table
-- Note: Create Supabase Storage bucket "chat-attachments" (public) for voice message uploads.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'document', 'voice'));
