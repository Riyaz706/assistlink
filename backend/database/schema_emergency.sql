-- Add Emergencies table to track SOS alerts
CREATE TABLE IF NOT EXISTS emergencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    location JSONB, -- {latitude, longitude, timestamp, location_name}
    caregiver_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Who acknowledged
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE emergencies ENABLE ROW LEVEL SECURITY;

-- Policies (drop first so script is safe to re-run)
DROP POLICY IF EXISTS "Users can view their own emergencies" ON emergencies;
CREATE POLICY "Users can view their own emergencies"
    ON emergencies FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = caregiver_id);

DROP POLICY IF EXISTS "Anyone can create their own emergency" ON emergencies;
CREATE POLICY "Anyone can create their own emergency"
    ON emergencies FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users involved can update emergency status" ON emergencies;
CREATE POLICY "Users involved can update emergency status"
    ON emergencies FOR UPDATE
    USING (auth.uid() = user_id OR auth.uid() = caregiver_id)
    WITH CHECK (auth.uid() = user_id OR auth.uid() = caregiver_id);

-- Trigger for updated_at (self-contained; no dependency on update_updated_at_column)
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
