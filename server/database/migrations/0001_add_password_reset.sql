-- Add password reset fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expiry TIMESTAMP;
