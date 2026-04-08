import { eq, and } from 'drizzle-orm'
import { db } from '~/server/database'
import { users, userAccounts } from '~/server/database/schema'
import { setAuthCookie, createToken } from '~/server/utils/auth'

interface OAuthProviderConfig {
  name: string
  clientId: string
  clientSecret: string
  authUrl: string
  tokenUrl: string
  userInfoUrl: string
  scopes: string[]
  getUserId: (userInfo: any) => string
  getUserEmail: (userInfo: any) => string
  getUserName: (userInfo: any) => string | undefined
  getUserPicture: (userInfo: any) => string | undefined
}

const providerConfigs: Record<string, OAuthProviderConfig> = {
  google: {
    name: 'Google',
    clientId: '',
    clientSecret: '',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
    getUserId: (u) => u.id,
    getUserEmail: (u) => u.email,
    getUserName: (u) => u.name,
    getUserPicture: (u) => u.picture
  },
  github: {
    name: 'GitHub',
    clientId: '',
    clientSecret: '',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
    getUserId: (u) => String(u.id),
    getUserEmail: (u) => u.email,
    getUserName: (u) => u.name,
    getUserPicture: (u) => u.avatar_url
  },
  apple: {
    name: 'Apple',
    clientId: '',
    clientSecret: '',
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    userInfoUrl: '',
    scopes: ['name', 'email'],
    getUserId: (u) => u.sub,
    getUserEmail: (u) => u.email,
    getUserName: (u) => u.name,
    getUserPicture: () => undefined
  }
}

function getProviderConfig(providerName: string, config: Record<string, string>): OAuthProviderConfig {
  const provider = providerConfigs[providerName.toLowerCase()]
  if (!provider) {
    throw createError({
      statusCode: 400,
      message: `Unknown OAuth provider: ${providerName}`
    })
  }

  // Get credentials - check provider-specific env vars first, then fall back to google
  const upperProvider = providerName.toUpperCase()
  let clientId = process.env[`${upperProvider}_CLIENT_ID`] || process.env.GOOGLE_CLIENT_ID
  let clientSecret = process.env[`${upperProvider}_CLIENT_SECRET`] || process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 500,
      message: `${provider.name} OAuth not configured. Add ${upperProvider}_CLIENT_ID and ${upperProvider}_CLIENT_SECRET to .env`
    })
  }

  return {
    ...provider,
    clientId,
    clientSecret
  }
}

export default defineEventHandler(async (event) => {
  // Get provider from route param
  const routeParams = getRouterParams(event)
  const providerName = routeParams.provider || 'google'
  
  const config = useRuntimeConfig()
  const provider = getProviderConfig(providerName, config)

  const query = getQuery(event)
  const code = query.code as string

  // Check for custom redirect_uri (for mobile apps)
  const customRedirectUri = query.redirect_uri as string
  
  if (!code) {
    // Redirect to OAuth - first time flow
    // Use custom redirect_uri if provided, otherwise use web callback
    const redirectUri = customRedirectUri || `${getRequestURL(event).origin}/api/auth/${providerName}`
    const authUrl = new URL(provider.authUrl)
    authUrl.searchParams.set('client_id', provider.clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', provider.scopes.join(' '))
    authUrl.searchParams.set('state', crypto.randomUUID())

    if (providerName === 'apple') {
      authUrl.searchParams.set('response_mode', 'form_post')
    }

    return sendRedirect(event, authUrl.toString())
  }

  // Callback flow - exchange code for tokens
  // Use custom redirect_uri if it was provided
  const callbackUri = customRedirectUri || `${getRequestURL(event).origin}/api/auth/${providerName}`
  
  const tokenResponse = await $fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json'
    },
    body: {
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUri
    }
  }) as any

  // Get user info
  let userInfo: any
  let userEmail: string

  if (providerName === 'apple') {
    const idToken = tokenResponse.id_token
    const decoded = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString())
    userEmail = provider.getUserEmail(decoded)
    userInfo = decoded
  } else {
    userInfo = await $fetch(provider.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`
      }
    }) as any
    userEmail = provider.getUserEmail(userInfo)
  }

  const providerUserId = provider.getUserId(userInfo)
  const providerUserName = provider.getUserName(userInfo)
  const providerUserPicture = provider.getUserPicture(userInfo)

  // Check if we already have this linked account
  const [existingAccount] = await db
    .select()
    .from(userAccounts)
    .where(
      and(
        eq(userAccounts.provider, providerName),
        eq(userAccounts.providerUserId, providerUserId)
      )
    )
    .limit(1)

  let userId: string

  if (existingAccount) {
    userId = existingAccount.userId
  } else {
    // Check if we have a user with matching email
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, userEmail.toLowerCase()))
      .limit(1)

    if (existingUser) {
      userId = existingUser.id
    } else {
      // Create new user
      userId = crypto.randomUUID()
      const now = new Date().toISOString()
      
      await db.insert(users).values({
        id: userId,
        email: userEmail.toLowerCase(),
        avatarUrl: providerUserPicture || null,
        passwordHash: null,
        role: 'user',
        createdAt: now,
        updatedAt: now
      })
    }

    // Link this account to the user
    await db.insert(userAccounts).values({
      id: crypto.randomUUID(),
      userId,
      provider: providerName,
      providerUserId,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString() : null,
    })
  }

  // Get full user details
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      passwordHash: users.passwordHash
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  // Create token and set cookie
  const token = createToken({
    userId: user.id,
    email: user.email,
    role: user.role
  })
  
  // For mobile apps with custom redirect_uri, return token as query param
  if (customRedirectUri) {
    const redirectUrl = new URL(customRedirectUri)
    redirectUrl.searchParams.set('token', token)
    return sendRedirect(event, redirectUrl.toString())
  }
  
  // For web, set cookie and redirect to home
  setAuthCookie(event, token)
  return sendRedirect(event, '/')
})
