import { and, eq } from "drizzle-orm";
import { db } from "~/server/database";
import { bookmarks, bookmarkTags } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";
import { resolveTagIdsBatch } from "~/server/utils/tags";

// Caps on a single batch request.
const MAX_BATCH_ITEMS = 500;
const MAX_TITLE_LENGTH = 1_000;
const MAX_URL_LENGTH = 2_048;
const MAX_DESCRIPTION_LENGTH = 10_000;
const MAX_CLEANED_MARKDOWN_LENGTH = 5_000_000;

function assertBookmarkLengths(b: any) {
  if (typeof b?.title === "string" && b.title.length > MAX_TITLE_LENGTH) {
    throw createError({ statusCode: 400, message: `title exceeds ${MAX_TITLE_LENGTH} characters` });
  }
  if (typeof b?.url === "string" && b.url.length > MAX_URL_LENGTH) {
    throw createError({ statusCode: 400, message: `url exceeds ${MAX_URL_LENGTH} characters` });
  }
  if (typeof b?.description === "string" && b.description.length > MAX_DESCRIPTION_LENGTH) {
    throw createError({ statusCode: 400, message: `description exceeds ${MAX_DESCRIPTION_LENGTH} characters` });
  }
  if (typeof b?.cleanedMarkdown === "string" && b.cleanedMarkdown.length > MAX_CLEANED_MARKDOWN_LENGTH) {
    throw createError({ statusCode: 413, message: `cleanedMarkdown exceeds ${MAX_CLEANED_MARKDOWN_LENGTH} characters` });
  }
}

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuth(event);

  if (event.method !== "POST") {
    throw createError({ statusCode: 405, message: "Method not allowed" });
  }

  const body = await readBody(event);
  const { create = [], update = [], del = [] } = body ?? {};

  if (
    create.length + update.length + del.length > MAX_BATCH_ITEMS
  ) {
    throw createError({
      statusCode: 413,
      message: `Batch exceeds ${MAX_BATCH_ITEMS} items`,
    });
  }

  for (const b of [...create, ...update]) assertBookmarkLengths(b);

  const now = new Date().toISOString();

  const results: {
    created: any[];
    updated: any[];
    deleted: string[];
  } = {
    created: [],
    updated: [],
    deleted: [],
  };

  // Resolve every tag name referenced across the whole batch in a single pass
  // (one DB round-trip) rather than once per item.
  const resolveTags = await resolveTagIdsBatch(currentUser.id, [
    ...create.map((b: any) => b?.tags ?? []),
    ...update.map((b: any) => b?.tags),
  ]);

  // Batch create
  for (const bookmark of create) {
    await db.transaction(async (tx) => {
      const { ids: tagIds, names: tagNames } = resolveTags(bookmark.tags ?? []);

      let domain = bookmark.sourceDomain ?? bookmark.source_domain ?? null;
      if (!domain && bookmark.url) {
        try {
          domain = new URL(bookmark.url).hostname;
        } catch {
          domain = null;
        }
      }

      const newBookmark = {
        id: bookmark.id || crypto.randomUUID(),
        userId: currentUser.id,
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description ?? null,
        cleanedMarkdown: bookmark.cleanedMarkdown ?? null,
        originalHtml: bookmark.originalHtml ?? null,
        readingTimeMinutes: bookmark.readingTimeMinutes ?? null,
        savedAt: bookmark.savedAt ?? now,
        lastAccessedAt: null,
        isFavorite: bookmark.isFavorite ? 1 : 0,
        sortOrder: bookmark.sortOrder ?? null,
        thumbnailImagePath: bookmark.thumbnailImagePath ?? null,
        isRead: bookmark.isRead ? 1 : 0,
        readAt: bookmark.isRead ? now : null,
        sourceDomain: domain,
        wordCount: bookmark.wordCount ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      const [inserted] = await tx.insert(bookmarks).values(newBookmark).returning();
      if (!inserted) {
        throw createError({ statusCode: 500, message: "Failed to create bookmark" });
      }

      if (tagIds.length > 0) {
        await tx.insert(bookmarkTags).values(
          tagIds.map((tagId) => ({
            id: crypto.randomUUID(),
            bookmarkId: inserted.id,
            tagId,
          })),
        );
      }

      results.created.push({
        ...inserted,
        isFavorite: Boolean(inserted.isFavorite),
        isRead: Boolean(inserted.isRead),
        tags: tagNames,
      });
    });
  }

  // Batch update
  for (const bookmark of update) {
    if (!bookmark?.id) continue;

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(bookmarks)
        .where(and(eq(bookmarks.id, bookmark.id), eq(bookmarks.userId, currentUser.id)))
        .limit(1);

      if (!existing) {
        return;
      }

      let domain = bookmark.sourceDomain;
      if (bookmark.url && !domain) {
        try {
          domain = new URL(bookmark.url).hostname;
        } catch {
          domain = existing.sourceDomain;
        }
      }

      const updatedFields = {
        title: bookmark.title ?? existing.title,
        url: bookmark.url ?? existing.url,
        description: bookmark.description ?? existing.description,
        cleanedMarkdown: bookmark.cleanedMarkdown ?? existing.cleanedMarkdown,
        originalHtml: bookmark.originalHtml ?? existing.originalHtml,
        readingTimeMinutes: bookmark.readingTimeMinutes ?? existing.readingTimeMinutes,
        savedAt: bookmark.savedAt ?? existing.savedAt,
        isFavorite: bookmark.isFavorite !== undefined ? (bookmark.isFavorite ? 1 : 0) : existing.isFavorite,
        sortOrder: bookmark.sortOrder ?? existing.sortOrder,
        thumbnailImagePath: bookmark.thumbnailImagePath ?? existing.thumbnailImagePath,
        isRead: bookmark.isRead !== undefined ? (bookmark.isRead ? 1 : 0) : existing.isRead,
        readAt: bookmark.isRead !== undefined ? (bookmark.isRead ? now : null) : existing.readAt,
        sourceDomain: domain ?? existing.sourceDomain,
        wordCount: bookmark.wordCount ?? existing.wordCount,
        updatedAt: now,
      };

      const [updatedBookmark] = await tx
        .update(bookmarks)
        .set(updatedFields)
        .where(and(eq(bookmarks.id, bookmark.id), eq(bookmarks.userId, currentUser.id)))
        .returning();
      if (!updatedBookmark) {
        return;
      }

      let tagNames: string[] | undefined;

      if (Array.isArray(bookmark.tags)) {
        const resolved = resolveTags(bookmark.tags);
        tagNames = resolved.names;

        await tx.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmark.id));

        if (resolved.ids.length > 0) {
          await tx.insert(bookmarkTags).values(
            resolved.ids.map((tagId) => ({
              id: crypto.randomUUID(),
              bookmarkId: bookmark.id,
              tagId,
            })),
          );
        }
      }

      results.updated.push({
        ...updatedBookmark,
        isFavorite: Boolean(updatedBookmark.isFavorite),
        isRead: Boolean(updatedBookmark.isRead),
        tags: tagNames ?? bookmark.tags,
      });
    });
  }

  // Batch soft delete
  for (const id of del) {
    if (!id) continue;

    const [deleted] = await db
      .update(bookmarks)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, currentUser.id)))
      .returning({ id: bookmarks.id });

    if (deleted) {
      results.deleted.push(deleted.id);
    }
  }

  return results;
});
