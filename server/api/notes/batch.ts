import { and, eq } from "drizzle-orm";
import { db } from "~/server/database";
import { notes, notesTags, tags } from "~/server/database/schema";
import { requireAuth } from "~/server/utils/auth";

type BatchPayload = {
  create?: any[];
  update?: any[];
  del?: string[];
};

async function resolveTagIds(tagNames: string[] = [], userId: string) {
  const uniqueNames = [...new Set(tagNames.map((t) => t?.trim()).filter(Boolean))];
  const tagIds: string[] = [];

  for (const name of uniqueNames) {
    let [existingTag] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.name, name), eq(tags.userId, userId)))
      .limit(1);

    if (!existingTag) {
      [existingTag] = await db
        .insert(tags)
        .values({
          id: crypto.randomUUID(),
          userId,
          name,
          parentTagId: null,
          color: null,
        })
        .returning();
    }

    tagIds.push(existingTag.id);
  }

  return tagIds;
}

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuth(event);

  if (event.method !== "POST") {
    throw createError({ statusCode: 405, message: "Method not allowed" });
  }

  const body = await readBody<BatchPayload>(event);
  const { create = [], update = [], del = [] } = body;

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

  // Batch create
  for (const c of create) {
    await db.transaction(async (tx) => {
      const tagIds = await resolveTagIds(c.tags || [], currentUser.id);

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

      if (Array.isArray(u.tags)) {
        const tagIds = await resolveTagIds(u.tags, currentUser.id);

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
