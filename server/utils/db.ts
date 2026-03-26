import Database from 'better-sqlite3'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// Use process.cwd() for proper path resolution in Nuxt
const projectRoot = process.cwd()
const dataDir = join(projectRoot, 'data')
const dbPath = join(dataDir, 'bookmarks.db')

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    db.pragma('cache_size = -64000')
    initializeSchema()
  }
  return db
}

function initializeSchema() {
  const schemaPath = join(projectRoot, 'server/database/schema.sql')
  console.log('Schema path:', schemaPath)
  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf-8')
    db!.exec(schema)
    console.log('Database schema initialized successfully')
  } else {
    console.error('Schema file not found at:', schemaPath)
  }
}

// Bookmark types
export interface Bookmark {
  id: string
  title: string
  url: string
  description: string | null
  original_html: string | null
  cleaned_markdown: string | null
  reading_time_minutes: number | null
  saved_at: string
  last_accessed_at: string | null
  is_favorite: number
  sort_order: number | null
  thumbnail_image_path: string | null
  is_read: number
  read_at: string | null
  source_domain: string | null
  word_count: number | null
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  parent_tag_id: string | null
  color: string | null
  created_at: string
}

export interface BookmarkTag {
  id: string
  bookmark_id: string
  tag_id: string
}

export interface MarkdownNote {
  tags: string
  id: string
  title: string
  content: string
  is_favorite: number
  sort_order: number | null
  created_at: string
  updated_at: string
}

export interface SecretNote {
  id: string
  title: string
  content: string
  password_hash: string
  created_at: string
  updated_at: string
  last_accessed_at: string | null
}

// Helper to convert SQLite row to boolean
export function rowToBookmark(row: any): Bookmark {
  return {
    ...row,
    is_favorite: Boolean(row.is_favorite),
    is_read: Boolean(row.is_read),
  }
}
