# Video Embeds (YouTube, Vimeo)

## Problem

Video bookmarks render as a placeholder link. Nothing embeds, and the failure is
layered — fixing any one of these alone changes nothing.

1. **No embed is ever produced.** `server/api/scrape.ts` detects a video URL and
   writes the literal string `[Add content for <platform> video](<url>)` into
   `cleanedMarkdown`. The oEmbed call fetches `title` and `author_name` and
   **discards `thumbnail_url`**.
2. **The sanitizer strips iframes.** `composables/useMarkdown.ts` — DOMPurify's
   default allowlist has no `iframe`; `ADD_TAGS` only adds `img`.
3. **CSP blocks third-party frames.** `server/middleware/security-headers.ts` —
   `default-src 'self'` with no `frame-src` directive.

`X-Frame-Options: DENY` and `frame-ancestors 'none'` are inbound-only and are
not part of the problem. Leave them alone.

### Separate bug in the same file

`VIDEO_PATTERNS` in `server/api/scrape.ts` includes bare `/twitter\.com\//`,
`/x\.com\//`, `/tiktok\.com\//` and `/instagram\.com\/(?:p|reel|tv)\//`. Every
tweet and every Instagram post currently short-circuits into the video branch:
placeholder content, no scrape, no reader view. Fix in the same pass.

## Approach: click-to-play facade, no iframes in the database

Store the video's identity, not its markup. Render a thumbnail with a play
button; inject the real `<iframe>` only when the user clicks it.

This keeps stored content portable (the player can change later), keeps the
sanitizer's iframe allowlist empty, loads no third-party frame until asked, and
degrades correctly offline to a cached thumbnail plus a link.

## Status: implemented

Shipped as described below, with two deviations from the original plan, both
noted inline:
- The click-to-play behaviour is a composable (`useVideoEmbeds`) with one
  delegated listener, not a `VideoEmbed.vue` component — content is rendered
  through `v-html`, so there is no node for Vue to mount into.
- Offline poster availability needed a workbox `runtimeCaching` rule; the
  precache `globPatterns` only cover build assets, not `/api/images/*`.

## Work

### 1. Capture real metadata at scrape time
`server/api/scrape.ts`

- Keep `thumbnail_url` from the oEmbed response and run it through the existing
  `processAndStoreImage` pipeline into the `images` table, setting
  `thumbnailImagePath`. This keeps `img-src 'self'` unchanged and makes
  thumbnails work offline.
- Stop writing the `[Add content for …]` placeholder. Write either empty content
  or the video description.
- Narrow `VIDEO_PATTERNS` to actual video paths so tweets and IG posts fall
  through to the normal scraper.

### 2. Render the placeholder, not the frame
`composables/useMarkdown.ts` + `composables/useVideoEmbeds.ts`

- A markdown-it core rule (`video_embed`) replaces any paragraph whose entire
  content is a link to a supported video with an inert
  `<div class="video-embed" data-video-embed="…">`. Inert markup passes the
  sanitizer untouched. Two shapes are recognized: a bare (linkified) URL, which
  covers a user pasting a link into a note, and a thumbnail wrapped in a link,
  which is what the scraper writes.
- `useVideoEmbeds(containerRef)` attaches **one delegated click listener** to
  the reader container and builds the `<iframe>` via the DOM API on click.
  Content is rendered through `v-html`, so there is no node for Vue to mount a
  component into — a component would mean manual `createApp` calls per node,
  and the listener is both simpler and survives re-renders.
- The sanitizer config does **not** change. No `iframe` in `ADD_TAGS`.
- The placeholder's `<a>` is a real link to the original video, so the
  pre-hydration and no-JS states both work, and modified clicks (cmd/ctrl/middle)
  fall through to normal open-in-new-tab.

### 3. Open the CSP narrowly
`server/middleware/security-headers.ts`

Add exactly one directive:

    frame-src https://www.youtube-nocookie.com https://player.vimeo.com

`img-src` stays `'self' data: blob:` because thumbnails are proxied through the
`images` table rather than hotlinked from `i.ytimg.com`.

### 4. Offline posters
`nuxt.config.ts` — the workbox precache `globPatterns` only covers build assets,
so `/api/images/*` needed a `runtimeCaching` entry. `CacheFirst` is safe because
stored images are addressed by a generated UUID and never rewritten.

### 5. Backfill
Two parts, because SQL cannot call oEmbed:
- Migration `0014_lucky_video_embeds.sql` rewrites every row still holding the
  `[Add content for … video](…)` placeholder to the bookmark's own URL, which
  the renderer turns into a (posterless) player.
- `bun run backfill:video-posters` then fetches and stores the missing posters.
  Safe to re-run: it only touches video bookmarks with no thumbnail, and
  `processAndStoreImage()` dedupes by original URL.

## Verification performed

- **URL parsing**, 20 cases: watch / `youtu.be` / Shorts / `/live/` / `m.` and
  `music.` subdomains / Vimeo / `player.vimeo.com` all resolve; and
  `evilyoutube.com`, a `youtube.com` URL embedded in another site's query
  string, `/@channel`, a short ID, tweets, IG posts, TikToks, and
  `javascript:` all correctly do not.
- **Markdown rendering**, 10 cases: both embed shapes produce a player; a URL
  inline in a sentence and a non-video link do not; a raw `<iframe>` in content
  is stripped; an XSS payload in the link label is escaped.
- **CSP**: `frame-src` confirmed on the live response header.
- **Playback**: injected the real rendered markup into the running app, clicked
  through, and confirmed both a YouTube and a Vimeo player load cross-origin,
  fill their 16:9 container, and that the guard prevents a double swap.
- **oEmbed** contract checked against the live YouTube and Vimeo APIs,
  including that the returned thumbnail URL is fetchable.
- `nuxi typecheck` clean; `drizzle-kit check` clean.

### Not yet verified
The end-to-end `/api/scrape` video path — it needs an authenticated session and
a database write, so it wants a manual pass: save a YouTube URL and confirm the
bookmark gets a real title, a stored poster, and a working player.

## Note on unification

`VideoEmbed` should live in the shared item renderer, not the bookmark page —
see `unified-items.md`. Once items are unified, a note containing a YouTube link
embeds it the same way a bookmark does, for free.
