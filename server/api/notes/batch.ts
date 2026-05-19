import { and, eq } from "drizzle-orm";
import { db } from "~/server/database";
import { notes, notesTags } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";
import { resolveTagIdsBatch } from "~/server/utils/tags";

type BatchPayload = {
  create?: any[];
  update?: any[];
  del?: string[];
};

// Caps on a single batch request.
const MAX_BATCH_ITEMS = 500;
const MAX_NOTE_CONTENT_LENGTH = 1_000_000;

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuth(event);

  if (event.method !== "POST") {
    throw createError({ statusCode: 405, message: "Method not allowed" });
  }

  const body = await readBody<BatchPayload>(event);
  const { create = [], update = [], del = [] } = body;

  if (create.length + update.length + del.length > MAX_BATCH_ITEMS) {
    throw createError({
      statusCode: 413,
      message: `Batch exceeds ${MAX_BATCH_ITEMS} items`,
    });
  }

  for (const n of [...create, ...update]) {
    if (typeof n?.content === "string" && n.content.length > MAX_NOTE_CONTENT_LENGTH) {
      throw createError({
        statusCode: 413,
        message: `content exceeds ${MAX_NOTE_CONTENT_LENGTH} characters`,
      });
    }
  }

  const results: {
    created: any[];
    updated: any[];
    deleted: string[];
  } = {
    created: [],
    updated: [],
    deleted: [],
  };

  const now = new Date().toISOString();

  // Resolve every tag name referenced across the whole batch in a single pass
  // (one DB round-trip) rather than once per item.
  const resolveTags = await resolveTagIdsBatch(currentUser.id, [
    ...create.map((c) => c?.tags ?? []),
    ...update.map((u) => u?.tags),
  ]);

  // Batch create
  for (const c of create) {
    await db.transaction(async (tx) => {
      const { ids: tagIds } = resolveTags(c.tags || []);

      const [inserted] = await tx
        .insert(notes)
        .values({
          id: c.id || crypto.randomUUID(),
          userId: currentUser.id,
          content: c.content,
          isFavorite: c.isFavorite ? 1 : 0,
          createdAt: c.createdAt || now,
          updatedAt: now,
          deletedAt: null,
        })
        .returning();

      if (!inserted) {
        throw createError({ statusCode: 500, message: "Failed to create note" });
      }

      if (tagIds.length > 0) {
        await tx.insert(notesTags).values(
          tagIds.map((tagId) => ({
            id: crypto.randomUUID(),
            noteId: inserted.id,
            tagId,
          })),
        );
      }

      results.created.push({
        ...inserted,
        isFavorite: Boolean(inserted.isFavorite),
        tags: c.tags || [],
      });
    });
  }

  // Batch update
  for (const u of update) {
    if (!u.id) continue;

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(notes)
        .where(and(eq(notes.id, u.id), eq(notes.userId, currentUser.id)))
        .limit(1);

      if (!existing) return;

      const [result] = await tx
        .update(notes)
        .set({
          content: u.content ?? existing.content,
          isFavorite: u.isFavorite !== undefined ? (u.isFavorite ? 1 : 0) : existing.isFavorite,
          updatedAt: now,
        })
        .where(and(eq(notes.id, u.id), eq(notes.userId, currentUser.id)))
        .returning();

      if (!result) return;

      if (Array.isArray(u.tags)) {
        const { ids: tagIds } = resolveTags(u.tags);

        await tx.delete(notesTags).where(eq(notesTags.noteId, u.id));

        if (tagIds.length > 0) {
          await tx.insert(notesTags).values(
            tagIds.map((tagId) => ({
              id: crypto.randomUUID(),
              noteId: u.id,
              tagId,
            })),
          );
        }
      }

      results.updated.push({
        ...result,
        isFavorite: Boolean(result.isFavorite),
        tags: Array.isArray(u.tags) ? u.tags : undefined,
      });
    });
  }

  // Soft delete
  for (const id of del) {
    const [deleted] = await db
      .update(notes)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(notes.id, id), eq(notes.userId, currentUser.id)))
      .returning();

    if (deleted) {
      results.deleted.push(id);
    }
  }

  return results;
});
