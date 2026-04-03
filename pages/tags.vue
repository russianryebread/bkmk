<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Tags</h1>
      <button @click="openCreateModal()" class="btn-primary">
        <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Tag
      </button>
    </div>

    <!-- Tags List -->
    <div v-if="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <div v-else-if="tags.length === 0" class="card p-12 text-center">
      <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No tags yet</h3>
      <p class="text-gray-500 dark:text-gray-400 mb-4">Create tags to organize your bookmarks</p>
      <button @click="openCreateModal()" class="btn-primary">Create Tag</button>
    </div>

    <div v-else>
      <!-- Type filter tabs -->
      <div class="flex gap-2 mb-4">
        <button
          @click="filterType = 'both'"
          :class="['px-3 py-1 text-sm rounded-full transition-colors', filterType === 'both' ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300']"
        >
          All
        </button>
        <button
          @click="filterType = 'bookmark'"
          :class="['px-3 py-1 text-sm rounded-full transition-colors', filterType === 'bookmark' ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300']"
        >
          Bookmarks
        </button>
        <button
          @click="filterType = 'note'"
          :class="['px-3 py-1 text-sm rounded-full transition-colors', filterType === 'note' ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300']"
        >
          Notes
        </button>
      </div>

      <!-- Tags List -->
      <div class="space-y-2">
        <div
          v-for="tag in tags"
          :key="tag.id"
          class="card p-4 hover:shadow-md transition-shadow"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                v-if="tag.color"
                class="w-4 h-4 rounded-full"
                :style="{ backgroundColor: colorHexMap[tag.color] || tag.color }"
              ></div>
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-900 dark:text-white">{{ tag.name }}</span>
                  <span v-if="tag.type && tag.type !== 'both'" class="px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {{ tag.type }}
                  </span>
                </div>
                <span v-if="tag.description" class="text-sm text-gray-500 dark:text-gray-400">{{ tag.description }}</span>
              </div>
              <span class="text-sm text-gray-500">({{ tag.bookmarkCount || 0 }})</span>
            </div>
            
            <div class="flex items-center gap-2">
              <button
                @click="openEditModal(tag)"
                class="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                @click="deleteTagConfirm(tag)"
                class="p-1 text-gray-400 hover:text-red-600"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="card max-w-md w-full p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">
            {{ editingTag ? 'Edit Tag' : 'Create Tag' }}
          </h2>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form @submit.prevent="saveTag">
          <input
            v-model="form.name"
            type="text"
            placeholder="Tag name"
            class="input mb-4"
            required
          />
          
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tag Type
            </label>
            <select v-model="form.type" class="input">
              <option value="both">Both (Bookmarks & Notes)</option>
              <option value="bookmark">Bookmarks Only</option>
              <option value="note">Notes Only</option>
            </select>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Parent Tag (optional)
            </label>
            <select v-model="form.parentTagId" class="input">
              <option value="">None</option>
              <option v-for="tag in availableParentTags" :key="tag.id" :value="tag.id">
                {{ tag.name }}
              </option>
            </select>
          </div>
          
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color (optional)
            </label>
            <div class="flex gap-2">
              <button
                v-for="color in colors"
                :key="color"
                type="button"
                @click="form.color = form.color === color ? '' : color"
                class="w-8 h-8 rounded-full border-2"
                :class="form.color === color ? 'border-gray-900' : 'border-transparent'"
                :style="{ backgroundColor: colorHexMap[color] }"
              ></button>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (optional)
            </label>
            <input
              v-model="form.description"
              type="text"
              placeholder="Brief description"
              class="input"
            />
          </div>
          
          <p v-if="formError" class="text-red-600 text-sm mb-4">{{ formError }}</p>
          <div class="flex gap-2">
            <button type="button" @click="closeModal" class="btn-secondary flex-1">Cancel</button>
            <button type="submit" class="btn-primary flex-1" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTagSystem, type Tag, type TagNode, type TagType } from '~/composables/useTagSystem'

const {
  tags,
  loading,
  isOnline,
  error: offlineError,
  fetchTags,
  createTag,
  updateTag,
  deleteTag,
  buildTree,
  flattenTree,
  toggleNodeExpanded,
  expandAll,
  collapseAll,
  getTagColor,
} = useTagSystem()

const showModal = ref(false)
const editingTag = ref<Tag | null>(null)
const formError = ref('')
const saving = ref(false)
const filterType = ref<TagType>('both')
const tagTree = ref<TagNode[]>([])

const form = ref({
  name: '',
  parentTagId: '',
  color: '',
  type: 'both' as TagType,
  description: '',
  icon: '',
})

const colors = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'gray',
]

const colorHexMap: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
  gray: '#6b7280',
}

const availableParentTags = computed(() => {
  return tags.value.filter(t => !editingTag.value || t.id !== editingTag.value.id)
})

// Build tree when tags change
watch([tags, filterType], () => {
  tagTree.value = buildTree(tags.value, filterType.value)
}, { immediate: true })

async function loadTags() {
  await fetchTags(true)
}

function handleExpandAll() {
  expandAll(tagTree.value)
}

function handleCollapseAll() {
  collapseAll(tagTree.value)
}

function handleToggleNode(nodeId: string) {
  toggleNodeExpanded(nodeId, tagTree.value)
}

function openCreateModal() {
  editingTag.value = null
  form.value = {
    name: '',
    parentTagId: '',
    color: '',
    type: filterType.value === 'both' ? 'both' : filterType.value,
    description: '',
    icon: '',
  }
  showModal.value = true
}

function openEditModal(tag: Tag) {
  editingTag.value = tag
  form.value = {
    name: tag.name,
    parentTagId: tag.parentTagId || '',
    color: tag.color || '',
    type: tag.type || 'both',
    description: tag.description || '',
    icon: tag.icon || '',
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingTag.value = null
  form.value = {
    name: '',
    parentTagId: '',
    color: '',
    type: 'both' as TagType,
    description: '',
    icon: '',
  }
  formError.value = ''
}

async function saveTag() {
  formError.value = ''
  saving.value = true
  
  try {
    if (editingTag.value) {
      await updateTag(editingTag.value.id, {
        name: form.value.name,
        parentTagId: form.value.parentTagId || null,
        color: form.value.color || null,
        type: form.value.type,
        description: form.value.description || null,
        icon: form.value.icon || null,
      })
    } else {
      await createTag({
        name: form.value.name,
        parentTagId: form.value.parentTagId || null,
        color: form.value.color || null,
        type: form.value.type,
        description: form.value.description || null,
        icon: form.value.icon || null,
      })
    }
    closeModal()
    await loadTags()
  } catch (e: any) {
    formError.value = e.message || 'Failed to save tag'
  } finally {
    saving.value = false
  }
}

async function deleteTagConfirm(tag: Tag) {
  if (confirm(`Delete tag "${tag.name}"? This will remove it from all bookmarks and notes.`)) {
    try {
      await deleteTag(tag.id)
    } catch (e: any) {
      alert(e.message || 'Failed to delete tag')
    }
  }
}

onMounted(() => {
  loadTags()
})
</script>
