-- Migration: Add emergency_contact field to users table
-- Run this in Supabase SQL Editor

-- Add emergency_contact column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS emergency_contact JSONB;

-- Add comment for documentation
COMMENT ON COLUMN users.emergency_contact IS 'Emergency contact information stored as JSON: {name: string, phone: string}';

