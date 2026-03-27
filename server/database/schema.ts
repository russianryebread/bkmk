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
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
}, (table) => [
  index('idx_tags_user').on(table.userId),
  index('idx_tags_name').on(table.name),
  index('idx_tags_parent').on(table.parentTagId),
  uniqueIndex('idx_tags_user_name').on(table.userId, table.name),
])

// Bookmark Tags Junction Table
export const bookmarkTags = pgTable('bookmark_tags', {
  id: text('id').primaryKey(),
  bookmarkId: text('bookmark_id').notNull(),
  tagId: text('tag_id').notNull(),
}, (table) => [
  index('idx_bookmark_tags_bookmark').on(table.bookmarkId),
  index('idx_bookmark_tags_tag').on(table.tagId),
  uniqueIndex('idx_bookmark_tags_unique').on(table.bookmarkId, table.tagId),
])

// Markdown Notes Table
export const markdownNotes = pgTable('markdown_notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  tags: text('tags').default(''),
  
  isFavorite: integer('is_favorite').default(0),
  sortOrder: integer('sort_order'),
  
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
}, (table) => [
  index('idx_markdown_notes_user').on(table.userId),
  index('idx_markdown_notes_created').on(table.createdAt),
  index('idx_markdown_notes_is_favorite').on(table.isFavorite),
])

// Secret Notes Table
export const secretNotes = pgTable('secret_notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  
  passwordHash: text('password_hash').notNull(),
  
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at', { mode: 'string' }),
}, (table) => [
  index('idx_secret_notes_user').on(table.userId),
  index('idx_secret_notes_created').on(table.createdAt),
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

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Bookmark = typeof bookmarks.$inferSelect
export type NewBookmark = typeof bookmarks.$inferInsert
export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
export type BookmarkTag = typeof bookmarkTags.$inferSelect
export type NewBookmarkTag = typeof bookmarkTags.$inferInsert
export type MarkdownNote = typeof markdownNotes.$inferSelect
export type NewMarkdownNote = typeof markdownNotes.$inferInsert
export type SecretNote = typeof secretNotes.$inferSelect
export type NewSecretNote = typeof secretNotes.$inferInsert
export type Image = typeof images.$inferSelect
export type NewImage = typeof images.$inferInsert
export type SyncMetadata = typeof syncMetadata.$inferSelect
export type NewSyncMetadata = typeof syncMetadata.$inferInsert
