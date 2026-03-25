export interface Tag {
  id: string
  name: string
  parent_tag_id: string | null
  color: string | null
  created_at: string
  bookmark_count?: number
  children?: Tag[]
}

export function useTags() {
  const tags = ref<Tag[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTags() {
    loading.value = true
    error.value = null
    
    try {
      const response = await $fetch<{ tags: Tag[] }>('/api/tags')
      tags.value = response.tags
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch tags'
    } finally {
      loading.value = false
    }
  }

  async function fetchTagTree() {
    loading.value = true
    error.value = null
    
    try {
      const response = await $fetch<{ tags: Tag[] }>('/api/tags/tree')
      tags.value = response.tags
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch tag tree'
    } finally {
      loading.value = false
    }
  }

  async function createTag(name: string, parentTagId?: string, color?: string): Promise<Tag | null> {
    try {
      const response = await $fetch<{ tag: Tag }>('/api/tags', {
        method: 'POST',
        body: { name, parent_tag_id: parentTagId, color },
      })
      await fetchTags()
      return response.tag
    } catch (e: any) {
      error.value = e.message || 'Failed to create tag'
      return null
    }
  }

  async function updateTag(id: string, updates: { name?: string; parent_tag_id?: string; color?: string }): Promise<Tag | null> {
    try {
      const response = await $fetch<{ tag: Tag }>(`/api/tags/${id}`, {
        method: 'PUT',
        body: updates,
      })
      await fetchTags()
      return response.tag
    } catch (e: any) {
      error.value = e.message || 'Failed to update tag'
      return null
    }
  }

  async function deleteTag(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/tags/${id}`, {
        method: 'DELETE',
      })
      tags.value = tags.value.filter(t => t.id !== id)
      return true
    } catch (e: any) {
      error.value = e.message || 'Failed to delete tag'
      return false
    }
  }

  async function addTagsToBookmark(bookmarkId: string, tagIds: string[]): Promise<boolean> {
    try {
      await $fetch(`/api/bookmarks/${bookmarkId}/tags`, {
        method: 'POST',
        body: { tag_ids: tagIds },
      })
      return true
    } catch (e: any) {
      error.value = e.message || 'Failed to add tags'
      return false
    }
  }

  async function removeTagsFromBookmark(bookmarkId: string, tagIds: string[]): Promise<boolean> {
    try {
      await $fetch(`/api/bookmarks/${bookmarkId}/tags`, {
        method: 'DELETE',
        body: { tag_ids: tagIds },
      })
      return true
    } catch (e: any) {
      error.value = e.message || 'Failed to remove tags'
      return false
    }
  }

  return {
    tags,
    loading,
    error,
    fetchTags,
    fetchTagTree,
    createTag,
    updateTag,
    deleteTag,
    addTagsToBookmark,
    removeTagsFromBookmark,
  }
}
