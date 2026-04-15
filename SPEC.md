# bkmk - Complete Planning Document

## Project Overview
A full-featured personal bookmarking application with offline reading, content extraction, markdown support, and multi-device sync. Built with Nuxt 4, SQLite, and Tailwind CSS.

---

## 1. ARCHITECTURE OVERVIEW

### Tech Stack
- **Frontend**: Nuxt 4 (Vue 3)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (with multi-device sync capability)
- **Backend**: Nuxt server routes / nitro
- **Content Extraction**: Server-side (Cheerio, Turndown, node-readability)
- **Image Handling**: Local file storage with database references
- **Search**: Full-text search via PostgreSQL full-text search
- **Mobile**: Tailwind responsive design (mobile-friendly)

### Key Decisions
✅ Server-side content extraction (cleaner, more reliable)  
✅ Both HTML snapshot and markdown storage options  
✅ Images stored as files with database references  
✅ Full-text search + filtering/tags  
✅ All three reading modes (user choice)  
✅ Plain markdown editor with live preview  
✅ Flat + hierarchical tags both supported  

---

## 2. DATA MODEL (PostgreSQL Schema)

### Core Tables

#### `users`
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT, -- Nullable for OAuth users
  role TEXT NOT NULL DEFAULT 'user', -- 'user' or 'admin'
  avatar_url TEXT,
  password_reset_token TEXT,
  password_reset_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created ON users(created_at);
```

#### `user_accounts` (OAuth providers)
```sql
CREATE TABLE user_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_user_accounts_user ON user_accounts(user_id);
```

#### `bookmarks`
```sql
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  
  -- Content storage
  original_html TEXT,
  cleaned_markdown TEXT,
  reading_time_minutes INTEGER,
  
  -- Metadata
  saved_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP,
  
  -- Organization
  is_favorite INTEGER DEFAULT 0,
  sort_order INTEGER,
  
  -- Image storage reference
  thumbnail_image_path TEXT,
  
  -- Status
  is_read INTEGER DEFAULT 0,
  read_at TIMESTAMP,
  
  -- Additional fields
  source_domain TEXT,
  word_count INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_created ON bookmarks(created_at);
CREATE INDEX idx_bookmarks_is_favorite ON bookmarks(is_favorite);
CREATE INDEX idx_bookmarks_source_domain ON bookmarks(source_domain);
CREATE INDEX idx_bookmarks_is_read ON bookmarks(is_read);
```

#### `tags`
```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  parent_tag_id TEXT,
  color TEXT,
  type TEXT DEFAULT 'both', -- 'bookmark' | 'note' | 'both'
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tags_user ON tags(user_id);
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_parent ON tags(parent_tag_id);
CREATE INDEX idx_tags_type ON tags(type);
CREATE UNIQUE INDEX idx_tags_user_name ON tags(user_id, name);
```

#### `bookmark_tags` (Junction table)
```sql
CREATE TABLE bookmark_tags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_bookmark_tags_bookmark ON bookmark_tags(bookmark_id);
CREATE INDEX idx_bookmark_tags_tag ON bookmark_tags(tag_id);
CREATE UNIQUE INDEX idx_bookmark_tags_unique ON bookmark_tags(bookmark_id, tag_id);
```

#### `notes`
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  
  is_favorite INTEGER DEFAULT 0,
  sort_order INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_created ON notes(created_at);
CREATE INDEX idx_notes_is_favorite ON notes(is_favorite);
```

#### `notes_tags` (Junction table)
```sql
CREATE TABLE notes_tags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_tags_note ON notes_tags(note_id);
CREATE INDEX idx_notes_tags_tag ON notes_tags(tag_id);
CREATE UNIQUE INDEX idx_notes_tags_unique ON notes_tags(note_id, tag_id);
```

#### `images` (for bookmarks)
```sql
CREATE TABLE images (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER NOT NULL,
  data TEXT NOT NULL, -- Base64 encoded
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_images_bookmark ON images(bookmark_id);
CREATE INDEX idx_images_original_url ON images(original_url);
```

#### `api_tokens`
```sql
CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX idx_api_tokens_active ON api_tokens(is_active);
```

#### `sync_metadata`
```sql
CREATE TABLE sync_metadata (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  last_modified_at TIMESTAMP DEFAULT NOW(),
  is_deleted INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending',
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX idx_sync_metadata_status ON sync_metadata(sync_status);
```

---

## 3. PROJECT STRUCTURE

```
bkmk/
├── server/
│   ├── api/
│   │   ├── admin/
│   │   │   └── users.get.ts
│   │   ├── auth/
│   │   │   ├── [provider].ts
│   │   │   ├── change-password.post.ts
│   │   │   ├── login.post.ts
│   │   │   ├── logout.post.ts
│   │   │   ├── me.get.ts
│   │   │   ├── reset-password.post.ts
│   │   │   └── reset-request.post.ts
│   │   ├── bookmarks/
│   │   │   ├── index.ts
│   │   │   ├── [id].ts
│   │   │   └── search.ts
│   │   ├── notes/
│   │   │   ├── markdown/
│   │   │   │   ├── index.ts
│   │   │   │   └── [id].ts
│   │   │   └── search.ts
│   │   ├── tags/
│   │   │   ├── index.ts
│   │   │   ├── [id].ts
│   │   │   └── tree.ts
│   │   ├── tokens/
│   │   │   ├── index.ts
│   │   │   └── [id].ts
│   │   ├── scrape.ts
│   │   ├── stats.ts
│   │   └── version.get.ts
│   ├── database/
│   │   ├── index.ts
│   │   └── schema.ts
│   ├── middleware/
│   │   └── cors.ts
│   ├── plugins/
│   ├── utils/
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   ├── images.ts
│   │   ├── scraper.ts
│   │   ├── transform.ts
│   │   └── url-cleaner.ts
│   └── middleware/
├── pages/
│   ├── index.vue
│   ├── login.vue
│   ├── signup.vue
│   ├── forgot-password.vue
│   ├── reset-password.vue
│   ├── profile.vue
│   ├── docs.vue
│   ├── change-password.vue
│   ├── tags.vue
│   ├── tokens.vue
│   ├── bookmarks/
│   │   ├── index.vue
│   │   └── [id].vue
│   ├── notes/
│   │   ├── index.vue
│   │   └── [id].vue
│   └── admin/
│       └── users.vue
├── components/
│   ├── ActionButton.vue
│   ├── GlobalSearch.vue
│   ├── InfiniteItemList.vue
│   ├── OfflineIndicator.vue
│   ├── SearchInput.vue
│   ├── StickyToolbar.vue
│   ├── TagFilter.vue
│   ├── TagInput.vue
│   └── ViewToggle.vue
├── composables/
│   ├── idb.ts
│   ├── useAuth.ts
│   ├── useBookmarks.ts
│   ├── useDarkMode.ts
│   ├── useInfiniteScroll.ts
│   ├── useMarkdown.ts
│   ├── useOfflineBookmarks.ts
│   ├── useOfflineNotes.ts
│   ├── useReaderSettings.ts
│   ├── useSearch.ts
│   ├── useSync.ts
│   ├── useTagSystem.ts
│   └── useViewMode.ts
├── layouts/
│   ├── default.vue
│   └── reader.vue
├── middleware/
│   └── auth.ts
├── plugins/
│   └── auth-401.ts
├── public/
│   ├── api.md
│   ├── manifest.json
│   └── sw.js
├── assets/
├── docs/
├── ios-share-extension/
├── utils/
├── app.vue
├── nuxt.config.ts
├── tailwind.config.ts
├── drizzle.config.ts
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
6. Backend stores in database:
   - Original HTML in `original_html`
   - Cleaned markdown in `cleaned_markdown`
   - Image references in `images`
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
- **Full-text search**: Query title, description, markdown content
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

### F. Profile & Settings
- **Profile Page**: Central hub for user settings
  - View account email and role
  - Access API tokens management
  - Change password
  - Manage tags
  - Admin controls (for admins)
- **API Tokens**: Create, manage, revoke tokens for external integrations

### G. Multi-Device Sync
**Sync Layer:**
- Changes tracked in `sync_metadata` table
- On sync:
  - Client pulls changes since last sync timestamp
  - Client pushes local changes with conflict resolution
  - Last-write-wins strategy for conflicts
  - Sync status tracked (pending, synced, conflict)

---

## 5. UI/UX LAYOUT

### Main Dashboard
```
┌─────────────────────────────────────────────────────────┐
│  Logo  Search Bar...      [+ Add]  [Email] [⚙]          │
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
└─────────────────────────────────────────────────────────┘
```

### Desktop Header
- Logo + App name (links to home)
- Search bar (global search)
- Desktop nav: Bookmarks, Notes
- User email (clickable to profile)
- Settings dropdown (gear icon)

### Mobile Header
- Logo + App name
- Mobile menu button (hamburger)

### Mobile Menu (hamburger → gear menu)
- Profile link
- Bookmarks
- Notes
- Manage Tags
- API Tokens
- Change Password
- Dark Mode toggle
- Manage Users (admin only)
- API Documentation
- Sign Out

### Mobile Bottom Toolbar
- Bookmarks icon (link to /bookmarks)
- Notes icon (link to /notes)
- Search icon (opens global search)

### Profile Page
```
┌─────────────────────────────────────────┐
│  [Avatar]  user@email.com              │
│             Role: user                  │
├─────────────────────────────────────────┤
│  [📋] Manage Tags                      │
│       Create and organize your tags     │
├─────────────────────────────────────────┤
│  [🔑] API Tokens                       │
│       Manage tokens for integrations    │
├─────────────────────────────────────────┤
│  [🔒] Change Password                  │
│       Update your account password      │
├─────────────────────────────────────────┤
│  [📚] API Documentation                 │
│       View API reference                │
├─────────────────────────────────────────┤
│  [🚪] Sign Out                         │
└─────────────────────────────────────────┘
```

### Mobile View (Responsive)
- Stack all cards vertically
- Floating action button for "Add Bookmark"
- Collapsible filter/sort panels
- Full-width reader mode
- Bottom navigation toolbar

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
  "drizzle-orm": "^0.29.0",
  "postgres": "^3.4.0",
  "cheerio": "^1.0.0",
  "turndown": "^7.1.1",
  "@mozilla/readability": "^0.4.2",
  "axios": "^1.6.0",
  "bcryptjs": "^2.4.3"
}
```

### Frontend
```json
{
  "@vueuse/core": "^10.7.0",
  "marked": "^11.0.0",
  "dompurify": "^3.0.0"
}
```

---

## 7. SECURITY CONSIDERATIONS

### User Authentication
- Password hashing with bcryptjs
- OAuth provider support (GitHub, Google, etc.)
- JWT-based session management
- Password reset via email tokens

### API Security
- Token-based API authentication for external integrations
- Tokens are hashed before storage
- Token prefix for identification without exposing full token

### Image Storage
- Store in isolated directory
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
- Indexes on frequently queried columns
- Pagination for large result sets
- Efficient full-text search

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

## 9. TECHNICAL DECISIONS & TRADEOFFS

| Decision | Chosen | Alternative | Why |
|----------|--------|-------------|-----|
| Server-side scraping | ✅ | Client-side | More reliable, handles CORS, cleaner code |
| PostgreSQL | ✅ | SQLite | Better for production, easier deployment |
| Image files | ✅ | Base64 in DB | Smaller DB, easier to manage, better performance |
| All 3 reading modes | ✅ | Pick 1 | Flexibility, different use cases |
| Hierarchical + flat tags | ✅ | One or other | Flexibility, users choose what works |
| Composables | ✅ | Pinia stores | Simpler, Vue 3 native |
| Marked + DOMPurify | ✅ | markdown-it | Lighter weight, good security |

---

## 10. FUTURE ENHANCEMENTS

- Browser extension for quick capture
- AI-powered summaries
- Automatic tagging suggestions
- Reading list with progress tracking
- Collaborative bookmarks with others
- Full-text search on images (OCR)
- Annotation & highlighting system

---

**Document Version:** 2.0  
**Last Updated:** 2026-04-08  
**Status:** Ready for Development
