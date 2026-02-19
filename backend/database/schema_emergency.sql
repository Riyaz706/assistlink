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

-- Policies
CREATE POLICY "Users can view their own emergencies"
    ON emergencies FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = caregiver_id);

CREATE POLICY "Anyone can create their own emergency"
    ON emergencies FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users involved can update emergency status"
    ON emergencies FOR UPDATE
    USING (auth.uid() = user_id OR auth.uid() = caregiver_id)
    WITH CHECK (auth.uid() = user_id OR auth.uid() = caregiver_id);

-- Trigger for updated_at
CREATE TRIGGER update_emergencies_updated_at BEFORE UPDATE ON emergencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
