-- Adds email/password login as an alternative to Google OAuth, for
-- deploys/testing where OAuth setup isn't available. Safe to re-run.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
