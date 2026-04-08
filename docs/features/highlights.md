# Highlight & Notes Feature for Bookmarks

## Overview
Add the ability to highlight text and attach notes to saved bookmark content, enhancing personal annotation capabilities.

---

## 1. Database Schema Changes

### New Table: `highlights`
```sql
CREATE TABLE highlights (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  
  -- Selection data
  selected_text TEXT NOT NULL,
  start_offset INTEGER NOT NULL,      -- Character position in content
  end_offset INTEGER NOT NULL,
  
  -- Styling
  color TEXT DEFAULT '#ffeb3b',        -- Yellow, pink, green, blue options
  
  -- Optional note attached to highlight
  note TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_highlights_bookmark ON highlights(bookmark_id);
CREATE INDEX idx_highlights_user ON highlights(user_id);
```

### New Table: `bookmark_notes`
```sql
CREATE TABLE bookmark_notes (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  
  content TEXT NOT NULL,               -- Markdown content
  is_favorite INTEGER DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookmark_notes_bookmark ON bookmark_notes(bookmark_id);
CREATE INDEX idx_bookmark_notes_user ON bookmark_notes(user_id);
```

### FTS Updates
Add `highlight_id` references to FTS triggers for searching within highlights.

---

## 2. API Endpoints

### Highlights API
- `POST /api/bookmarks/[id]/highlights` - Create highlight
- `GET /api/bookmarks/[id]/highlights` - List all highlights for bookmark
- `PATCH /api/highlights/[id]` - Update highlight (color, note)
- `DELETE /api/highlights/[id]` - Delete highlight

### Bookmark Notes API
- `POST /api/bookmarks/[id]/notes` - Create note for bookmark
- `GET /api/bookmarks/[id]/notes` - List notes for bookmark
- `PUT /api/notes/[id]` - Update note
- `DELETE /api/notes/[id]` - Delete note

---

## 3. UI Components

### Reader View Enhancements
1. **Text Selection Popover** - Appears on text selection with:
   - Highlight color picker (4-5 color options)
   - "Add Note" button
   - Quick highlight button

2. **Highlight Rendering**
   - Background color on highlighted text spans
   - Click highlight to show popover (edit/delete/add note)
   - Tooltip showing note preview on hover

3. **Notes Panel**
   - Collapsible panel in reader view
   - List of all notes for bookmark
   - Each note shows: creation date, preview, link to highlight (if attached)
   - Edit/delete actions per note

4. **Floating Action Button**
   - "Notes" button in toolbar to toggle notes panel

---

## 4. Implementation Steps

### Phase 1: Database & API
- [ ] Create database migration
- [ ] Add Drizzle schema definitions
- [ ] Implement highlights API routes
- [ ] Implement bookmark notes API routes

### Phase 2: Offline Support
- [ ] Add IndexedDB stores for highlights and notes
- [ ] Add composables for offline CRUD operations
- [ ] Implement sync logic

### Phase 3: Frontend Components
- [ ] Create `HighlightPopover.vue` - selection popup
- [ ] Create `HighlightSpan.vue` - rendered highlight
- [ ] Create `NotesPanel.vue` - sidebar panel
- [ ] Integrate into `pages/bookmarks/[id].vue`

### Phase 4: UX Polish
- [ ] Add keyboard shortcuts (e.g., Ctrl+H to highlight)
- [ ] Highlight count badge on toolbar
- [ ] Export highlights/notes functionality

---

## 5. Technical Considerations

### Text Selection Tracking
- Use `window.getSelection()` to capture selected text
- Store character offsets relative to the content
- Handle content updates that might shift offsets

### Content Versioning
- Store content snapshot version when highlighting
- Warn user if content has changed significantly
- Option to remap highlights after content updates

### Performance
- Lazy load highlights for long content
- Virtualize highlight rendering for performance
- Debounce selection handling

---

## Open Questions

1. **Note Types**: Should notes be:
   - A) Only attached to specific highlights?
   - B) Standalone notes for the entire bookmark (like sticky notes)?
   - C) Both?

2. **Highlight Colors**: Which color palette do you prefer?
   - Yellow (#ffeb3b), Pink (#f48fb1), Green (#a5d6a7), Blue (#90caf9)
   - Or custom user-selectable colors?

3. **Export**: Do you want the ability to export highlights as markdown/PDF?

4. **Sync Priority**: Should highlights sync immediately or batch with other changes?
