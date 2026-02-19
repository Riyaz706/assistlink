-- AssistLink Database Schema for Supabase (PostgreSQL) - MVP Version

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  role TEXT NOT NULL CHECK (role IN ('care_recipient', 'caregiver')),
  address JSONB,
  profile_photo_url TEXT,
  current_location JSONB, -- {latitude, longitude, timestamp, address}
  emergency_contact JSONB, -- {name, phone, relationship}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Caregiver profiles table
CREATE TABLE IF NOT EXISTS caregiver_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skills TEXT[],
  availability_status TEXT DEFAULT 'unavailable' CHECK (availability_status IN ('available', 'unavailable', 'busy')),
  availability_schedule JSONB, -- {monday: {start, end}, tuesday: ...}
  qualifications TEXT[],
  experience_years INTEGER,
  bio TEXT,
  hourly_rate DECIMAL(10, 2),
  avg_rating DECIMAL(3, 2) DEFAULT 0.00,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video call requests table (for 15-second video call before booking)
CREATE TABLE IF NOT EXISTS video_call_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER DEFAULT 15,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'expired')),
  care_recipient_accepted BOOLEAN DEFAULT false,
  caregiver_accepted BOOLEAN DEFAULT false,
  video_call_url TEXT, -- WebRTC room URL or similar
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sessions table (chat enabled only when both parties accept)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_call_request_id UUID REFERENCES video_call_requests(id) ON DELETE SET NULL,
  is_enabled BOOLEAN DEFAULT false, -- Only true when both accept
  care_recipient_accepted BOOLEAN DEFAULT false,
  caregiver_accepted BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(care_recipient_id, caregiver_id)
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  video_call_request_id UUID REFERENCES video_call_requests(id) ON DELETE SET NULL,
  chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('exam_assistance', 'daily_care', 'one_time', 'recurring', 'video_call_session')),
  scheduled_date TIMESTAMPTZ NOT NULL,
  duration_hours DECIMAL(4, 2) DEFAULT 2.00,
  location JSONB,
  specific_needs TEXT,
  recurring_pattern JSONB, -- {frequency: 'daily'|'weekly'|'monthly', days_of_week: [], end_date: null}
  is_recurring BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'in_progress', 'completed')),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table (only works when chat session is enabled)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document')),
  attachment_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'system', -- 'system', 'booking', 'chat', 'payment'
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User devices table (for push notifications)
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  device_info JSONB,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_token)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_caregiver_profile_user_id ON caregiver_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_profile_availability ON caregiver_profile(availability_status);
CREATE INDEX IF NOT EXISTS idx_video_call_requests_care_recipient ON video_call_requests(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_video_call_requests_caregiver ON video_call_requests(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_video_call_requests_status ON video_call_requests(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_care_recipient ON chat_sessions(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_caregiver ON chat_sessions(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_enabled ON chat_sessions(is_enabled);
CREATE INDEX IF NOT EXISTS idx_bookings_care_recipient ON bookings(care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_bookings_caregiver ON bookings(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_date ON bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bookings_is_recurring ON bookings(is_recurring);
CREATE INDEX IF NOT EXISTS idx_messages_chat_session ON messages(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_caregiver_profile_updated_at BEFORE UPDATE ON caregiver_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_call_requests_updated_at BEFORE UPDATE ON video_call_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_call_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for caregiver_profile table
CREATE POLICY "Anyone can view caregiver profiles"
  ON caregiver_profile FOR SELECT
  USING (true);

CREATE POLICY "Caregivers can update their own profile"
  ON caregiver_profile FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Caregivers can insert their own profile"
  ON caregiver_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for video_call_requests table
CREATE POLICY "Users can view their own video call requests"
  ON video_call_requests FOR SELECT
  USING (auth.uid() = care_recipient_id OR auth.uid() = caregiver_id);

CREATE POLICY "Care recipients can create video call requests"
  ON video_call_requests FOR INSERT
  WITH CHECK (auth.uid() = care_recipient_id);

CREATE POLICY "Users can update their own video call requests"
  ON video_call_requests FOR UPDATE
  USING (auth.uid() = care_recipient_id OR auth.uid() = caregiver_id);

-- RLS Policies for chat_sessions table
CREATE POLICY "Users can view their own chat sessions"
  ON chat_sessions FOR SELECT
  USING (auth.uid() = care_recipient_id OR auth.uid() = caregiver_id);

CREATE POLICY "Chat sessions can be created by system"
  ON chat_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own chat sessions"
  ON chat_sessions FOR UPDATE
  USING (auth.uid() = care_recipient_id OR auth.uid() = caregiver_id);

-- RLS Policies for bookings table
CREATE POLICY "Users can view their own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = care_recipient_id OR auth.uid() = caregiver_id);

CREATE POLICY "Care recipients can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = care_recipient_id);

CREATE POLICY "Users can update their own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = care_recipient_id OR auth.uid() = caregiver_id);

-- RLS Policies for messages table
CREATE POLICY "Users can view messages in their chat sessions"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = messages.chat_session_id
      AND (chat_sessions.care_recipient_id = auth.uid() OR chat_sessions.caregiver_id = auth.uid())
      AND chat_sessions.is_enabled = true
    )
  );

CREATE POLICY "Users can send messages in enabled chat sessions"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = messages.chat_session_id
      AND (chat_sessions.care_recipient_id = auth.uid() OR chat_sessions.caregiver_id = auth.uid())
      AND chat_sessions.is_enabled = true
    )
  );

CREATE POLICY "Users can update their own received messages"
  ON messages FOR UPDATE
  USING (auth.uid() = recipient_id);

-- RLS Policies for notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for user_devices table
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices"
  ON user_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can register their own devices"
  ON user_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices"
  ON user_devices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices"
  ON user_devices FOR DELETE
  USING (auth.uid() = user_id);
