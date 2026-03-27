-- Migration: Rename markdown_notes to notes, secret_notes to secrets, create junction tables
-- Run this to rename tables and create new tag junction tables

-- Step 1: Rename markdown_notes to notes, remove tags column
ALTER TABLE markdown_notes RENAME TO notes;
DROP INDEX IF EXISTS idx_markdown_notes_user;
DROP INDEX IF EXISTS idx_markdown_notes_created;
DROP INDEX IF EXISTS idx_markdown_notes_is_favorite;

-- Recreate indexes with new name
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_is_favorite ON notes(is_favorite);

-- Step 2: Rename secret_notes to secrets
ALTER TABLE secret_notes RENAME TO secrets;
DROP INDEX IF EXISTS idx_secret_notes_user;
DROP INDEX IF EXISTS idx_secret_notes_created;

-- Recreate indexes with new name
CREATE INDEX IF NOT EXISTS idx_secrets_user ON secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_secrets_created ON secrets(created_at DESC);

-- Step 3: Create notes_tags junction table
CREATE TABLE IF NOT EXISTS notes_tags (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  note_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(note_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_notes_tags_note ON notes_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_notes_tags_tag ON notes_tags(tag_id);

-- Step 4: Create secrets_tags junction table
CREATE TABLE IF NOT EXISTS secrets_tags (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  secret_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  FOREIGN KEY (secret_id) REFERENCES secrets(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(secret_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_secrets_tags_secret ON secrets_tags(secret_id);
CREATE INDEX IF NOT EXISTS idx_secrets_tags_tag ON secrets_tags(tag_id);

-- Step 5: Migrate existing tags from notes to notes_tags junction table
-- This assumes tags column contains comma-separated tag names
-- You'll need to manually run this for each user or create a script
-- Example for a specific user:
-- INSERT INTO notes_tags (id, note_id, tag_id)
-- SELECT lower(hex(randomblob(16))), n.id, t.id
-- FROM notes n
-- JOIN tags t ON ',' || n.tags || ',' LIKE '%,' || t.name || ',%'
-- WHERE n.user_id = 'USER_ID_HERE';