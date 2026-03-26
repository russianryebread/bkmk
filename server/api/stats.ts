import { getDb } from '../utils/db'

export default defineEventHandler(async () => {
  const db = getDb()

  // Get total bookmarks count
  const { total: totalBookmarks } = db.prepare(
    'SELECT COUNT(*) as total FROM bookmarks'
  ).get() as { total: number }

  // Get unread bookmarks count
  const { total: unreadBookmarks } = db.prepare(
    'SELECT COUNT(*) as total FROM bookmarks WHERE is_read = 0'
  ).get() as { total: number }

  // Get total notes count (markdown_notes table)
  const { total: totalNotes } = db.prepare(
    'SELECT COUNT(*) as total FROM markdown_notes'
  ).get() as { total: number }

  // Get total secret notes count
  const { total: totalSecretNotes } = db.prepare(
    'SELECT COUNT(*) as total FROM secret_notes'
  ).get() as { total: number }

  // Get total tags count
  const { total: totalTags } = db.prepare(
    'SELECT COUNT(*) as total FROM tags'
  ).get() as { total: number }

  return {
    totalBookmarks,
    unreadBookmarks,
    totalNotes,
    totalSecretNotes,
    totalTags,
  }
})
