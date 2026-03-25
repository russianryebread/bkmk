<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Tags</h1>
      <button @click="showCreateModal = true" class="btn-primary">
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
      <button @click="showCreateModal = true" class="btn-primary">Create Tag</button>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              :style="{ backgroundColor: tag.color }"
            ></div>
            <span class="font-medium text-gray-900 dark:text-white">{{ tag.name }}</span>
            <span class="text-sm text-gray-500">({{ tag.bookmark_count || 0 }})</span>
          </div>
          
          <div class="flex items-center gap-2">
            <button
              @click="editTag(tag)"
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

    <!-- Create/Edit Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
              Parent Tag (optional)
            </label>
            <select v-model="form.parent_tag_id" class="input">
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
                :style="{ backgroundColor: color }"
              ></button>
            </div>
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
interface Tag {
  id: string
  name: string
  parent_tag_id: string | null
  color: string | null
  created_at: string
  bookmark_count?: number
}

const tags = ref<Tag[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const editingTag = ref<Tag | null>(null)
const formError = ref('')
const saving = ref(false)

const form = ref({
  name: '',
  parent_tag_id: '',
  color: '',
})

const colors = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
]

const availableParentTags = computed(() => {
  return tags.value.filter(t => !editingTag.value || t.id !== editingTag.value.id)
})

async function loadTags() {
  loading.value = true
  try {
    const response = await $fetch<{ tags: Tag[] }>('/api/tags')
    tags.value = response.tags
  } catch (e) {
    console.error('Failed to load tags:', e)
  } finally {
    loading.value = false
  }
}

function closeModal() {
  showCreateModal.value = false
  editingTag.value = null
  form.value = { name: '', parent_tag_id: '', color: '' }
  formError.value = ''
}

function editTag(tag: Tag) {
  editingTag.value = tag
  form.value = {
    name: tag.name,
    parent_tag_id: tag.parent_tag_id || '',
    color: tag.color || '',
  }
  showCreateModal.value = true
}

async function saveTag() {
  formError.value = ''
  saving.value = true
  
  try {
    if (editingTag.value) {
      await $fetch(`/api/tags/${editingTag.value.id}`, {
        method: 'PUT',
        body: {
          name: form.value.name,
          parent_tag_id: form.value.parent_tag_id || null,
          color: form.value.color || null,
        },
      })
    } else {
      await $fetch('/api/tags', {
        method: 'POST',
        body: {
          name: form.value.name,
          parent_tag_id: form.value.parent_tag_id || null,
          color: form.value.color || null,
        },
      })
    }
    closeModal()
    loadTags()
  } catch (e: any) {
    formError.value = e.data?.message || 'Failed to save tag'
  } finally {
    saving.value = false
  }
}

async function deleteTagConfirm(tag: Tag) {
  if (confirm(`Delete tag "${tag.name}"? This will remove it from all bookmarks.`)) {
    try {
      await $fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
      tags.value = tags.value.filter(t => t.id !== tag.id)
    } catch (e: any) {
      alert(e.data?.message || 'Failed to delete tag')
    }
  }
}

onMounted(() => {
  loadTags()
})
</script>
