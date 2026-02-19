-- Razorpay Payment Integration

-- 1. Create payment_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'refunded', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    care_recipient_id UUID NOT NULL REFERENCES users(id),
    caregiver_id UUID NOT NULL REFERENCES users(id),
    
    razorpay_order_id TEXT UNIQUE NOT NULL,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_signature TEXT,
    
    amount DECIMAL(12, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status payment_status NOT NULL DEFAULT 'pending',
    
    notes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Update bookings table to include common payment fields for quick access
ALTER TABLE bookings 
    ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id),
    ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT UNIQUE;

-- 4. Create trigger to update updated_at for payments
CREATE OR REPLACE FUNCTION update_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_updated_at();

-- 5. Row Level Security for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 5a. Care recipients can view their own payments
CREATE POLICY payments_care_recipient_view ON payments
    FOR SELECT
    USING (auth.uid() = care_recipient_id);

-- 5b. Caregivers can view payments related to their bookings
CREATE POLICY payments_caregiver_view ON payments
    FOR SELECT
    USING (auth.uid() = caregiver_id);

-- 5c. Service role/admin can do everything
CREATE POLICY payments_admin_all ON payments
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 6. Enable Realtime for payments
ALTER TABLE payments REPLICA IDENTITY FULL;
