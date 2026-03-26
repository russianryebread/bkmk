import { existsSync, realpathSync, createReadStream } from 'node:fs'
import { join, extname } from 'node:path'

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(event, 'filename')
  if (!filename) {
    throw createError({ statusCode: 400, message: 'Filename is required' })
  }
  
  // Sanitize filename to prevent directory traversal
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '')
  
  const imagePath = join(process.cwd(), 'server/database/images', sanitizedFilename)
  
  // Verify the file exists and is within the images directory
  if (!existsSync(imagePath)) {
    throw createError({ statusCode: 404, message: 'Image not found' })
  }
  
  const realPath = realpathSync(imagePath)
  const imagesDir = realpathSync(join(process.cwd(), 'server/database/images'))
  
  if (!realPath.startsWith(imagesDir)) {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }
  
  const ext = extname(sanitizedFilename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  }
  
  const contentType = mimeTypes[ext] || 'application/octet-stream'
  
  return sendStream(event, createReadStream(imagePath), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    }
  })
})
