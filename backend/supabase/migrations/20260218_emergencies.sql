-- Emergencies table for SOS alerts (care recipient triggers; caregivers get notified)
CREATE TABLE IF NOT EXISTS emergencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    location JSONB,
    caregiver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE emergencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own emergencies"
    ON emergencies FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = caregiver_id);

CREATE POLICY "Users can insert own emergency"
    ON emergencies FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users involved can update emergency"
    ON emergencies FOR UPDATE
    USING (auth.uid() = user_id OR auth.uid() = caregiver_id)
    WITH CHECK (auth.uid() = user_id OR auth.uid() = caregiver_id);

CREATE OR REPLACE FUNCTION set_emergencies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_emergencies_updated_at ON emergencies;
CREATE TRIGGER update_emergencies_updated_at
    BEFORE UPDATE ON emergencies
    FOR EACH ROW
    EXECUTE FUNCTION set_emergencies_updated_at();
