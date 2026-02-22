-- Reviews table: care recipients rate caregivers after completed bookings.
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, rater_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_caregiver ON reviews(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews(booking_id);

-- Update caregiver_profile.avg_rating and total_reviews when a review is added/updated/deleted.
CREATE OR REPLACE FUNCTION update_caregiver_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE caregiver_profile
  SET
    avg_rating = (
      SELECT COALESCE(ROUND((AVG(rating))::numeric, 2), 0)
      FROM reviews
      WHERE reviews.caregiver_id = COALESCE(NEW.caregiver_id, OLD.caregiver_id)
    ),
    total_reviews = (
      SELECT COUNT(*)::integer
      FROM reviews
      WHERE reviews.caregiver_id = COALESCE(NEW.caregiver_id, OLD.caregiver_id)
    ),
    updated_at = NOW()
  WHERE user_id = COALESCE(NEW.caregiver_id, OLD.caregiver_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_caregiver_rating_on_review ON reviews;
CREATE TRIGGER update_caregiver_rating_on_review
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_caregiver_rating();

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create reviews for their own bookings" ON reviews;
CREATE POLICY "Users can create reviews for their own bookings"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = rater_id
    AND EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_id
        AND bookings.care_recipient_id = auth.uid()
        AND bookings.status = 'completed'
    )
  );
