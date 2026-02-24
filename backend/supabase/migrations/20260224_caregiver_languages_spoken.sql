-- Add languages_spoken to caregiver_profile - PRD: Languages spoken in caregiver profile
ALTER TABLE caregiver_profile
ADD COLUMN IF NOT EXISTS languages_spoken TEXT[] DEFAULT '{}';
