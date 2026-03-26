# Bookmark App - Complete Planning Document

## Project Overview
A full-featured personal bookmarking application with offline reading, content extraction, markdown support, and multi-device sync. Built with Nuxt 4, SQLite, and Tailwind CSS.

---

## 1. ARCHITECTURE OVERVIEW

### Tech Stack
- **Frontend**: Nuxt 4 (Vue 3)
- **Styling**: Tailwind CSS
- **Database**: SQLite (with multi-device sync capability)
- **Backend**: Nuxt server routes / nitro
- **Content Extraction**: Server-side (Cheerio, Turndown, node-readability)
- **Image Handling**: Local file storage with database references
- **Search**: Full-text search via SQLite FTS5 module
- **Mobile**: Tailwind responsive design (mobile-friendly)

### Key Decisions
✅ Server-side content extraction (cleaner, more reliable)  
✅ Both HTML snapshot and markdown storage options  
✅ Images stored as files with database references  
✅ Full-text search + filtering/tags  
✅ Simple password check for secret notes (not encrypted at rest)  
✅ All three reading modes (user choice)  
✅ Plain markdown editor with live preview  
✅ Flat + hierarchical tags both supported  

---

## 2. DATA MODEL (SQLite Schema)

### Core Tables

#### `bookmarks`
```sql
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  
  -- Content storage
  original_html TEXT,              -- Full HTML snapshot
  cleaned_markdown TEXT,           -- Cleaned markdown version
  reading_time_minutes INTEGER,    -- Estimated reading time
  
  -- Metadata
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at DATETIME,
  
  -- Organization
  is_favorite BOOLEAN DEFAULT FALSE,
  sort_order INTEGER,              -- For custom ordering
  
  -- Image storage reference
  thumbnail_image_path TEXT,       -- Path to thumbnail
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at DATETIME,
  
  -- Additional fields
  source_domain TEXT,              -- Extracted from URL
  word_count INTEGER,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookmarks_created ON bookmarks(created_at DESC);
CREATE INDEX idx_bookmarks_is_favorite ON bookmarks(is_favorite);
CREATE INDEX idx_bookmarks_source_domain ON bookmarks(source_domain);
```

#### `bookmark_tags` (Junction table)
```sql
CREATE TABLE bookmark_tags (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  bookmark_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(bookmark_id, tag_id)
);

CREATE INDEX idx_bookmark_tags_bookmark ON bookmark_tags(bookmark_id);
CREATE INDEX idx_bookmark_tags_tag ON bookmark_tags(tag_id);
```

#### `tags`
```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  name TEXT NOT NULL UNIQUE,
  parent_tag_id TEXT,              -- For hierarchical tags
  color TEXT,                      -- Optional: hex color for UI
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_tag_id) REFERENCES tags(id) ON DELETE SET NULL
);

CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_parent ON tags(parent_tag_id);
```

#### `markdown_notes`
```sql
CREATE TABLE markdown_notes (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  title TEXT NOT NULL,
  content TEXT NOT NULL,           -- Plain markdown
  
  is_favorite BOOLEAN DEFAULT FALSE,
  sort_order INTEGER,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_markdown_notes_created ON markdown_notes(created_at DESC);
CREATE INDEX idx_markdown_notes_is_favorite ON markdown_notes(is_favorite);
```

#### `secret_notes`
```sql
CREATE TABLE secret_notes (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  title TEXT NOT NULL,
  content TEXT NOT NULL,           -- Encrypted or plain (see security notes)
  
  password_hash TEXT NOT NULL,     -- bcrypt hash of password
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at DATETIME
);

CREATE INDEX idx_secret_notes_created ON secret_notes(created_at DESC);
```

#### `bookmark_images`
```sql
CREATE TABLE bookmark_images (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  bookmark_id TEXT NOT NULL,
  file_path TEXT NOT NULL,         -- Relative path in storage
  alt_text TEXT,
  position_in_article INTEGER,     -- For ordering
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
);

CREATE INDEX idx_bookmark_images_bookmark ON bookmark_images(bookmark_id);
```

#### `sync_metadata` (For multi-device sync)
```sql
CREATE TABLE sync_metadata (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  entity_type TEXT NOT NULL,       -- 'bookmark', 'note', 'markdown_note', 'tag'
  entity_id TEXT NOT NULL,
  last_modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  sync_status TEXT DEFAULT 'pending',  -- 'pending', 'synced', 'conflict'
  
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX idx_sync_metadata_status ON sync_metadata(sync_status);
```

#### `fts_bookmarks` (Full-text search index)
```sql
CREATE VIRTUAL TABLE fts_bookmarks USING fts5(
  title,
  description,
  cleaned_markdown,
  content=bookmarks,
  content_rowid=id
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER fts_ai AFTER INSERT ON bookmarks BEGIN
  INSERT INTO fts_bookmarks(rowid, title, description, cleaned_markdown)
  VALUES (new.id, new.title, new.description, new.cleaned_markdown);
END;

CREATE TRIGGER fts_ad AFTER DELETE ON bookmarks BEGIN
  DELETE FROM fts_bookmarks WHERE rowid = old.id;
END;

CREATE TRIGGER fts_au AFTER UPDATE ON bookmarks BEGIN
  DELETE FROM fts_bookmarks WHERE rowid = old.id;
  INSERT INTO fts_bookmarks(rowid, title, description, cleaned_markdown)
  VALUES (new.id, new.title, new.description, new.cleaned_markdown);
END;
```

---

## 3. PROJECT STRUCTURE

```
bookmark-app/
├── server/
│   ├── api/
│   │   ├── bookmarks/
│   │   │   ├── index.ts          # GET (list with filters), POST (create)
│   │   │   ├── [id].ts           # GET (single), PUT (update), DELETE
│   │   │   ├── search.ts         # Full-text search endpoint
│   │   │   ├── [id]/tags.ts      # GET/POST tags for bookmark
│   │   │   └── [id]/images.ts    # GET/POST images
│   │   ├── scrape.ts             # POST - scrape URL, extract content
│   │   ├── tags/
│   │   │   ├── index.ts          # GET (all tags), POST (create)
│   │   │   ├── [id].ts           # PUT (update), DELETE
│   │   │   └── tree.ts           # GET hierarchical tag structure
│   │   ├── notes/
│   │   │   ├── markdown/
│   │   │   │   ├── index.ts      # GET, POST markdown notes
│   │   │   │   └── [id].ts       # GET, PUT, DELETE
│   │   │   └── secret/
│   │   │       ├── index.ts      # GET, POST secret notes
│   │   │       └── [id].ts       # GET, PUT, DELETE, verify-password
│   │   └── sync/
│   │       ├── pull.ts           # GET changes since last sync
│   │       └── push.ts           # POST local changes
│   ├── utils/
│   │   ├── db.ts                 # SQLite connection & initialization
│   │   ├── scraper.ts            # Web scraping logic (Cheerio, Turndown)
│   │   ├── readability.ts        # Content extraction
│   │   ├── image-processor.ts    # Download & save images
│   │   ├── search.ts             # Full-text search queries
│   │   └── crypto.ts             # Password hashing, encryption utils
│   ├── database/
│   │   └── schema.sql            # Full database schema (from section 2)
│   └── middleware/
│       └── auth.ts               # Request validation
├── app/
│   ├── components/
│   │   ├── BookmarkCard.vue       # Bookmark preview card
│   │   ├── BookmarkReader.vue     # Main reader component
│   │   │   ├── ReaderMode.vue     # Cleaned reader view
│   │   │   ├── SnapshotMode.vue   # Original HTML snapshot
│   │   │   └── MarkdownMode.vue   # Markdown view with renderer
│   │   ├── MarkdownRenderer.vue   # Markdown display component
│   │   ├── MarkdownEditor.vue     # Editor with live preview
│   │   ├── TagSelector.vue        # Multi-select tags (flat & hierarchical)
│   │   ├── SearchBar.vue          # Search input with autocomplete
│   │   ├── SortMenu.vue           # Sort options dropdown
│   │   ├── FilterPanel.vue        # Advanced filters sidebar
│   │   ├── SecretNotePassword.vue # Password input modal
│   │   └── SyncStatus.vue         # Multi-device sync indicator
│   ├── layouts/
│   │   ├── default.vue            # Main app layout
│   │   └── reader.vue             # Full-screen reading layout
│   ├── pages/
│   │   ├── index.vue              # Dashboard / bookmark list
│   │   ├── bookmarks/
│   │   │   └── [id].vue           # Single bookmark reader
│   │   ├── add.vue                # Add new bookmark (paste URL)
│   │   ├── notes.vue              # Markdown notes list
│   │   ├── notes/[id].vue         # Edit markdown note
│   │   ├── secrets.vue            # Secret notes list
│   │   ├── tags.vue               # Tag management
│   │   └── settings.vue           # App settings, sync config
│   ├── composables/
│   │   ├── useBookmarks.ts        # Bookmark CRUD & queries
│   │   ├── useTags.ts             # Tag management
│   │   ├── useSearch.ts           # Full-text search
│   │   ├── useSync.ts             # Multi-device sync logic
│   │   ├── useMarkdown.ts         # Markdown parsing & rendering
│   │   └── usePassword.ts         # Password validation
│   ├── stores/
│   │   ├── bookmarks.ts           # Pinia store for bookmarks
│   │   ├── ui.ts                  # UI state (modals, panels)
│   │   ├── sync.ts                # Sync state & progress
│   │   └── settings.ts            # User settings
│   ├── utils/
│   │   ├── markdown-renderer.ts   # Enhanced markdown rendering
│   │   ├── date-format.ts         # Date formatting utilities
│   │   └── reading-time.ts        # Calculate reading time
│   ├── app.vue
│   └── app.config.ts
├── public/
│   └── bookmarks/                 # Image storage directory
├── nuxt.config.ts
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## 4. CORE FEATURES & WORKFLOWS

### A. Bookmark Creation Workflow
1. User opens "Add Bookmark" page
2. Pastes URL into input
3. Frontend validates URL
4. POST to `/api/scrape` with URL
5. Backend:
   - Fetches page with Cheerio
   - Extracts main content with readability
   - Strips ads/tracking
   - Converts HTML to markdown with Turndown
   - Downloads + saves images locally
   - Calculates reading time
   - Extracts metadata (title, description, domain)
6. Backend stores in SQLite:
   - Original HTML in `original_html`
   - Cleaned markdown in `cleaned_markdown`
   - Image references in `bookmark_images`
   - Metadata in `bookmarks`
7. Frontend receives bookmark object, shows preview
8. User can add tags (flat or hierarchical), favorite, custom sort order
9. Bookmark saved

### B. Reading Modes
Three switchable views for each bookmark:

1. **Reader Mode** (default)
   - Cleaned markdown rendered to HTML
   - Optimized typography for reading
   - High contrast, large text
   - Images displayed inline
   - No distractions

2. **Snapshot Mode**
   - Original HTML snapshot displayed
   - Preserves original layout
   - May include ads (visible as reference)
   - iframe or embedded view

3. **Markdown Mode**
   - Raw markdown with syntax highlighting
   - Useful for reference/editing
   - Copy-to-clipboard support

### C. Search & Filtering
- **Full-text search**: Query title, description, markdown content via FTS5
- **Tag filtering**: Single or multiple tags (AND/OR logic)
- **Favorites only**: Toggle
- **Date range**: Saved between X and Y
- **Domain filter**: Show bookmarks from specific domains
- **Unread only**: Show unread bookmarks
- **Combine filters**: All work together

### D. Organization & Sorting
**Tags System:**
- Flat tags: Simple label system
- Hierarchical tags: Parent/child relationships (e.g., "Tech > JavaScript > React")
- Color coding optional
- Tag management page for CRUD

**Sorting:**
- Date saved (newest/oldest)
- Title (A-Z / Z-A)
- Favorited first (with secondary sort)
- Custom order (drag-and-drop to reorder)

### E. Markdown Notes
- Create arbitrary markdown notes (separate from bookmarks)
- Plain markdown editor with live preview
- Support for:
  - Headings, bold, italic, code blocks
  - Lists, blockquotes, links, images
  - Tables
- Full-text searchable
- Favoriteable
- Sortable by date or title

### G. Multi-Device Sync
**Sync Layer:**
- Changes tracked in `sync_metadata` table
- On sync:
  - Client pulls changes since last sync timestamp
  - Client pushes local changes with conflict resolution
  - Last-write-wins strategy for conflicts
  - Sync status tracked (pending, synced, conflict)

**Sync Backends (to choose):**
- **Option 1**: Dropbox API (simple file sync)
  - Sync database file periodically
  - Pull database, merge changes, push back
  
- **Option 2**: Custom backend (requires server)
  - POST local changes to server
  - GET changes from server
  - Server handles conflict resolution
  
- **Option 3**: iCloud CloudKit (Apple ecosystem)
  - Native CloudKit integration
  - Automatic sync across Apple devices

---

## 5. UI/UX LAYOUT

### Main Dashboard
```
┌─────────────────────────────────────────────────────────┐
│  Logo  Search Bar...      [+ Add]  [Settings] [Sync ●]  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Filters] [Sort ↓]  [Tags]  [Unread]                  │
│                                                           │
│  ┌─────────────────────┐  ┌─────────────────────┐      │
│  │ Bookmark Title      │  │ Bookmark Title      │      │
│  │ Domain • Date       │  │ Domain • Date       │      │
│  │ Brief description   │  │ Brief description   │      │
│  │ [Tags] ★ >         │  │ [Tags] ★ >         │      │
│  └─────────────────────┘  └─────────────────────┘      │
│                                                           │
│  ┌─────────────────────┐  ┌─────────────────────┐      │
│  │ Bookmark Title      │  │ Bookmark Title      │      │
│  │ Domain • Date       │  │ Domain • Date       │      │
│  │ Brief description   │  │ Brief description   │      │
│  │ [Tags] ★ >         │  │ [Tags] ★ >         │      │
│  └─────────────────────┘  └─────────────────────┘      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Bookmark Reader (Full-screen)
```
┌─────────────────────────────────────────────────────────┐
│ < Back  [Title]         [★] [Tag] [Read] [Share] [...]  │
├─────────────────────────────────────────────────────────┤
│ [Reader] [Snapshot] [Markdown] | Domain • Saved 2 days ago
├─────────────────────────────────────────────────────────┤
│                                                           │
│         ╔═══════════════════════════════════╗            │
│         ║  Article Title                    ║            │
│         ║                                   ║            │
│         ║  Main content rendered cleanly    ║            │
│         ║  Easy to read, optimized          ║            │
│         ║  typography for long-form reading ║            │
│         ║                                   ║            │
│         ║  [Image if present]               ║            │
│         ║                                   ║            │
│         ║  Continued content...             ║            │
│         ║                                   ║            │
│         ╚═══════════════════════════════════╝            │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Markdown Notes
```
┌─────────────────────────────────────────────────────────┐
│  Logo  [Notes] [Secrets] [Bookmarks] Settings   Sync ●  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [+ New Note]  [Sort ↓]  Search...                     │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Note Title                              [★] [Edit] │ │
│  │ 3 lines of preview...                              │ │
│  │ Created 5 days ago                                 │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Note Title                              [★] [Edit] │ │
│  │ 3 lines of preview...                              │ │
│  │ Created 2 days ago                                 │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Mobile View (Responsive)
- Stack all cards vertically
- Floating action button for "Add Bookmark"
- Collapsible filter/sort panels
- Full-width reader mode
- Bottom navigation for tabs

---

## 6. KEY LIBRARIES & DEPENDENCIES

### Core
```json
{
  "nuxt": "^4.0.0",
  "vue": "^3.4.0",
  "tailwindcss": "^3.4.0"
}
```

### Backend/Scraping
```json
{
  "better-sqlite3": "^9.2.0",       // SQLite driver
  "cheerio": "^1.0.0",               // HTML parsing
  "turndown": "^7.1.1",              // HTML to Markdown
  "@mozilla/readability": "^0.4.2",  // Content extraction
  "axios": "^1.6.0",                 // HTTP requests
  "bcryptjs": "^2.4.3"               // Password hashing
}
```

### Frontend
```json
{
  "pinia": "^2.1.0",                 // State management
  "markdown-it": "^13.1.0",          // Markdown parsing
  "@vueuse/core": "^10.7.0",         // Vue composables
  "fuse.js": "^7.0.0"                // Client-side search (optional)
}
```

---

## 7. SECURITY CONSIDERATIONS

### Password Protection (Secret Notes)
- Passwords hashed with bcryptjs (10+ rounds)
- Password stored in DB, content stored plainly
- For stronger security: encrypt content with password before storage
- Session-based: require password per session

### Image Storage
- Store in isolated directory (`/public/bookmarks/`)
- Sanitize filenames to prevent directory traversal
- Validate image types (JPEG, PNG, WebP, etc.)

### Content Scraping
- Validate URLs before scraping
- Set user-agent to avoid blocks
- Handle rate limiting gracefully
- Respect robots.txt (optional)

---

## 8. PERFORMANCE CONSIDERATIONS

### Database
- FTS5 indexes for fast full-text search
- Indexes on frequently queried columns
- Pragma optimizations:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA cache_size = -64000;
  ```

### Images
- Compress images on upload
- Store thumbnails separately for faster loading
- Lazy-load images in list views
- Responsive image sizes for mobile

### Markdown Rendering
- Memoize markdown parsing (cache parsed output)
- Use Vue's `<Suspense>` for loading states
- Virtual scrolling for long lists of bookmarks

### Search
- Debounce search input
- Lazy-load search results
- Use pagination for large result sets

---

## 10. TECHNICAL DECISIONS & TRADEOFFS

| Decision | Chosen | Alternative | Why |
|----------|--------|-------------|-----|
| Server-side scraping | ✅ | Client-side | More reliable, handles CORS, cleaner code |
| SQLite | ✅ | PostgreSQL | Local-first, no server needed, good for personal use |
| Image files | ✅ | Base64 in DB | Smaller DB, easier to manage, better performance |
| Plain password check | ✅ | Full encryption | Simple for personal use, sufficient security |
| All 3 reading modes | ✅ | Pick 1 | Flexibility, different use cases |
| FTS5 | ✅ | Client-side search | Faster, handles large datasets, better UX |
| Hierarchical + flat tags | ✅ | One or other | Flexibility, users choose what works |
| Pinia stores | ✅ | Composables only | Better for shared global state |
| Markdown-it | ✅ | showdown/marked | Better extensions, performance, active maintenance |

---


### Future Enhancements
- Browser extension for quick capture
- AI-powered summaries
- Automatic tagging suggestions
- Reading list with progress tracking
- Collaborative bookmarks with others
- Full-text search on images (OCR)
- Annotation & highlighting system

---

## 12. GETTING STARTED CHECKLIST

Before coding begins:
- [ ] Create SQLite schema
- [ ] Set up server routes structure
- [ ] Test scraping libraries (Cheerio, Readability)
- [ ] Design component hierarchy
- [ ] Set up Pinia stores
- [ ] Create markdown renderer component
- [ ] Plan image storage directory structure
- [ ] Set up development database

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-25  
**Status:** Ready for Development