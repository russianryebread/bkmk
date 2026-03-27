<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Secret Notes</h1>
      <button @click="showCreateModal = true" class="btn-primary">
        <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Secret
      </button>
    </div>

    <!-- Offline Indicator -->
    <div v-if="!offlineSecrets.isOnline.value" class="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
      <span class="font-medium">Offline Mode:</span> Changes will sync when you're back online.
    </div>

    <!-- Error message -->
    <div v-if="offlineSecrets.offlineError.value" class="mb-4 p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg text-sm">
      {{ offlineSecrets.offlineError.value }}
    </div>

    <!-- Secrets List -->
    <div v-if="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <div v-else-if="secrets.length === 0" class="card p-12 text-center">
      <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No secret notes yet</h3>
      <p class="text-gray-500 dark:text-gray-400 mb-4">Create a password-protected note</p>
      <button @click="showCreateModal = true" class="btn-primary">Create Secret</button>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="secret in secrets"
        :key="secret.id"
        class="card p-4 hover:shadow-md transition-shadow cursor-pointer"
        @click="openSecret(secret)"
      >
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-medium text-gray-900 dark:text-white">{{ secret.title }}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Last accessed: {{ secret.lastAccessedAt ? formatDate(secret.lastAccessedAt) : 'Never' }}
            </p>
          </div>
          <button
            @click.stop="deleteSecretConfirm(secret)"
            class="p-1 text-gray-400 hover:text-red-600"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="card max-w-md w-full p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Create Secret Note</h2>
          <button @click="closeCreateModal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form @submit.prevent="createSecret">
          <input
            v-model="form.title"
            type="text"
            placeholder="Title"
            class="input mb-4"
            required
          />
          <textarea
            v-model="form.content"
            placeholder="Content (optional)"
            class="input mb-4 h-32"
          ></textarea>
          <input
            v-model="form.password"
            type="password"
            placeholder="Password (min 4 characters)"
            class="input mb-4"
            required
            minlength="4"
          />
          <input
            v-model="form.confirmPassword"
            type="password"
            placeholder="Confirm password"
            class="input mb-4"
            required
          />
          <p v-if="formError" class="text-red-600 text-sm mb-4">{{ formError }}</p>
          <div class="flex gap-2">
            <button type="button" @click="closeCreateModal" class="btn-secondary flex-1">Cancel</button>
            <button type="submit" class="btn-primary flex-1" :disabled="creating">Create</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Password Modal -->
    <div v-if="showPasswordModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="card max-w-md w-full p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ selectedSecret?.title }}</h2>
          <button @click="closePasswordModal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form @submit.prevent="verifyPassword">
          <input
            v-model="passwordInput"
            type="password"
            placeholder="Enter password"
            class="input mb-4"
            required
          />
          <p v-if="passwordError" class="text-red-600 text-sm mb-4">{{ passwordError }}</p>
          <div class="flex gap-2">
            <button type="button" @click="closePasswordModal" class="btn-secondary flex-1">Cancel</button>
            <button type="submit" class="btn-primary flex-1">Unlock</button>
          </div>
        </form>
      </div>
    </div>

    <!-- View Modal -->
    <div v-if="showViewModal && unlockedContent" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="card max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ selectedSecret?.title }}</h2>
          <button @click="closeViewModal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="flex-1 overflow-auto p-4">
          <pre class="whitespace-pre-wrap font-mono text-sm">{{ unlockedContent }}</pre>
        </div>
        
        <div class="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button @click="copyContent" class="btn-secondary">Copy Content</button>
          <button @click="closeViewModal" class="btn-primary">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOfflineSecrets } from '~/composables/useOfflineSecrets'
import type { Secret } from '~/composables/idb'

const offlineSecrets = useOfflineSecrets()

const secrets = ref<Secret[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const showPasswordModal = ref(false)
const showViewModal = ref(false)
const selectedSecret = ref<Secret | null>(null)
const unlockedContent = ref('')
const passwordInput = ref('')
const passwordError = ref('')

const form = ref({
  title: '',
  content: '',
  password: '',
  confirmPassword: '',
})
const formError = ref('')
const creating = ref(false)

async function loadSecrets() {
  loading.value = true
  try {
    secrets.value = await offlineSecrets.getSecrets()
  } catch (e) {
    console.error('Failed to load secrets:', e)
  } finally {
    loading.value = false
  }
}

function closeCreateModal() {
  showCreateModal.value = false
  form.value = { title: '', content: '', password: '', confirmPassword: '' }
  formError.value = ''
}

async function createSecret() {
  formError.value = ''
  
  if (form.value.password !== form.value.confirmPassword) {
    formError.value = 'Passwords do not match'
    return
  }
  
  creating.value = true
  
  try {
    await offlineSecrets.createSecret({
      title: form.value.title,
      content: form.value.content,
      password: form.value.password,
    })
    closeCreateModal()
    loadSecrets()
  } catch (e: any) {
    formError.value = e.message || 'Failed to create secret'
  } finally {
    creating.value = false
  }
}

function openSecret(secret: Secret) {
  selectedSecret.value = secret
  showPasswordModal.value = true
  passwordInput.value = ''
  passwordError.value = ''
}

function closePasswordModal() {
  showPasswordModal.value = false
  passwordInput.value = ''
  passwordError.value = ''
}

async function verifyPassword() {
  if (!selectedSecret.value) return
  
  try {
    const response = await offlineSecrets.unlockSecret(selectedSecret.value.id, passwordInput.value)
    unlockedContent.value = response?.content || ''
    showPasswordModal.value = false
    showViewModal.value = true
  } catch (e: any) {
    passwordError.value = e.message || 'Invalid password'
  }
}

function closeViewModal() {
  showViewModal.value = false
  unlockedContent.value = ''
}

function copyContent() {
  navigator.clipboard.writeText(unlockedContent.value)
}

async function deleteSecretConfirm(secret: Secret) {
  const password = prompt('Enter password to delete:')
  if (!password) return
  
  try {
    await offlineSecrets.deleteSecret(secret.id, password)
    secrets.value = secrets.value.filter(s => s.id !== secret.id)
  } catch (e: any) {
    alert(e.message || 'Failed to delete')
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString()
}

onMounted(() => {
  loadSecrets()
})
</script>
