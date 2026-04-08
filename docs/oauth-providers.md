# OAuth Authentication

Bkmk supports OAuth authentication alongside traditional email/password authentication. Users can sign in with their existing accounts from providers like Google, GitHub, and Apple.

## Supported Providers

| Provider | Status | Features |
|----------|--------|----------|
| **Google** | ✅ Active | Sign in with Google account |
| **GitHub** | 🔹 Available | Sign in with GitHub account (configurable) |
| **Apple** | 🔹 Available | Sign in with Apple ID |

## Architecture

Bkmk uses a **generic OAuth handler** at `server/api/auth/[provider].ts` that supports multiple providers through a unified configuration system. No separate files needed for each provider.

### How It Works

1. User clicks OAuth provider button on login page
2. Redirect to provider's authorization page
3. User grants permissions
4. Provider redirects back with authorization code
5. Server exchanges code for access token
6. Server fetches user info and creates/links account
7. Session cookie is set and user is logged in

### Account Linking

When a user signs in with OAuth:

1. **New users**: A new account is automatically created
2. **Existing users**: If email matches an existing account, the OAuth account is linked to that user
3. **Linked accounts**: Users can sign in with any linked method (OAuth or password)

This means a user can:
- Sign up with Google and later add a password
- Sign up with email/password and later link a Google account
- Sign in with either method interchangeably

## Configuration

### Step 1: Get Credentials

**Google:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing one
3. Go to **APIs & Services** → **Credentials**
4. Create **OAuth client ID** (Web application type)
5. Add authorized redirect URI: `https://your-domain.com/api/auth/google`
6. Copy **Client ID** and **Client Secret**

**GitHub:**
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth App
3. Set Homepage URL to your app URL
4. Set Authorization callback URL to `/api/auth/github`
5. Copy **Client ID** and generate **Client Secret**

**Apple:**
1. Go to Apple Developer Portal → Certificates, Identifiers & Profiles
2. Create a Services ID for Sign in with Apple
3. Configure the callback URL and web domain
4. Create a private key for signing
5. Note your **Service ID** and **Key ID**

### Step 2: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Apple OAuth (optional)
APPLE_CLIENT_ID=your-apple-service-id
APPLE_CLIENT_SECRET=your-apple-private-key
APPLE_KEY_ID=your-key-id
APPLE_TEAM_ID=your-team-id
```

### Step 3: Enable Providers

By default, only Google is shown on the login page. To enable GitHub:

1. Open `pages/login.vue`
2. Find the commented GitHub button
3. Uncomment it to enable

## Database Schema

OAuth accounts are stored in the `userAccounts` table:

```sql
CREATE TABLE userAccounts (
  id TEXT PRIMARY KEY,
  userId TEXT REFERENCES users(id),
  provider TEXT NOT NULL,          -- 'google', 'github', 'apple'
  providerUserId TEXT NOT NULL,    -- ID from the OAuth provider
  accessToken TEXT,
  refreshToken TEXT,
  expiresAt TIMESTAMPTZ,
  createdAt TEXT DEFAULT NOW()
);
```

## Security Notes

- Never commit OAuth secrets to version control
- All credentials should use environment variables
- Access tokens are stored for potential future use (refresh tokens, etc.)
- Sessions are cookie-based with httpOnly, secure flags in production
- OAuth state parameter is generated to prevent CSRF attacks

## Troubleshooting

### CORS Issues

If you see CORS errors, ensure your OAuth app's callback URL is configured:

- Local: `http://localhost:3000/api/auth/{provider}`
- Production: `https://yourdomain.com/api/auth/{provider}`

The redirect URI must exactly match:
- Protocol (http vs https)
- Port number
- Path (e.g., `/api/auth/google`)

### Email Not Returned

Some providers don't return email by default:

- **GitHub**: Requires `user:email` scope (already included)
- **Google**: Requires `email` scope (already included)
- **Apple**: May require additional configuration

### Provider Not Working

1. Check browser console for errors
2. Verify environment variables are set correctly
3. Confirm OAuth app callback URL matches your deployment URL
4. Ensure OAuth app is published/approved (some providers require this)

## Adding a New Provider

To add a new OAuth provider (e.g., Facebook, Microsoft):

### 1. Add Provider Configuration

Open `server/api/auth/[provider].ts` and add to `providerConfigs`:

```typescript
myprovider: {
  name: 'MyProvider',
  clientId: '',
  clientSecret: '',
  authUrl: 'https://provider.com/oauth/authorize',
  tokenUrl: 'https://provider.com/oauth/token',
  userInfoUrl: 'https://api.provider.com/user',
  scopes: ['openid', 'email', 'profile'],
  getUserId: (u) => u.id,
  getUserEmail: (u) => u.email,
  getUserName: (u) => u.name,
  getUserPicture: (u) => u.avatar_url
}
```

### 2. Add Login Button

In `pages/login.vue`, add a button:

```vue
<button
  @click="signInWithOAuth('myprovider')"
  class="w-full flex items-center justify-center gap-3 py-3 ..."
>
  <span>Sign in with MyProvider</span>
</button>
```

### 3. Add Environment Variables

```bash
MYPROVIDER_CLIENT_ID=xxx
MYPROVIDER_CLIENT_SECRET=xxx
```

### 4. Add Database Migration

Create a migration if needed for any additional user data.

## Special Cases

### Apple JWT Handling

Apple returns user info as a JWT. The handler automatically decodes it:

```typescript
if (providerName === 'apple') {
  const idToken = tokenResponse.id_token
  const decoded = JSON.parse(
    Buffer.from(idToken.split('.')[1], 'base64').toString()
  )
  userEmail = provider.getUserEmail(decoded)
}
```
