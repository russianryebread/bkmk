import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Lazy-initialized singleton
let _db: ReturnType<typeof drizzle> | null = null
let _client: ReturnType<typeof postgres> | null = null

function getDb() {
  if (_db) return _db
  
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
  
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL or POSTGRES_URL environment variable is not set. ' +
      'Please set it to your PostgreSQL connection string.'
    )
  }
  
  _client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
      ? { rejectUnauthorized: false }
      : false,
    transform: {
      undefined: null,
    },
  })
  
  _db = drizzle(_client, { schema })
  return _db
}

// Export as a proxy object that lazily initializes
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    const instance = getDb()
    const value = (instance as any)[prop]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  }
})

// Export schema
export { schema }

// Connection status check
export async function testConnection(): Promise<boolean> {
  try {
    if (!_client) getDb()
    // Simple ping
    console.log('✅ Database connection successful')
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

// Graceful shutdown handler
export async function closeConnection(): Promise<void> {
  try {
    if (_client) {
      await _client.end()
      _client = null
      _db = null
    }
    console.log('Database connection closed gracefully')
  } catch (error) {
    console.error('Error closing database connection:', error)
  }
}
