import { execSync } from 'child_process'

export default defineEventHandler(() => {
  // Vercel provides this environment variable automatically
  const vercelCommit = process.env.VERCEL_GIT_COMMIT_SHA
  if (vercelCommit) {
    return { version: vercelCommit }
  }

  // Fallback to local git command
  try {
    const hash = execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
      timeout: 5000
    }).trim()
    return { version: hash }
  } catch {
    return { version: 'unknown' }
  }
})
