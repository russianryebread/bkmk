// Centralized Tag System Composable
// Thin facade over useDataStore for tag CRUD + tree/color/filter helpers.
// All mutations and reads flow through the Pinia store so there is a single
// source of truth for tag state across the app.

import { storeToRefs } from 'pinia'
import { useDataStore } from '~/stores/useDataStore'
import type { Tag, TagNode, TagType } from './idb'
import { tagColorsMap, defaultColors } from '~/utils/tagColors'

export function useTagSystem() {
  const dataStore = useDataStore()
  const { tags, syncStatus, isOnline } = storeToRefs(dataStore)

  // ==================== TREE STRUCTURE ====================

  function buildTree(tagList: Tag[], filterType?: TagType): TagNode[] {
    let filtered = tagList
    if (filterType && filterType !== 'both') {
      filtered = tagList.filter(t => t.type === filterType || t.type === 'both')
    }

    const tagMap = new Map<string, TagNode>()
    const rootTags: TagNode[] = []

    filtered.forEach(tag => {
      tagMap.set(tag.id, { ...tag, children: [], depth: 0, expanded: false })
    })

    filtered.forEach(tag => {
      const node = tagMap.get(tag.id)!
      if (tag.parentTagId && tagMap.has(tag.parentTagId)) {
        const parent = tagMap.get(tag.parentTagId)!
        parent.children.push(node)
        node.depth = parent.depth + 1
      } else {
        rootTags.push(node)
      }
    })

    const sortChildren = (nodes: TagNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name))
      nodes.forEach(node => sortChildren(node.children))
    }
    sortChildren(rootTags)

    return rootTags
  }

  function flattenTree(tree: TagNode[]): TagNode[] {
    const result: TagNode[] = []
    const flatten = (nodes: TagNode[]) => {
      nodes.forEach(node => {
        result.push(node)
        if (node.children.length > 0) flatten(node.children)
      })
    }
    flatten(tree)
    return result
  }

  // ==================== FILTERING ====================

  function getTagsByType(type: TagType): Tag[] {
    if (type === 'both') return tags.value
    return tags.value.filter(t => t.type === type || t.type === 'both')
  }

  function searchTags(query: string, filterType?: TagType): Tag[] {
    let result = tags.value
    if (filterType && filterType !== 'both') {
      result = result.filter(t => t.type === filterType || t.type === 'both')
    }
    if (query) {
      const lowerQuery = query.toLowerCase()
      result = result.filter(t => t.name.toLowerCase().includes(lowerQuery))
    }
    return result
  }

  // ==================== COLORS ====================

  function getTagColor(tagName: string): { bg: string; text: string } {
    const tag = tags.value.find(t => t.name.toLowerCase() === tagName.toLowerCase())
    if (tag && tag.color && tagColorsMap[tag.color]) {
      return tagColorsMap[tag.color]!
    }
    const hash = tagName.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return defaultColors[hash % defaultColors.length]!
  }

  function getTagColorsMap() {
    return tagColorsMap
  }

  // ==================== CRUD (delegates to store) ====================

  // The store hydrates tags from IDB at boot and pulls from the server on init,
  // so callers no longer need to manually fetch. Kept for back-compat — a
  // forceRefresh triggers a server sync.
  async function fetchTags(forceRefresh = false): Promise<Tag[]> {
    if (forceRefresh) {
      await dataStore.triggerSync()
    }
    return tags.value
  }

  async function createTag(data: {
    name: string
    parentTagId?: string | null
    color?: string | null
    type?: TagType
    description?: string | null
    icon?: string | null
  }): Promise<Tag | null> {
    return dataStore.createTag(data)
  }

  async function updateTag(id: string, data: {
    name?: string
    parentTagId?: string | null
    color?: string | null
    type?: TagType
    description?: string | null
    icon?: string | null
  }): Promise<boolean> {
    return dataStore.updateTag(id, data as Partial<Tag>)
  }

  async function deleteTag(id: string): Promise<boolean> {
    return dataStore.deleteTag(id)
  }

  // ==================== TREE INTERACTION ====================

  function toggleNodeExpanded(nodeId: string, tree: TagNode[]): void {
    const findAndToggle = (nodes: TagNode[]): boolean => {
      for (const node of nodes) {
        if (node.id === nodeId) {
          node.expanded = !node.expanded
          return true
        }
        if (node.children.length > 0 && findAndToggle(node.children)) return true
      }
      return false
    }
    findAndToggle(tree)
  }

  function expandAll(tree: TagNode[]): void {
    const expand = (nodes: TagNode[]) => {
      nodes.forEach(node => {
        node.expanded = true
        if (node.children.length > 0) expand(node.children)
      })
    }
    expand(tree)
  }

  function collapseAll(tree: TagNode[]): void {
    const collapse = (nodes: TagNode[]) => {
      nodes.forEach(node => {
        node.expanded = false
        if (node.children.length > 0) collapse(node.children)
      })
    }
    collapse(tree)
  }

  return {
    // State (reactive, store-backed)
    tags,
    isOnline,
    loading: computed(() => syncStatus.value === 'syncing'),

    // Tree
    buildTree,
    flattenTree,
    toggleNodeExpanded,
    expandAll,
    collapseAll,

    // Filtering
    getTagsByType,
    searchTags,

    // Colors
    getTagColor,
    getTagColorsMap,
    tagColorsMap,

    // CRUD
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
  }
}
