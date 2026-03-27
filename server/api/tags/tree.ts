import { db, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'

interface TagNode {
  id: string
  name: string
  parentTagId: string | null
  color: string | null
  createdAt: string | null
  children: TagNode[]
}

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  // Only get tags for current user
  const tags = await db
    .select()
    .from(schema.tags)
    .where(eq(schema.tags.userId, currentUser.id))
    .orderBy(schema.tags.name)
  const tagMap = new Map<string, TagNode>()
  const rootTags: TagNode[] = []
  tags.forEach(tag => tagMap.set(tag.id, { ...tag, children: [] }))
  tags.forEach(tag => {
    const node = tagMap.get(tag.id)!
    if (tag.parentTagId && tagMap.has(tag.parentTagId)) tagMap.get(tag.parentTagId)!.children.push(node)
    else rootTags.push(node)
  })
  return { tags: rootTags }
})
