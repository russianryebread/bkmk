# Unified Items (bookmarks + notes → one model)

## Premise

Bookmarks and notes are the same thing with different provenance. A bookmark is
an item that came from a URL; a note is an item the user typed. Everything else
— markdown content, tags, favorites, search, sync, offline caching — is already
duplicated logic that has drifted apart.

**The rendering is already unified.** Both detail pages call the same
`useMarkdown().render()`. `pages/notes/[id].vue` renders `note.content`;
`pages/bookmarks/[id].vue` renders `bookmark.cleanedMarkdown`. What's duplicated
is everything around the renderer.

## Current duplication

| Concern | Bookmark | Note |
|---|---|---|
| Content column | `cleanedMarkdown` | `content` |
| Title | `title NOT NULL` | derived from first line via `deriveTitle()` |
| Editor | manual save button, `confirm()` on cancel | debounced auto-save + status indicator |
| Tables | `bookmarks`, `bookmark_tags` | `notes`, `notes_tags` |
| API | `/api/bookmarks/*` (6 endpoints) + `/api/scrape` | `/api/notes/*` (4 endpoints) |
| Sync push | `pushBookmarksBatch` | `pushNotesBatch` |
| Sync merge | `mergeBookmarks` | `mergeNotes` |
| IDB store | `bookmarks` | `notes` |
| Search | `/api/bookmarks/search` + `searchBookmarks()` | `/api/notes/search` + `searchNotes()` |
| List page | `pages/bookmarks/index.vue` (311 ln) | `pages/notes/index.vue` (309 ln) |
| Detail page | `pages/bookmarks/[id].vue` (376 ln) | `pages/notes/[id].vue` (424 ln) |
| Read state | `isRead`, `readAt`, `readingTimeMinutes`, `wordCount` | none |

The drift is clearest in the two detail pages: the notes page has auto-save and
a save-status indicator; the bookmarks page still has a manual save button and
unsaved-changes dialogs. Same job, two implementations.

## Target model

**`kind` is derived, never stored.** An item with a `url` is a bookmark; an item
without one is a note. Convert-to-link and "add a URL to this note" collapse
into the same trivial operation, and there is no type field to keep consistent.

```sql
items
  id            text pk
  user_id       text not null
  url           text     null      -- null = note, set = bookmark
  title         text     null      -- derived from first content line when null
  content       text not null      -- merges bookmarks.cleaned_markdown + notes.content
  original_html text     null      -- bookmark-only
  description   text     null
  source_domain text     null
  thumbnail_image_path text null
  is_favorite   integer default 0
  is_read       integer default 0
  read_at       timestamp null
  word_count    integer  null
  reading_time_minutes integer null
  sort_order    integer  null
  saved_at, last_accessed_at, created_at, updated_at, deleted_at

item_tags (id, item_id, tag_id)   -- merges bookmark_tags + notes_tags
```

### Why `title` is nullable

Editing a note's first line renames it, exactly as today. Scraped bookmarks
always have a real title. Derive on read via the existing `deriveTitle()`; store
a value only when the user explicitly renames. Making `title` NOT NULL would
force a rename step into note editing that doesn't exist today.

### Fields that become universal

`isRead` / `readAt` / `wordCount` apply to notes just as well as bookmarks
(`wordCount` is already computed client-side in both detail pages).
`readingTimeMinutes` stays bookmark-populated but is not type-restricted.

### `tags.type` retires

The `'bookmark' | 'note' | 'both'` distinction stops meaning anything. Treat all
tags as `both`, keep the column for one release so nothing breaks, then drop it
in a follow-up migration. `TagInput`'s `tag-type` prop and `TagSidebar`'s `mode`
prop both lose their type-filtering role.

## Phased plan

Each phase leaves the app shippable.

### Phase 1 — Schema + server adapters
- Drizzle migration `0014_*`: create `items`, `item_tags`; copy `bookmarks` →
  `items` (`cleaned_markdown` → `content`), `notes` → `items` (`title` null,
  `url` null); copy both junction tables into `item_tags`.
- New `/api/items` endpoints mirroring the existing shapes (index, `[id]`,
  `[id]/tags`, `batch`, `search`).
- **Rewrite `/api/bookmarks/*` and `/api/notes/*` as thin adapters over `items`.**
  Non-negotiable: `public/api.md` documents them and the iOS app calls them.
  Adapters translate field names (`content` ⟷ `cleanedMarkdown`) and filter on
  `url IS NOT NULL` / `IS NULL`.
- Keep the old tables in place, unread, until Phase 5. Do not drop them in the
  same release that starts writing to `items`.

### Phase 2 — Client model
- `composables/idb.ts`: `DB_VERSION` 3 → 4, new `items` store, `onupgradeneeded`
  merges the two local stores. Unified `Item` interface replaces `Bookmark` and
  `Note`.
- `stores/useDataStore.ts`: sync queue entity `'bookmark' | 'note'` → `'item'`.
  Collapses `pushBookmarksBatch`/`pushNotesBatch` into `pushItemsBatch`, and
  `mergeBookmarks`/`mergeNotes` into `mergeItems`. `searchBookmarks` and
  `searchNotes` become one `searchItems(query, filters)` where the
  bookmark/note split is just a `hasUrl` filter.

### Phase 3 — One detail page
`pages/items/[id].vue`, built from **the notes page's auto-save engine** plus
**the bookmarks page's metadata header**. Title, source domain, and reading time
render only when present, so a note simply shows fewer header rows.

Delete the manual-save path entirely — the auto-save engine in
`pages/notes/[id].vue` (debounce, flush-on-hide, flush-on-route-leave,
status indicator) is strictly better and already proven.

Content rendering is unchanged: one `.reader-content` block through
`useMarkdown().render()`, which is what both pages already do. Video embeds
(see `video-embeds.md`) mount here and work for notes and bookmarks alike.

`/bookmarks/:id` and `/notes/:id` redirect to `/items/:id`.

### Phase 4 — One list page
- `pages/items/index.vue` with an `All / Links / Notes` filter.
- One `ItemCard` / `ItemListItem` pair replacing `BookmarkCard` /
  `BookmarkListItem` and the inline note rows in `pages/notes/index.vue`.
  Domain and reading time render conditionally.
- `TagSidebar`'s `mode` prop becomes that filter rather than a type restriction.
- `/bookmarks` → `/items?has=link`, `/notes` → `/items?has=text`, so existing
  bookmarks-to-the-app and muscle memory survive.
- `GlobalSearch` drops its bookmark/note result branching.

### Phase 5 — Cleanup
Drop `bookmarks`, `notes`, `bookmark_tags`, `notes_tags`, and `tags.type` once
one release has run clean on `items`.

## Risks

- **Sync during migration.** A client on IDB v3 pushing to a v4 server, or vice
  versa. The server adapters cover the first case. Version the sync payload or
  force a full re-pull on the IDB upgrade rather than trying to merge across
  schema versions.
- **The `items` copy is not reversible** once clients start writing. Keep the
  old tables through Phase 5 as the rollback path.
- **`title` nullability** must be handled at every read site, not just the
  detail page — cards, search results, `<title>`, delete-confirmation dialogs.

---

# Quick Create (the `n` hotkey)

## The binding

**Cmd+N never reaches the page.** Chrome, Safari, and Firefox all consume it for
"new window" before `keydown` fires, and installed PWAs on macOS behave the same.
`preventDefault()` cannot reclaim it.

Bind bare **`n`** as the real shortcut — the Linear/GitHub/Gmail convention, and
consistent with the existing bare `/` in `composables/useSearchHotkey.ts`.
Register **Cmd/Ctrl+N alongside it as best-effort**, so it works in whatever
contexts do allow it. Guard both against firing inside `INPUT` / `TEXTAREA` /
`contenteditable`, exactly as `useSearchHotkey` does.

## The surface

`components/QuickCreate.vue`, mounted in `layouts/default.vue` as a sibling to
`GlobalSearch` (same open/close/expose pattern, same `Cmd+K`-style modal).

One text field. On submit:

| Input | Result |
|---|---|
| Whole trimmed input parses as a URL (`^https?://`, or bare `domain.tld/…`) | Bookmark — `/api/scrape` |
| Anything else | Note, with the typed text as the first line |
| Empty | Blank note |

A live `→ Bookmark` / `→ Note` chip shows the guess with a toggle to override,
so the auto-detection is never a surprise.

Match on the **whole** trimmed input, not "contains a URL" — a note that happens
to mention a link should stay a note.

## Consolidation

`GlobalSearch.vue` already has an `addAsBookmark` that saves the current search
query as a URL. That is the same feature; fold it into `QuickCreate`.

## Sequencing

Build this **after** the unification lands. Quick-create is the single entry
point the merged model implies — under the unified `items` API it is one call
with an optional `url`, rather than a branch between `/api/scrape` and
`createNote`. Building it first means building it twice.
