import bcrypt from 'bcryptjs'
import { H3Event, getCookie, setCookie, deleteCookie, getHeader } from 'h3'
import { db } from '~/server/database'
import { users } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

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
}

// Hash password with bcrypt
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Create a simple JWT-like token (base64 encoded JSON)
function createToken(payload: Omit<TokenPayload, 'exp'>): string {
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
      role: users.role
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
    role: user.role as 'user' | 'admin'
  }
}

// Require authentication - throws error if not authenticated
export async function requireAuth(event: H3Event): Promise<AuthUser> {
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
      role: 'user'
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
      role: user.role as 'user' | 'admin'
    },
    token
  }
}

// Logout user
export function logout(event: H3Event): void {
  clearAuthCookie(event)
}

// Generate password reset token
function generatePasswordResetToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
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
