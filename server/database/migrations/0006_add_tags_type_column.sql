-- Add type column to tags table to support filtering by entity type
ALTER TABLE tags ADD COLUMN type TEXT DEFAULT 'all' CHECK (type IN ('all', 'bookmark', 'note', 'secret'));

-- Create index for type column
CREATE INDEX idx_tags_type ON tags(type);
