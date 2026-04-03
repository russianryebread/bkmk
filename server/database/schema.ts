import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Users Table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'), // 'user' or 'admin'
  
  // Password reset fields
  passwordResetToken: text('password_reset_token'),
  passwordResetExpiry: timestamp('password_reset_expiry', { mode: 'string' }),
  
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_users_email').on(table.email),
  index('idx_users_created').on(table.createdAt),
])

// Bookmarks Table
export const bookmarks = pgTable('bookmarks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  url: text('url').notNull(),
  description: text('description'),
  
  // Content storage
  originalHtml: text('original_html'),
  cleanedMarkdown: text('cleaned_markdown'),
  readingTimeMinutes: integer('reading_time_minutes'),
  
  // Metadata
  savedAt: timestamp('saved_at', { mode: 'string' }).defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at', { mode: 'string' }),
  
  // Organization
  isFavorite: integer('is_favorite').default(0),
  sortOrder: integer('sort_order'),
  
  // Image storage reference
  thumbnailImagePath: text('thumbnail_image_path'),
  
  // Status
  isRead: integer('is_read').default(0),
  readAt: timestamp('read_at', { mode: 'string' }),
  
  // Additional fields
  sourceDomain: text('source_domain'),
  wordCount: integer('word_count'),
  
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
}, (table) => [
  index('idx_bookmarks_user').on(table.userId),
  index('idx_bookmarks_created').on(table.createdAt),
  index('idx_bookmarks_is_favorite').on(table.isFavorite),
  index('idx_bookmarks_source_domain').on(table.sourceDomain),
  index('idx_bookmarks_is_read').on(table.isRead),
])

// Tags Table
export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  parentTagId: text('parent_tag_id'),
  color: text('color'),
  type: text('type').default('both'), // 'bookmark' | 'note' | 'both'
  description: text('description'),
  icon: text('icon'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
}, (table) => [
  index('idx_tags_user').on(table.userId),
  index('idx_tags_name').on(table.name),
  index('idx_tags_parent').on(table.parentTagId),
  index('idx_tags_type').on(table.type),
  uniqueIndex('idx_tags_user_name').on(table.userId, table.name),
])

// Bookmark Tags Junction Table (existing table - no foreign keys to avoid data issues)
export const bookmarkTags = pgTable('bookmark_tags', {
  id: text('id').primaryKey(),
  bookmarkId: text('bookmark_id').notNull(),
  tagId: text('tag_id').notNull(),
}, (table) => [
  index('idx_bookmark_tags_bookmark').on(table.bookmarkId),
  index('idx_bookmark_tags_tag').on(table.tagId),
  uniqueIndex('idx_bookmark_tags_unique').on(table.bookmarkId, table.tagId),
])

// Notes Table (renamed from markdown_notes)
export const notes = pgTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  
  isFavorite: integer('is_favorite').default(0),
  sortOrder: integer('sort_order'),
  
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
}, (table) => [
  index('idx_notes_user').on(table.userId),
  index('idx_notes_created').on(table.createdAt),
  index('idx_notes_is_favorite').on(table.isFavorite),
])

// Notes Tags Junction Table
export const notesTags = pgTable('notes_tags', {
  id: text('id').primaryKey(),
  noteId: text('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  index('idx_notes_tags_note').on(table.noteId),
  index('idx_notes_tags_tag').on(table.tagId),
  uniqueIndex('idx_notes_tags_unique').on(table.noteId, table.tagId),
])

// Secrets Table (renamed from secret_notes)
export const secrets = pgTable('secrets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  
  passwordHash: text('password_hash').notNull(),
  
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at', { mode: 'string' }),
}, (table) => [
  index('idx_secrets_user').on(table.userId),
  index('idx_secrets_created').on(table.createdAt),
])

// Secrets Tags Junction Table
export const secretsTags = pgTable('secrets_tags', {
  id: text('id').primaryKey(),
  secretId: text('secret_id').notNull().references(() => secrets.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  index('idx_secrets_tags_secret').on(table.secretId),
  index('idx_secrets_tags_tag').on(table.tagId),
  uniqueIndex('idx_secrets_tags_unique').on(table.secretId, table.tagId),
])

// Images Table - stores processed images for bookmarks
export const images = pgTable('images', {
  id: text('id').primaryKey(),
  bookmarkId: text('bookmark_id').notNull().references(() => bookmarks.id, { onDelete: 'cascade' }),
  originalUrl: text('original_url').notNull(),
  mimeType: text('mime_type').notNull(),
  width: integer('width'),
  height: integer('height'),
  sizeBytes: integer('size_bytes').notNull(),
  data: text('data').notNull(), // Base64 encoded image data
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
}, (table) => [
  index('idx_images_bookmark').on(table.bookmarkId),
  index('idx_images_original_url').on(table.originalUrl),
])

// Sync Metadata Table
export const syncMetadata = pgTable('sync_metadata', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  lastModifiedAt: timestamp('last_modified_at', { mode: 'string' }).defaultNow(),
  isDeleted: integer('is_deleted').default(0),
  syncStatus: text('sync_status').default('pending'),
}, (table) => [
  index('idx_sync_metadata_status').on(table.syncStatus),
  uniqueIndex('idx_sync_metadata_unique').on(table.entityType, table.entityId),
])

// Relations
export const bookmarksRelations = relations(bookmarks, ({ many }) => ({
  bookmarkTags: many(bookmarkTags),
  images: many(images),
}))

export const tagsRelations = relations(tags, ({ one, many }) => ({
  parentTag: one(tags, {
    fields: [tags.parentTagId],
    references: [tags.id],
  }),
  childTags: many(tags),
  bookmarkTags: many(bookmarkTags),
  notesTags: many(notesTags),
  secretsTags: many(secretsTags),
}))

export const bookmarkTagsRelations = relations(bookmarkTags, ({ one }) => ({
  bookmark: one(bookmarks, {
    fields: [bookmarkTags.bookmarkId],
    references: [bookmarks.id],
  }),
  tag: one(tags, {
    fields: [bookmarkTags.tagId],
    references: [tags.id],
  }),
}))

export const imagesRelations = relations(images, ({ one }) => ({
  bookmark: one(bookmarks, {
    fields: [images.bookmarkId],
    references: [bookmarks.id],
  }),
}))

export const notesRelations = relations(notes, ({ many }) => ({
  notesTags: many(notesTags),
}))

export const notesTagsRelations = relations(notesTags, ({ one }) => ({
  note: one(notes, {
    fields: [notesTags.noteId],
    references: [notes.id],
  }),
  tag: one(tags, {
    fields: [notesTags.tagId],
    references: [tags.id],
  }),
}))

export const secretsRelations = relations(secrets, ({ many }) => ({
  secretsTags: many(secretsTags),
}))

export const secretsTagsRelations = relations(secretsTags, ({ one }) => ({
  secret: one(secrets, {
    fields: [secretsTags.secretId],
    references: [secrets.id],
  }),
  tag: one(tags, {
    fields: [secretsTags.tagId],
    references: [tags.id],
  }),
}))

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Bookmark = typeof bookmarks.$inferSelect
export type NewBookmark = typeof bookmarks.$inferInsert
export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
export type BookmarkTag = typeof bookmarkTags.$inferSelect
export type NewBookmarkTag = typeof bookmarkTags.$inferInsert
export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert
export type NotesTag = typeof notesTags.$inferSelect
export type NewNotesTag = typeof notesTags.$inferInsert
export type Secret = typeof secrets.$inferSelect
export type NewSecret = typeof secrets.$inferInsert
export type SecretsTag = typeof secretsTags.$inferSelect
export type NewSecretsTag = typeof secretsTags.$inferInsert
export type Image = typeof images.$inferSelect
export type NewImage = typeof images.$inferInsert
export type SyncMetadata = typeof syncMetadata.$inferSelect
export type NewSyncMetadata = typeof syncMetadata.$inferInsert
