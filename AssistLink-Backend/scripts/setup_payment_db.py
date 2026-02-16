import sys
import os

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config.db import execute_query

def setup_payment_db():
    print("Setting up payment and earnings tables...")
    
    sql = """
    -- 1. Create Payments Table
    CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID REFERENCES bookings(id),
        user_id UUID REFERENCES users(id), -- Payer (Care Recipient)
        caregiver_id UUID REFERENCES users(id), -- Receiver
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'INR',
        status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed, refunded
        provider_transaction_id VARCHAR(100), -- Razorpay Payment ID
        provider_order_id VARCHAR(100), -- Razorpay Order ID
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 2. Create Caregiver Earnings Table
    CREATE TABLE IF NOT EXISTS caregiver_earnings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        caregiver_id UUID REFERENCES users(id),
        booking_id UUID REFERENCES bookings(id),
        gross_amount DECIMAL(10, 2) NOT NULL, -- Total paid by user
        platform_fee DECIMAL(10, 2) NOT NULL, -- Commission
        net_amount DECIMAL(10, 2) NOT NULL, -- Earnings for caregiver
        status VARCHAR(20) DEFAULT 'detailed', -- detailed (ledger), pending_payout, paid
        payout_id UUID, -- Link to a future payout table if needed
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 3. Indexes for Performance
    CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_earnings_caregiver_id ON caregiver_earnings(caregiver_id);
    """
    
    try:
        execute_query(sql, fetch=False)
        print("Successfully created payments and caregiver_earnings tables.")
    except Exception as e:
        print(f"Error creating tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    setup_payment_db()
