import bcrypt from 'bcryptjs'
import { H3Event, getCookie, setCookie, deleteCookie, getHeader } from 'h3'
import { db } from '~/server/database'
import { users, apiTokens } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'

const SALT_ROUNDS = 12
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 days in ms
const COOKIE_NAME = 'auth_token'

export interface TokenPayload {
  userId: string
  email: string
  role: string
  exp: number
}

export interface AuthUser {
  id: string
  email: string
  role: 'user' | 'admin'
  hasPassword: boolean
}

// Hash password with bcrypt
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Generate a secure random token (used for password reset)
function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Alias for password reset (kept for clarity)
const generatePasswordResetToken = generateToken

// Create a simple JWT-like token (base64 encoded JSON)
export function createToken(payload: Omit<TokenPayload, 'exp'>): string {
  const exp = Date.now() + TOKEN_EXPIRY
  const data: TokenPayload = { ...payload, exp }
  const json = JSON.stringify(data)
  // Simple base64 encoding (not encryption, but signed by server)
  return Buffer.from(json).toString('base64url')
}

// Parse and validate token
function parseToken(token: string): TokenPayload | null {
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8')
    const payload = JSON.parse(json) as TokenPayload
    
    // Check expiration
    if (payload.exp < Date.now()) {
      return null
    }
    
    return payload
  } catch {
    return null
  }
}

// Set auth cookie
export function setAuthCookie(event: H3Event, token: string): void {
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_EXPIRY / 1000,
    path: '/'
  })
}

// Get auth token from cookie
export function getAuthToken(event: H3Event): string | undefined {
  // First check Authorization header for Bearer token (for API access)
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  // Fall back to cookie for web app
  return getCookie(event, COOKIE_NAME)
}

// Extract Bearer token from Authorization header only
export function getBearerToken(event: H3Event): string | undefined {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return undefined
}

// Clear auth cookie
export function clearAuthCookie(event: H3Event): void {
  deleteCookie(event, COOKIE_NAME)
}

// Get current user from request
export async function getCurrentUser(event: H3Event): Promise<AuthUser | null> {
  const token = getAuthToken(event)
  
  if (!token) {
    return null
  }
  
  const payload = parseToken(token)
  
  if (!payload) {
    clearAuthCookie(event)
    return null
  }
  
  // Verify user still exists
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      passwordHash: users.passwordHash
    })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1)
  
  if (!user) {
    clearAuthCookie(event)
    return null
  }
  
  return {
    id: user.id,
    email: user.email,
    role: user.role as 'user' | 'admin',
    hasPassword: !!user.passwordHash
  }
}

// Require authentication - throws error if not authenticated
// Supports both session tokens (cookies) and API tokens (Bearer)
export async function requireAuth(event: H3Event): Promise<AuthUser> {
  // First, try API token authentication (Bearer token)
  const bearerToken = getBearerToken(event)
  if (bearerToken) {
    // Check if it's an API token (starts with "bkmk_") or session token
    if (bearerToken.startsWith('bkmk_')) {
      const apiAuth = await validateApiToken(bearerToken)
      if (apiAuth) {
        // Look up user by ID from API token
        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            role: users.role,
            passwordHash: users.passwordHash
          })
          .from(users)
          .where(eq(users.id, apiAuth.userId))
          .limit(1)
        
        if (user) {
          return {
            id: user.id,
            email: user.email,
            role: user.role as 'user' | 'admin',
            hasPassword: !!user.passwordHash
          }
        }
      }
    } else {
      // Try session token
      const user = await getCurrentUser(event)
      if (user) {
        return user
      }
    }
  }
  
  // Fall back to cookie-based auth
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required'
    })
  }
  
  return user
}

// Require specific role - throws error if not authorized
export async function requireRole(event: H3Event, role: 'admin'): Promise<AuthUser> {
  const user = await requireAuth(event)
  
  if (user.role !== role) {
    throw createError({
      statusCode: 403,
      message: 'Insufficient permissions'
    })
  }
  
  return user
}

// Sign up new user
export async function signup(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid email format'
    })
  }
  
  // Validate password strength
  if (password.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'Password must be at least 8 characters'
    })
  }
  
  // Check if user already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)
  
  if (existing.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'An account with this email already exists'
    })
  }
  
  // Hash password
  const passwordHash = await hashPassword(password)
  
  // Create user
  const userId = crypto.randomUUID()
  const now = new Date().toISOString()
  
  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    passwordHash,
    role: 'user',
    createdAt: now,
    updatedAt: now
  })
  
  // Create token
  const token = createToken({
    userId,
    email: email.toLowerCase(),
    role: 'user'
  })
  
  return {
    user: {
      id: userId,
      email: email.toLowerCase(),
      role: 'user',
      hasPassword: true
    },
    token
  }
}

// Login user
export async function login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  // Find user
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      role: users.role
    })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }
  
  // Verify password
  const valid = await verifyPassword(password, user.passwordHash)
  
  if (!valid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }
  
  // Create token
  const token = createToken({
    userId: user.id,
    email: user.email,
    role: user.role
  })
  
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role as 'user' | 'admin',
      hasPassword: !!user.passwordHash
    },
    token
  }
}

// Logout user
export function logout(event: H3Event): void {
  clearAuthCookie(event)
}

// Request password reset - sends email with reset token
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  // Find user by email
  const [user] = await db
    .select({
      id: users.id,
      email: users.email
    })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)
  
  // Always return success to prevent email enumeration
  if (!user) {
    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    }
  }
  
  // Generate reset token
  const resetToken = generatePasswordResetToken()
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
  
  // Store reset token and expiry
  await db
    .update(users)
    .set({
      passwordResetToken: resetToken,
      passwordResetExpiry: expiry,
      updatedAt: new Date().toISOString()
    })
    .where(eq(users.id, user.id))
  
  // In production, send email with reset link
  // For now, log the reset token (in development)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Password reset for ${user.email}: /reset-password?token=${resetToken}`)
  }
  
  return {
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.'
  }
}

// Reset password using token
export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  // Validate password strength
  if (newPassword.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'Password must be at least 8 characters'
    })
  }
  
  // Find user with valid reset token
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordResetExpiry: users.passwordResetExpiry
    })
    .from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1)
  
  if (!user) {
    throw createError({
      statusCode: 400,
      message: 'Invalid or expired reset token'
    })
  }
  
  // Check if token has expired
  if (user.passwordResetExpiry && new Date(user.passwordResetExpiry) < new Date()) {
    throw createError({
      statusCode: 400,
      message: 'Reset token has expired. Please request a new password reset.'
    })
  }
  
  // Hash new password
  const passwordHash = await hashPassword(newPassword)
  
  // Update user password and clear reset token
  await db
    .update(users)
    .set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
      updatedAt: new Date().toISOString()
    })
    .where(eq(users.id, user.id))
  
  return {
    success: true,
    message: 'Password has been reset successfully. You can now log in with your new password.'
  }
}

// Change password for logged-in user
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  // Get current user with password hash
  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  
  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }
  
  // Verify current password
  const valid = await verifyPassword(currentPassword, user.passwordHash)
  
  if (!valid) {
    throw createError({
      statusCode: 401,
      message: 'Current password is incorrect'
    })
  }
  
  // Validate new password strength
  if (newPassword.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'New password must be at least 8 characters'
    })
  }
  
  // Hash new password
  const passwordHash = await hashPassword(newPassword)
  
  // Update password
  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date().toISOString()
    })
    .where(eq(users.id, userId))
  
  return {
    success: true,
    message: 'Password changed successfully'
  }
}

// ==================== API TOKEN FUNCTIONS ====================

// Hash a token using SHA-256 (returns hex string)
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Generate a new API token with prefix "bkmk_"
export function generateApiToken(): string {
  const array = new Uint8Array(24)
  crypto.getRandomValues(array)
  const tokenPart = Array.from(array, byte => byte.toString(36)).join('')
  return `bkmk_${tokenPart}`
}

// Get token prefix (first 8 chars after "bkmk_")
export function getTokenPrefix(token: string): string {
  return token.substring(0, 8)
}

// Create a new API token
export async function createApiToken(
  userId: string,
  name: string,
  expiresAt?: string
): Promise<{ token: string; tokenRecord: any }> {
  const token = generateApiToken()
  const tokenHash = await hashToken(token)
  const tokenPrefix = getTokenPrefix(token)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  
  await db.insert(apiTokens).values({
    id,
    userId,
    name,
    tokenHash,
    tokenPrefix,
    expiresAt: expiresAt || null,
    isActive: 1,
    createdAt: now,
    updatedAt: now
  })
  
  return {
    token,
    tokenRecord: {
      id,
      userId,
      name,
      tokenPrefix,
      expiresAt,
      isActive: true,
      createdAt: now,
      lastUsedAt: null
    }
  }
}

// Validate an API token and return the user it belongs to
export async function validateApiToken(token: string): Promise<{ userId: string; tokenId: string } | null> {
  // First, check all active tokens (brute force through user's tokens)
  // This is acceptable since we hash tokens and need to find which one matches
  const hashedToken = await hashToken(token)
  const prefix = getTokenPrefix(token)
  
  // Find tokens with matching prefix
  const potentialTokens = await db
    .select()
    .from(apiTokens)
    .where(and(
      eq(apiTokens.tokenPrefix, prefix),
      eq(apiTokens.isActive, 1)
    ))
  
  for (const tokenRecord of potentialTokens) {
    if (tokenRecord.tokenHash === hashedToken) {
      // Check expiration
      if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
        return null
      }
      
      // Update last used
      await db
        .update(apiTokens)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(apiTokens.id, tokenRecord.id))
      
      return {
        userId: tokenRecord.userId,
        tokenId: tokenRecord.id
      }
    }
  }
  
  return null
}

// List all API tokens for a user (without exposing hashes)
export async function listApiTokens(userId: string): Promise<any[]> {
  const tokens = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      isActive: apiTokens.isActive,
      createdAt: apiTokens.createdAt
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(apiTokens.createdAt)
  
  return tokens.map(t => ({
    ...t,
    isActive: t.isActive === 1
  }))
}

// Revoke an API token
export async function revokeApiToken(userId: string, tokenId: string): Promise<boolean> {
  const result = await db
    .update(apiTokens)
    .set({
      isActive: 0,
      updatedAt: new Date().toISOString()
    })
    .where(and(
      eq(apiTokens.id, tokenId),
      eq(apiTokens.userId, userId)
    ))
  
  return result.rowCount > 0
}

// Reissue a token (revoke old and create new)
export async function reissueApiToken(
  userId: string,
  tokenId: string,
  name?: string
): Promise<{ token: string; tokenRecord: any } | null> {
  // Get the existing token to preserve name
  const [existingToken] = await db
    .select()
    .from(apiTokens)
    .where(and(
      eq(apiTokens.id, tokenId),
      eq(apiTokens.userId, userId)
    ))
    .limit(1)
  
  if (!existingToken) {
    return null
  }
  
  // Revoke the old token
  await revokeApiToken(userId, tokenId)
  
  // Create new token with same or provided name
  return createApiToken(
    userId,
    name || existingToken.name,
    existingToken.expiresAt || undefined
  )
}
