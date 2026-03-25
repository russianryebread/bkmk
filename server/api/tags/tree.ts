import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()

  // Get all tags with hierarchy
  const tags = db.prepare(`
    SELECT * FROM tags ORDER BY name
  `).all() as any[]

  // Build hierarchical structure
  const tagMap = new Map<string, any>()
  const rootTags: any[] = []

  // First pass: create map
  tags.forEach(tag => {
    tagMap.set(tag.id, { ...tag, children: [] })
  })

  // Second pass: build tree
  tags.forEach(tag => {
    const node = tagMap.get(tag.id)
    if (tag.parent_tag_id && tagMap.has(tag.parent_tag_id)) {
      tagMap.get(tag.parent_tag_id).children.push(node)
    } else {
      rootTags.push(node)
    }
  })

  return { tags: rootTags }
})
