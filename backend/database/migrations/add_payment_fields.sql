-- Migration: Add payment fields to bookings table for Razorpay integration
-- Run this in Supabase SQL Editor

-- Add payment-related columns to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'initiated', 'processing', 'completed', 'failed', 'refunded')),
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_signature TEXT,
ADD COLUMN IF NOT EXISTS payment_initiated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_razorpay_order_id ON bookings(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

-- Add comment for documentation
COMMENT ON COLUMN bookings.amount IS 'Payment amount in the specified currency';
COMMENT ON COLUMN bookings.currency IS 'Currency code (default: INR)';
COMMENT ON COLUMN bookings.payment_status IS 'Current status of the payment';
COMMENT ON COLUMN bookings.razorpay_order_id IS 'Razorpay order ID for tracking';
COMMENT ON COLUMN bookings.razorpay_payment_id IS 'Razorpay payment ID after successful payment';
COMMENT ON COLUMN bookings.razorpay_signature IS 'Razorpay signature for payment verification';

