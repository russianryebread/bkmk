-- Data migration (no schema change).
--
-- The old video branch in /api/scrape wrote a literal placeholder,
-- `[Add content for <platform> video](<url>)`, as the bookmark's content. That
-- text was never meant to be read — it stood in for an embed that was never
-- implemented.
--
-- Replace it with the bookmark's own URL. For YouTube and Vimeo the markdown
-- renderer now turns a bare video URL into a click-to-play player; for the
-- platforms we can't embed it renders as an ordinary link, which is still an
-- improvement on the placeholder.
--
-- Posters are not backfilled here (SQL can't call oEmbed). Run
-- `bun run scripts/backfill-video-posters.ts` afterwards to fetch them.
UPDATE "bookmarks"
SET "cleaned_markdown" = "url",
    "updated_at" = now()
WHERE "cleaned_markdown" LIKE '[Add content for % video](%'
  AND "deleted_at" IS NULL;
