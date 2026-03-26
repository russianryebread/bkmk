-- Bookmark App Database Schema

-- Enable extensions
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;

-- Core Bookmarks Table
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  
  -- Content storage
  original_html TEXT,
  cleaned_markdown TEXT,
  reading_time_minutes INTEGER,
  
  -- Metadata
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at DATETIME,
  
  -- Organization
  is_favorite INTEGER DEFAULT 0,
  sort_order INTEGER,
  
  -- Image storage reference
  thumbnail_image_path TEXT,
  
  -- Status
  is_read INTEGER DEFAULT 0,
  read_at DATETIME,
  
  -- Additional fields
  source_domain TEXT,
  word_count INTEGER,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_favorite ON bookmarks(is_favorite);
CREATE INDEX IF NOT EXISTS idx_bookmarks_source_domain ON bookmarks(source_domain);
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_read ON bookmarks(is_read);

-- Tags Table
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL UNIQUE,
  parent_tag_id TEXT,
  color TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_tag_id) REFERENCES tags(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_parent ON tags(parent_tag_id);

-- Bookmark Tags Junction Table
CREATE TABLE IF NOT EXISTS bookmark_tags (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  bookmark_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(bookmark_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmark_tags_bookmark ON bookmark_tags(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id);

-- Markdown Notes Table
CREATE TABLE IF NOT EXISTS markdown_notes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '',
  
  is_favorite INTEGER DEFAULT 0,
  sort_order INTEGER,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_markdown_notes_created ON markdown_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_markdown_notes_is_favorite ON markdown_notes(is_favorite);

-- Secret Notes Table
CREATE TABLE IF NOT EXISTS secret_notes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  
  password_hash TEXT NOT NULL,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_secret_notes_created ON secret_notes(created_at DESC);

-- Bookmark Images Table
CREATE TABLE IF NOT EXISTS bookmark_images (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  bookmark_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  alt_text TEXT,
  position_in_article INTEGER,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookmark_images_bookmark ON bookmark_images(bookmark_id);

-- Sync Metadata Table
CREATE TABLE IF NOT EXISTS sync_metadata (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  last_modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_deleted INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending',
  
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_metadata_status ON sync_metadata(sync_status);

-- Full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS fts_bookmarks USING fts5(
  title,
  description,
  cleaned_markdown,
  content=bookmarks,
  content_rowid=id
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS fts_ai AFTER INSERT ON bookmarks BEGIN
  INSERT INTO fts_bookmarks(rowid, title, description, cleaned_markdown)
  VALUES (new.rowid, new.title, new.description, new.cleaned_markdown);
END;

CREATE TRIGGER IF NOT EXISTS fts_ad AFTER DELETE ON bookmarks BEGIN
  DELETE FROM fts_bookmarks WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS fts_au AFTER UPDATE ON bookmarks BEGIN
  DELETE FROM fts_bookmarks WHERE rowid = old.rowid;
  INSERT INTO fts_bookmarks(rowid, title, description, cleaned_markdown)
  VALUES (new.rowid, new.title, new.description, new.cleaned_markdown);
END;
