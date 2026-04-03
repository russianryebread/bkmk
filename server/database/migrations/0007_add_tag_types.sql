-- Add type column to tags table
ALTER TABLE tags ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'both';
ALTER TABLE tags ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS icon VARCHAR(50);

-- Create index for type filtering
CREATE INDEX IF NOT EXISTS idx_tags_type ON tags(type);
