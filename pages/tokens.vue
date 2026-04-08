<template>
  <div>
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">API Tokens</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage API tokens for external access like the iOS share extension
          </p>
        </div>
        <button
          @click="showCreateModal = true"
          class="btn-primary"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Token
        </button>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
        <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      </div>

      <!-- Success Message -->
      <div v-if="success" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
        <p class="text-sm text-green-600 dark:text-green-400">{{ success }}</p>
      </div>

      <!-- Token List -->
      <div v-if="tokens.length > 0" class="space-y-4">
        <div
          v-for="token in tokens"
          :key="token.id"
          class="card p-4"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h3 class="font-medium text-gray-900 dark:text-white">{{ token.name }}</h3>
                <span
                  :class="[
                    'px-2 py-0.5 text-xs rounded-full',
                    token.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  ]"
                >
                  {{ token.isActive ? 'Active' : 'Revoked' }}
                </span>
              </div>
              <div class="mt-1 text-sm text-gray-500 dark:text-gray-400 font-mono">
                {{ token.tokenPrefix }}•••••••••••••••
              </div>
              <div class="mt-2 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span v-if="token.lastUsedAt">
                  Last used: {{ formatDate(token.lastUsedAt) }}
                </span>
                <span v-else>
                  Never used
                </span>
                <span>Created: {{ formatDate(token.createdAt) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2 ml-4">
              <button
                v-if="token.isActive"
                @click="reissueToken(token)"
                :disabled="reissuingId === token.id"
                class="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                title="Reissue token"
              >
                <svg v-if="reissuingId !== token.id" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </button>
              <button
                v-if="token.isActive"
                @click="revokeToken(token)"
                :disabled="revokingId === token.id"
                class="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                title="Revoke token"
              >
                <svg v-if="revokingId !== token.id" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="card p-8 text-center">
        <svg class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No API tokens yet</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-4">
          Create an API token to use with the iOS share extension or other integrations.
        </p>
        <button @click="showCreateModal = true" class="btn-primary">
          Create your first token
        </button>
      </div>

      <!-- Version Footer -->
      <div class="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
        <p class="text-xs text-gray-400 dark:text-gray-500">
          v{{ version.slice(0, 7) }}
        </p>
      </div>
    </div>

    <!-- Create Token Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="fixed inset-0 bg-black/50" @click="closeCreateModal"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create API Token</h2>
          
          <form @submit.prevent="createToken">
            <div class="mb-4">
              <label for="tokenName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Token Name
              </label>
              <input
                id="tokenName"
                v-model="newTokenName"
                type="text"
                required
                placeholder="e.g., iOS Share Extension"
                class="input"
                :disabled="creating"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Give your token a descriptive name to remember what it's for.
              </p>
            </div>

            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p class="text-xs text-blue-700 dark:text-blue-400">
                <strong>Important:</strong> Your token will only be shown once after creation. Make sure to copy it and store it securely.
              </p>
            </div>

            <div class="flex justify-end gap-3">
              <button
                type="button"
                @click="closeCreateModal"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                :disabled="creating"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="creating || !newTokenName.trim()"
                class="btn-primary"
              >
                {{ creating ? 'Creating...' : 'Create Token' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Reissue Token Modal -->
    <div v-if="showReissueModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="fixed inset-0 bg-black/50" @click="closeReissueModal"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Reissue Token</h2>
          
          <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
            <p class="text-xs text-yellow-700 dark:text-yellow-400">
              <strong>Warning:</strong> The current token will be immediately revoked. Make sure to update any applications using this token.
            </p>
          </div>

          <div class="mb-4">
            <label for="reissueName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Token Name
            </label>
            <input
              id="reissueName"
              v-model="reissueName"
              type="text"
              required
              class="input"
              :disabled="reissuing"
            />
          </div>

          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
            <p class="text-xs text-blue-700 dark:text-blue-400">
              <strong>Important:</strong> The new token will only be shown once. Update your iOS app settings with the new token.
            </p>
          </div>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              @click="closeReissueModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              :disabled="reissuing"
            >
              Cancel
            </button>
            <button
              @click="confirmReissue"
              :disabled="reissuing || !reissueName.trim()"
              class="btn-primary"
            >
              {{ reissuing ? 'Reissuing...' : 'Reissue Token' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- New Token Display Modal -->
    <div v-if="showNewTokenModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="fixed inset-0 bg-black/50"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="text-center mb-4">
            <svg class="w-12 h-12 mx-auto text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Token Created</h2>
          </div>
          
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
            <p class="text-xs text-red-700 dark:text-red-400">
              <strong>Warning:</strong> Copy this token now. You won't be able to see it again!
            </p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your API Token
            </label>
            <div class="flex gap-2">
              <input
                :value="newToken"
                type="text"
                readonly
                class="input font-mono text-sm flex-1"
                ref="tokenInput"
              />
              <button
                @click="copyToken"
                class="btn-secondary"
              >
                {{ copied ? 'Copied!' : 'Copy' }}
              </button>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Token Prefix (for reference)
            </label>
            <div class="input font-mono text-sm bg-gray-50 dark:bg-gray-900">
              {{ newTokenPrefix }}•••••••••••••••
            </div>
          </div>

          <div class="flex justify-center">
            <button
              @click="closeNewTokenModal"
              class="btn-primary"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

interface ApiToken {
  id: string
  name: string
  tokenPrefix: string
  lastUsedAt: string | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

const tokens = ref<ApiToken[]>([])
const error = ref('')
const success = ref('')

// Version state
const version = ref('unknown')

// Create modal state
const showCreateModal = ref(false)
const newTokenName = ref('')
const creating = ref(false)

// Reissue modal state
const showReissueModal = ref(false)
const reissueTokenData = ref<ApiToken | null>(null)
const reissueName = ref('')
const reissuing = ref(false)
const reissuingId = ref<string | null>(null)

// New token display state
const showNewTokenModal = ref(false)
const newToken = ref('')
const newTokenPrefix = ref('')
const copied = ref(false)

// Revoke state
const revokingId = ref<string | null>(null)

// Fetch version
async function fetchVersion() {
  try {
    const response = await $fetch<{ version: string }>('/api/version')
    version.value = response.version
  } catch {
    version.value = 'unknown'
  }
}

// Fetch tokens
async function fetchTokens() {
  try {
    const response = await $fetch<{ tokens: ApiToken[] }>('/api/tokens')
    tokens.value = response.tokens
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to fetch tokens'
  }
}

// Create token
async function createToken() {
  if (!newTokenName.value.trim()) return
  
  creating.value = true
  error.value = ''
  success.value = ''
  
  try {
    const response = await $fetch<{ token: string; tokenRecord: ApiToken }>('/api/tokens', {
      method: 'POST',
      body: { name: newTokenName.value.trim() }
    })
    
    newToken.value = response.token
    newTokenPrefix.value = response.tokenRecord.tokenPrefix
    closeCreateModal()
    showNewTokenModal.value = true
    await fetchTokens()
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to create token'
  } finally {
    creating.value = false
  }
}

// Close create modal
function closeCreateModal() {
  showCreateModal.value = false
  newTokenName.value = ''
}

// Revoke token
async function revokeToken(token: ApiToken) {
  if (!confirm(`Are you sure you want to revoke "${token.name}"? This action cannot be undone.`)) {
    return
  }
  
  revokingId.value = token.id
  error.value = ''
  success.value = ''
  
  try {
    await $fetch(`/api/tokens/${token.id}`, {
      method: 'DELETE'
    })
    
    success.value = 'Token revoked successfully'
    await fetchTokens()
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      success.value = ''
    }, 3000)
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to revoke token'
  } finally {
    revokingId.value = null
  }
}

// Reissue token
function reissueToken(token: ApiToken) {
  reissueTokenData.value = token
  reissueName.value = token.name
  showReissueModal.value = true
}

async function confirmReissue() {
  if (!reissueTokenData.value || !reissueName.value.trim()) return
  
  reissuing.value = true
  reissuingId.value = reissueTokenData.value.id
  error.value = ''
  
  try {
    const response = await $fetch<{ token: string; tokenRecord: ApiToken }>(`/api/tokens/${reissueTokenData.value.id}/reissue`, {
      method: 'POST',
      body: { name: reissueName.value.trim() }
    })
    
    newToken.value = response.token
    newTokenPrefix.value = response.tokenRecord.tokenPrefix
    closeReissueModal()
    showNewTokenModal.value = true
    await fetchTokens()
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to reissue token'
  } finally {
    reissuing.value = false
    reissuingId.value = null
  }
}

function closeReissueModal() {
  showReissueModal.value = false
  reissueTokenData.value = null
  reissueName.value = ''
}

function closeNewTokenModal() {
  showNewTokenModal.value = false
  newToken.value = ''
  newTokenPrefix.value = ''
  copied.value = false
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(newToken.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (e) {
    console.error('Failed to copy:', e)
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Fetch tokens and version on mount
onMounted(() => {
  fetchTokens()
  fetchVersion()
})
</script>
