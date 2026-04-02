import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async () => {
  const filePath = join(process.cwd(), 'API.md')
  const content = await readFile(filePath, 'utf-8')
  return content
})
