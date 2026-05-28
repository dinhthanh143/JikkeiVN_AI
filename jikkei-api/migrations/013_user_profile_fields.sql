-- Migration 013: Add profile fields to users table
-- display_name: shown prominently on profile, separate from username handle
-- bio: short freeform description, capped at 300 chars in app logic (not DB)
-- date_of_birth: stored as date, displayed as age or birth year only (never raw DOB)
-- profile_banner: Cloudinary URL for the profile banner image

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name   VARCHAR(100)  NULL,
  ADD COLUMN IF NOT EXISTS bio            TEXT          NULL,
  ADD COLUMN IF NOT EXISTS date_of_birth  DATE          NULL,
  ADD COLUMN IF NOT EXISTS profile_banner VARCHAR(500)  NULL;
