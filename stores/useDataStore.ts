// Unified Pinia store for bookmarks, notes, tags
// Data flow: server → IndexedDB → pinia (on read)
//           pinia → IndexedDB → server (on write, background sync)

import { defineStore } from "pinia";
import { useIdb, type Note, type Tag, type Bookmark, type BookmarkFilters } from "~/composables/idb";

// Types for sync queue items
interface SyncQueueItem {
  id: string;
  action: "create" | "update" | "delete";
  entity: "bookmark" | "note" | "tag";
  data: unknown;
  timestamp: number;
  retries: number;
}

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "offline";

export const useDataStore = defineStore("data", () => {
  const idb = useIdb();

  // ==================== STATE ====================
  const bookmarks = ref<Bookmark[]>([]);
  const notes = ref<Note[]>([]);
  const tags = ref<Tag[]>([]);

  const loading = ref(false);
  const syncing = ref(false);
  const syncStatus = ref<SyncStatus>("idle");
  const syncError = ref<string | null>(null);
  const lastSyncTime = ref<Date | null>(null);

  const isOnline = ref(true);

  // ==================== SYNC QUEUE COUNT ====================
  // Mirrors the size of the persisted IDB sync queue. Updated explicitly after
  // each queueChange and at the end of every syncWithServer.
  const pendingChanges = ref(0);
  const pendingChangesCount = computed(() => pendingChanges.value);
  const hasPendingChanges = computed(() => pendingChanges.value > 0);

  async function refreshPendingCount() {
    try {
      const queue = await idb.getSyncQueue();
      pendingChanges.value = queue.length;
    } catch (e) {
      console.warn("[DataStore] Failed to read sync queue length", e);
    }
  }

  // ==================== SYNC LOCK ====================
  // Prevents concurrent sync attempts that cause race conditions
  let syncInProgress = false;

  // ==================== LIFECYCLE ====================
  async function initialize() {
    console.log("[DataStore] Initializing...");

    // Initialize IndexedDB first
    await idb.initialize();

    // Load from IndexedDB into state
    await loadFromIdb();
    await refreshPendingCount();

    // Set up online/offline listeners
    isOnline.value = navigator.onLine;
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Fetch latest from server and update IndexedDB
    if (isOnline.value) {
      syncWithServer();
    }
  }

  function cleanup() {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  }

  function handleOnline() {
    console.log("[DataStore] Online");
    isOnline.value = true;
    syncStatus.value = "idle";
    syncWithServer();
  }

  function handleOffline() {
    console.log("[DataStore] Offline");
    isOnline.value = false;
    syncStatus.value = "offline";
  }

  // ==================== LOAD FROM INDEXEDDB ====================
  async function loadFromIdb() {
    console.log("[DataStore] Loading from IndexedDB...");
    try {
      const [loadedBookmarks, loadedNotes, loadedTags] = await Promise.all([
        idb.getAllBookmarks(),
        idb.getAllNotes(),
        idb.getAllTags(),
      ]);
      bookmarks.value = loadedBookmarks;
      notes.value = loadedNotes;
      tags.value = loadedTags;
      console.log(
        `[DataStore] Loaded: ${loadedBookmarks.length} bookmarks, ${loadedNotes.length} notes, ${loadedTags.length} tags`,
      );
    } catch (e) {
      console.error("[DataStore] Failed to load from IndexedDB:", e);
    }
  }

  // ==================== SERVER SYNC ====================
  async function syncWithServer(): Promise<boolean> {
    // Prevent concurrent sync attempts that cause race conditions
    if (syncInProgress) {
      console.log("[DataStore] Sync already in progress, skipping");
      return false;
    }
    if (!isOnline.value || syncing.value) return false;

    console.log("[DataStore] Syncing with server...");
    syncInProgress = true;
    syncing.value = true;
    syncStatus.value = "syncing";
    syncError.value = null;

    try {
      // 1. Push local changes via batch API
      await pushLocalChanges();

      // 2. Pull server data
      await pullServerData();

      lastSyncTime.value = new Date();
      syncStatus.value = "success";
      return true;
    } catch (e: unknown) {
      const error = e as Error;
      console.error("[DataStore] Sync failed:", error);
      syncError.value = error.message || "Sync failed";
      syncStatus.value = "error";
      return false;
    } finally {
      syncInProgress = false;
      syncing.value = false;
      await refreshPendingCount();
    }
  }

  async function pushLocalChanges(): Promise<{ allSucceeded: boolean }> {
    const queue = await idb.getSyncQueue();
    if (queue.length === 0) return { allSucceeded: true };

    console.log(`[DataStore] Processing ${queue.length} queued changes...`);

    const bookmarkItems = queue.filter((q) => q.entity === "bookmark");
    const noteItems = queue.filter((q) => q.entity === "note");
    const tagItems = queue.filter((q) => q.entity === "tag");

    const results = await Promise.all([
      pushQueueGroup(bookmarkItems, pushBookmarksBatch, "bookmarks"),
      pushQueueGroup(noteItems, pushNotesBatch, "notes"),
      pushQueueGroup(tagItems, pushTagsBatch, "tags"),
    ]);

    return { allSucceeded: results.every((r) => r) };
  }

  type BatchFn = (
    creates: SyncQueueItem[],
    updates: SyncQueueItem[],
    deletes: SyncQueueItem[],
  ) => Promise<void>;

  async function pushQueueGroup(items: SyncQueueItem[], batchFn: BatchFn, label: string): Promise<boolean> {
    if (items.length === 0) return true;

    const creates = items.filter((q) => q.action === "create");
    const updates = items.filter((q) => q.action === "update");
    const deletes = items.filter((q) => q.action === "delete");

    try {
      await batchFn(creates, updates, deletes);
      for (const item of items) await idb.removeFromSyncQueue(item.id);
      return true;
    } catch (e) {
      console.warn(`[DataStore] Batch push failed for ${label}, falling back to individual pushes`, e);
    }

    let allOk = true;
    for (const item of items) {
      try {
        await pushChange(item);
        await idb.removeFromSyncQueue(item.id);
      } catch (err) {
        allOk = false;
        item.retries++;
        await idb.updateSyncQueueItem(item);
        console.warn(`[DataStore] Item kept in queue (retries=${item.retries}):`, item.entity, item.action, item.id);
      }
    }
    return allOk;
  }

  async function pushBookmarksBatch(creates: SyncQueueItem[], updates: SyncQueueItem[], deletes: SyncQueueItem[]) {
    const batchData = {
      create: creates.map((c) => c.data as Bookmark),
      update: updates.map((u) => {
        const data = u.data as Partial<Bookmark>;
        return { id: u.id, ...data };
      }),
      del: deletes.map((d) => d.id),
    };

    if (batchData.create.length === 0 && batchData.update.length === 0 && batchData.del.length === 0) {
      return;
    }

    const result = await $fetch("/api/bookmarks/batch", {
      method: "POST",
      body: batchData,
    });

    console.log(
      `[DataStore] Batch bookmark sync: ${result.created.length} created, ${result.updated.length} updated, ${result.deleted.length} deleted`,
    );
  }

  async function pushNotesBatch(creates: SyncQueueItem[], updates: SyncQueueItem[], deletes: SyncQueueItem[]) {
    const batchData = {
      create: creates.map((c) => c.data as Note),
      update: updates.map((u) => {
        const data = u.data as Partial<Note>;
        return { id: u.id, ...data };
      }),
      del: deletes.map((d) => d.id),
    };

    if (batchData.create.length === 0 && batchData.update.length === 0 && batchData.del.length === 0) {
      return;
    }

    const result = await $fetch("/api/notes/batch", {
      method: "POST",
      body: batchData,
    });

    console.log(
      `[DataStore] Batch note sync: ${result.created.length} created, ${result.updated.length} updated, ${result.deleted.length} deleted`,
    );
  }

  async function pushTagsBatch(creates: SyncQueueItem[], updates: SyncQueueItem[], deletes: SyncQueueItem[]) {
    const batchData = {
      create: creates.map((c) => c.data as Tag),
      update: updates.map((u) => {
        const data = u.data as Partial<Tag>;
        return { id: u.id, ...data };
      }),
      del: deletes.map((d) => d.id),
    };

    if (batchData.create.length === 0 && batchData.update.length === 0 && batchData.del.length === 0) {
      return;
    }

    const result = await $fetch("/api/tags/batch", {
      method: "POST",
      body: batchData,
    });

    console.log(
      `[DataStore] Batch tag sync: ${result.created.length} created, ${result.updated.length} updated, ${result.deleted.length} deleted`,
    );
  }

  async function pushChange(item: SyncQueueItem) {
    const { action, entity, id } = item;

    switch (entity) {
      case "bookmark": {
        const data = item.data as Partial<Bookmark>;
        if (action === "delete") {
          await $fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
        } else if (action === "create") {
          await $fetch("/api/bookmarks", { method: "POST", body: data });
        } else {
          await $fetch(`/api/bookmarks/${id}`, { method: "PUT", body: data });
        }
        break;
      }
      case "note": {
        const data = item.data as Partial<Note>;
        if (action === "delete") {
          await $fetch(`/api/notes/${id}`, { method: "DELETE" });
        } else if (action === "create") {
          await $fetch("/api/notes", { method: "POST", body: data });
        } else {
          await $fetch(`/api/notes/${id}`, { method: "PUT", body: data });
        }
        break;
      }
      case "tag": {
        const data = item.data as Partial<Tag>;
        if (action === "delete") {
          await $fetch(`/api/tags/${id}`, { method: "DELETE" });
        } else if (action === "create") {
          await $fetch("/api/tags", { method: "POST", body: data });
        } else {
          await $fetch(`/api/tags/${id}`, { method: "PUT", body: data });
        }
        break;
      }
    }
  }

  async function pullServerData() {
    console.log("[DataStore] Pulling data from server...");

    try {
      const [bookmarksRes, notesRes, tagsRes] = await Promise.allSettled([
        $fetch<{ bookmarks: Bookmark[] }>("/api/bookmarks?limit=1000&includeDeleted=true"),
        $fetch<{ notes: Note[] }>("/api/notes?limit=1000&includeDeleted=true"),
        $fetch<{ tags: Tag[] }>("/api/tags"),
      ]);

      if (bookmarksRes.status === "fulfilled" && bookmarksRes.value.bookmarks) {
        const serverBookmarks = bookmarksRes.value.bookmarks;
        await mergeBookmarks(serverBookmarks);
        console.log(`[DataStore] Synced ${serverBookmarks.length} bookmarks`);
      }
      if (notesRes.status === "fulfilled" && notesRes.value.notes) {
        const serverNotes = notesRes.value.notes;
        await mergeNotes(serverNotes);
        console.log(`[DataStore] Synced ${serverNotes.length} notes`);
      }

      if (tagsRes.status === "fulfilled" && tagsRes.value.tags) {
        const serverTags = tagsRes.value.tags;
        await mergeTags(serverTags);
        console.log(`[DataStore] Synced ${serverTags.length} tags`);
      }
    } catch (e) {
      console.warn("[DataStore] Partial server pull failed:", e);
    }
  }

  type HasId = { id: string }

  interface MergeOptions<T extends HasId> {
    localList: T[]
    serverList: T[]
    // return numeric timestamp (ms since epoch) used for comparison
    tsFor: (item: T) => number
    // optional: when timestamps equal, preferServer determines tie-breaker (default true)
    preferServer?: boolean
    // optional: predicate deciding whether an item should be persisted to IDB
    shouldSave?: (finalItem: T, localItem?: T, serverItem?: T) => boolean
    // optional: predicate identifying tombstones — items so flagged are excluded from merged
    // and their ids are reported in toDelete so callers can purge them locally
    isDeleted?: (item: T) => boolean
  }

  function mergeGeneric<T extends HasId>(opts: MergeOptions<T>): { merged: T[]; toSave: T[]; toDelete: string[] } {
    const { localList, serverList, tsFor, preferServer = true, shouldSave, isDeleted } = opts

    const localMap = new Map(localList.map(i => [i.id, i]))
    const mergedMap = new Map<string, T>()
    const toSave: T[] = []
    const toDelete: string[] = []

    // Handle ids present on the server: choose newer between server and local
    for (const server of serverList) {
      const local = localMap.get(server.id)
      let chosen: T
      let pairLocal: T | undefined
      let pairServer: T | undefined = server
      if (!local) {
        chosen = { ...server }
      } else {
        pairLocal = local
        const serverTs = tsFor(server)
        const localTs = tsFor(local)
        if (serverTs > localTs) chosen = { ...server }
        else if (localTs > serverTs) chosen = { ...local }
        else chosen = preferServer ? { ...server } : { ...local }
      }
      if (isDeleted && isDeleted(chosen)) {
        toDelete.push(server.id)
        continue
      }
      mergedMap.set(server.id, chosen)
      if (!shouldSave || shouldSave(chosen, pairLocal, pairServer)) toSave.push(chosen)
    }

    // Add local-only items
    for (const local of localList) {
      if (!mergedMap.has(local.id) && !toDelete.includes(local.id)) {
        if (isDeleted && isDeleted(local)) {
          toDelete.push(local.id)
          continue
        }
        const chosen = { ...local }
        mergedMap.set(local.id, chosen)
        if (!shouldSave || shouldSave(chosen, local, undefined)) toSave.push(chosen)
      }
    }

    return { merged: Array.from(mergedMap.values()), toSave, toDelete }
  }

  async function mergeBookmarks(serverBookmarks: Bookmark[]) {
    const { merged, toSave, toDelete } = mergeGeneric<Bookmark>({
      localList: bookmarks.value,
      serverList: serverBookmarks,
      tsFor: b => Date.parse(b.updatedAt),
      preferServer: true,
      isDeleted: b => b.deletedAt != null,
      shouldSave: (finalItem, localItem, serverItem) => {
        return !!serverItem || !!(localItem && Date.parse(localItem.updatedAt) > Date.parse(finalItem.updatedAt))
      }
    })

    if (toSave.length > 0) await idb.saveBookmarks(toSave)
    for (const id of toDelete) await idb.deleteBookmark(id)
    bookmarks.value = merged
  }

  async function mergeNotes(serverNotes: Note[]) {
    const { merged, toSave, toDelete } = mergeGeneric<Note>({
      localList: notes.value,
      serverList: serverNotes,
      tsFor: n => Date.parse(n.updatedAt),
      preferServer: true,
      isDeleted: n => n.deletedAt != null,
      shouldSave: (finalItem, localItem, serverItem) => {
        return !!serverItem || !!(localItem && Date.parse(localItem.updatedAt) > Date.parse(finalItem.updatedAt))
      }
    })

    if (toSave.length > 0) await idb.saveNotes(toSave)
    for (const id of toDelete) await idb.deleteNote(id)
    notes.value = merged
  }

  async function mergeTags(serverTags: Tag[]) {
    // Tags lack a server-side `updatedAt` column, so timestamp comparisons collapse to ties on
    // every merge. Preferring local on ties keeps queued local edits (rename, recolor, reparent)
    // from being silently clobbered by the next pull before the queue has flushed. Once the
    // server schema gains `tags.updated_at`, switch this back to `preferServer: true` and merge
    // on `updatedAt`.
    const { merged, toSave } = mergeGeneric<Tag>({
      localList: tags.value,
      serverList: serverTags,
      tsFor: t => Date.parse(t.createdAt),
      preferServer: false,
      shouldSave: (finalItem, localItem, serverItem) => {
        return !!serverItem || !!(localItem && Date.parse(localItem.createdAt) > Date.parse(finalItem.createdAt))
      }
    })

    if (toSave.length > 0) await idb.saveTags(toSave)
    tags.value = merged
  }

  // ==================== QUEUE CHANGE ====================
  async function queueChange(
    entity: "bookmark" | "note" | "tag",
    action: "create" | "update" | "delete",
    id: string,
    data?: unknown,
  ) {
    const item = {
      id,
      action,
      entity,
      data: data || `${entity}-${action}-${id}-${Date.now()}`,
      timestamp: Date.now(),
    };

    await idb.addToSyncQueue(item as Omit<SyncQueueItem, "retries">);
    await refreshPendingCount();

    // Try immediate sync if online (fire and forget)
    if (isOnline.value && !syncing.value) {
      syncWithServer();
    }
  }

  // ==================== BOOKMARK OPERATIONS ====================
  async function createBookmark(url: string): Promise<Bookmark | null> {
    const response = await $fetch<Bookmark>("/api/scrape", {
      method: "POST",
      body: { url },
    });

    // Add to local state and IndexedDB immediately
    bookmarks.value.push(response);
    await idb.saveBookmark(response);

    return response;
  }

  async function updateBookmark(id: string, updates: Partial<Bookmark>): Promise<boolean> {
    const index = bookmarks.value.findIndex((b) => b.id === id);
    if (index === -1) return false;

    const current = bookmarks.value[index];
    if (!current) return false;

    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
    bookmarks.value[index] = updated;

    // Save to IndexedDB immediately
    await idb.saveBookmark(updated);

    // Queue for server sync (background)
    await queueChange("bookmark", "update", id, updates);

    return true;
  }

  async function deleteBookmark(id: string): Promise<boolean> {
    const bookmark = bookmarks.value.find((b) => b.id === id);
    if (!bookmark) return false;

    // Optimistically remove from local state
    bookmarks.value = bookmarks.value.filter((b) => b.id !== id);
    await idb.deleteBookmark(id);

    // Queue for server sync (background)
    await queueChange("bookmark", "delete", id);

    return true;
  }

  async function toggleBookmarkFavorite(id: string): Promise<boolean> {
    const bookmark = bookmarks.value.find((b) => b.id === id);
    if (!bookmark) return false;
    return updateBookmark(id, { isFavorite: !bookmark.isFavorite });
  }

  async function markBookmarkRead(id: string): Promise<boolean> {
    return updateBookmark(id, { isRead: true, readAt: new Date().toISOString() });
  }

  // ==================== NOTE OPERATIONS ====================
  async function createNote(data: { content: string; tags?: string[]; isFavorite?: boolean }): Promise<Note | null> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const note: Note = {
      id,
      content: data.content,
      tags: data.tags || [],
      isFavorite: data.isFavorite || false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    // Save locally first
    notes.value.push(note);
    await idb.saveNote(note);

    // Queue for server sync (background)
    await queueChange("note", "create", id, note);

    return note;
  }

  async function updateNote(
    id: string,
    data: { content?: string; tags?: string[]; isFavorite?: boolean },
  ): Promise<boolean> {
    const index = notes.value.findIndex((n) => n.id === id);
    if (index === -1) return false;

    const current = notes.value[index];
    if (!current) return false;

    const updated: Note = {
      ...current,
      content: data.content ?? current.content,
      tags: data.tags ?? current.tags,
      isFavorite: data.isFavorite ?? current.isFavorite,
      updatedAt: new Date().toISOString(),
    };
    notes.value[index] = updated;

    // Save to IndexedDB immediately
    await idb.saveNote(updated);

    // Queue for server sync (background)
    await queueChange("note", "update", id, data);

    return true;
  }

  async function deleteNote(id: string): Promise<boolean> {
    const note = notes.value.find((n) => n.id === id);
    if (!note) return false;

    // Optimistically remove from local state
    notes.value = notes.value.filter((n) => n.id !== id);
    await idb.deleteNote(id);

    // Queue for server sync (background)
    await queueChange("note", "delete", id);

    return true;
  }

  async function toggleNoteFavorite(id: string): Promise<boolean> {
    const note = notes.value.find((n) => n.id === id);
    if (!note) return false;
    return updateNote(id, { isFavorite: !note.isFavorite });
  }

  // ==================== TAG OPERATIONS ====================
  async function createTag(data: {
    name: string;
    parentTagId?: string | null;
    color?: string | null;
    type?: "bookmark" | "note" | "both";
    description?: string | null;
    icon?: string | null;
  }): Promise<Tag | null> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const tag: Tag = {
      id,
      name: data.name,
      parentTagId: data.parentTagId || null,
      color: data.color || null,
      type: data.type || "both",
      description: data.description || null,
      icon: data.icon || null,
      createdAt: now,
      bookmarkCount: 0,
    };

    // Save locally first
    tags.value.push(tag);
    await idb.saveTag(tag);

    // Queue for server sync (background)
    await queueChange("tag", "create", id, tag);

    return tag;
  }

  async function updateTag(id: string, data: Partial<Tag>): Promise<boolean> {
    const index = tags.value.findIndex((t) => t.id === id);
    if (index === -1) return false;

    const current = tags.value[index];
    if (!current) return false;

    const updated = { ...current, ...data };
    tags.value[index] = updated;

    // Save to IndexedDB immediately
    await idb.saveTag(updated);

    // Queue for server sync (background)
    await queueChange("tag", "update", id, data);

    return true;
  }

  async function deleteTag(id: string): Promise<boolean> {
    const tag = tags.value.find((t) => t.id === id);
    if (!tag) return false;

    // Optimistically remove from local state
    tags.value = tags.value.filter((t) => t.id !== id);
    await idb.deleteTag(id);

    // Queue for server sync (background)
    await queueChange("tag", "delete", id);

    return true;
  }

  // ==================== LOOKUP ====================
  function getBookmarkById(id: string): Bookmark | undefined {
    return bookmarks.value.find((b) => b.id === id);
  }

  function getNoteById(id: string): Note | undefined {
    return notes.value.find((n) => n.id === id);
  }

  function getTagById(id: string): Tag | undefined {
    return tags.value.find((t) => t.id === id);
  }

  // ==================== SEARCH ====================
  function searchBookmarks(query: string, filters: BookmarkFilters & { untagged?: boolean } = {}): Bookmark[] {
    let results = bookmarks.value.filter((b) => !b.deletedAt);

    if (filters.favorite) {
      results = results.filter((b) => b.isFavorite);
    }
    if (filters.unread) {
      results = results.filter((b) => !b.isRead);
    }
    if (filters.untagged) {
      results = results.filter((b) => !b.tags || b.tags.length === 0);
    }
    if (filters.tag) {
      results = results.filter((b) => b.tags?.includes(filters.tag!));
    }
    if (filters.domain) {
      results = results.filter((b) => b.sourceDomain === filters.domain);
    }

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (b) =>
          b.title?.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q) ||
          b.url?.toLowerCase().includes(q) ||
          b.sourceDomain?.toLowerCase().includes(q) ||
          b.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Sort
    const sort = filters.sort || "saved_at";
    const order = filters.order || "desc";
    results.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sort] || "";
      const bVal = (b as Record<string, unknown>)[sort] || "";
      if (typeof aVal === "boolean") return order === "desc" ? (bVal ? 1 : -1) : aVal ? 1 : -1;
      return order === "desc" ? (bVal > aVal ? 1 : bVal < aVal ? -1 : 0) : aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    });

    return results;
  }

  function searchNotes(query: string): Note[] {
    const live = notes.value.filter((n) => !n.deletedAt);
    if (!query) return live;

    const q = query.toLowerCase();
    return live.filter(
      (n) => n.content.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  function searchTags(query: string): Tag[] {
    if (!query) return tags.value;
    const q = query.toLowerCase();
    return tags.value.filter((t) => t.name.toLowerCase().includes(q));
  }

  // ==================== PAGINATION HELPERS ====================

  // Cursor-based pagination for bookmarks (for infinite scroll)
  function getBookmarksPaginated(
    cursor: string | null,
    filters: { search?: string; tag?: string; favorite?: boolean; sort?: string; order?: string } = {},
    limit: number = 20,
  ): { bookmarks: Bookmark[]; nextCursor: string | null; hasMore: boolean } {
    let results = searchBookmarks(filters.search || "", filters);

    // Find cursor position
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = results.findIndex((b) => b.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const pageBookmarks = results.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < results.length;
    const lastBookmark = pageBookmarks[pageBookmarks.length - 1];
    const nextCursor = hasMore && lastBookmark ? lastBookmark.id : null;

    return { bookmarks: pageBookmarks, nextCursor, hasMore };
  }

  // Cursor-based pagination for notes (for infinite scroll)
  function getNotesPaginated(
    cursor: string | null,
    filters: { sort?: string; order?: string; favorite?: boolean; search?: string } = {},
    limit: number = 20,
  ): { notes: Note[]; nextCursor: string | null; hasMore: boolean } {
    let results = searchNotes(filters.search || "");
    results = results.filter((n) => n.deletedAt === null || n.deletedAt === undefined);

    if (filters.favorite !== undefined) {
      results = results.filter((n) => n.isFavorite === filters.favorite);
    }

    // Sort
    const sort = filters.sort || "updatedAt";
    const order = filters.order || "desc";
    results.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sort] || "";
      const bVal = (b as Record<string, unknown>)[sort] || "";
      if (typeof aVal === "boolean") return order === "desc" ? (bVal ? 1 : -1) : aVal ? 1 : -1;
      return order === "desc" ? (bVal > aVal ? 1 : bVal < aVal ? -1 : 0) : aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    });

    // Find cursor position
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = results.findIndex((n) => n.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const pageNotes = results.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < results.length;
    const lastNote = pageNotes[pageNotes.length - 1];
    const nextCursor = hasMore && lastNote ? lastNote.id : null;

    return { notes: pageNotes, nextCursor, hasMore };
  }

  // ==================== MANUAL SYNC TRIGGER ====================
  async function triggerSync(): Promise<boolean> {
    return syncWithServer();
  }

  return {
    // State
    bookmarks,
    notes,
    tags,
    loading,
    syncing,
    syncStatus,
    syncError,
    lastSyncTime,
    isOnline,
    hasPendingChanges,
    pendingChangesCount,

    // Lifecycle
    initialize,
    cleanup,
    triggerSync,

    // Bookmark operations
    createBookmark,
    updateBookmark,
    deleteBookmark,
    toggleBookmarkFavorite,
    markBookmarkRead,

    // Note operations
    createNote,
    updateNote,
    deleteNote,
    toggleNoteFavorite,

    // Tag operations
    createTag,
    updateTag,
    deleteTag,

    // Search
    searchBookmarks,
    searchNotes,
    searchTags,

    // Lookup
    getBookmarkById,
    getNoteById,
    getTagById,

    // Pagination
    getBookmarksPaginated,
    getNotesPaginated,
  };
});
