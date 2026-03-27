-- Migration: Add images table, drop bookmark_images table
-- Run this after updating your schema

-- Drop the old bookmark_images table if it exists
DROP TABLE IF EXISTS bookmark_images CASCADE;

-- Create the new images table
CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    size_bytes INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_images_bookmark ON images(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_images_original_url ON images(original_url);
