import { ref } from 'vue'
export const authenticated = ref(false)
export const mode = ref('success')
export const requests = ref<string[]>([])
const records: Record<string, Map<string, any>> = {notes: new Map(), bookmarks: new Map(), tags: new Map()}
export const useAuth = () => ({isAuthenticated: authenticated})
export async function $fetch(path: string, options: any = {}) {
  requests.value.push(path)
  if (mode.value === '500') throw Object.assign(new Error('Server unavailable'), {statusCode: 500})
  if (mode.value === 'timeout') throw new Error('Request timed out')
  const entity = path.split('/')[2]!.split('?')[0]!
  const rows = records[entity]!
  if (path.endsWith('/batch')) {
    const {create, update, del} = options.body
    for (const row of [...create, ...update]) rows.set(row.id, {...rows.get(row.id), ...row, updatedAt: new Date().toISOString()})
    for (const id of del) rows.delete(id)
    return {created: create, updated: update, deleted: del}
  }
  return {[entity]: [...rows.values()], pagination: {totalPages:1}}
}
