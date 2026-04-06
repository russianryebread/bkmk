# Adding OAuth Providers

This document explains how to add new OAuth providers (like GitHub, Apple, Facebook, etc.) to your Bkmk application.

## Architecture Overview

Bkmk uses a **generic OAuth handler** at `server/api/auth/oauth/[provider].ts` that supports multiple providers through a simple configuration object. You don't need to create separate files for each provider.

## Quick Start: Add GitHub or Apple

### Step 1: Get Credentials

**GitHub:**
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth App
3. Set Homepage URL to your app URL (e.g., http://localhost:3000)
4. Set Authorization callback URL to `/api/auth/github`
5. Copy Client ID and generate a Client Secret

**Apple:**
1. Go to Apple Developer Portal → Certificates, Identifiers & Profiles
2. Create a Services ID for Sign in with Apple
3. Configure the callback URL and web domain
4. Download the private key

### Step 2: Add to .env

```bash
# Google (existing)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Apple
APPLE_CLIENT_ID=your-apple-service-id
APPLE_CLIENT_SECRET=your-apple-private-key
```

### Step 3: Test

The provider will automatically work once credentials are added. No code changes needed!

## Adding a New Provider

### Step 1: Add Provider Configuration

Open `server/api/auth/oauth/[provider].ts` and add to the `providers` object:

```typescript
const providers: Record<string, OAuthProvider> = {
  // ... existing providers ...
  
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
}
```

### Step 2: Add Login Button

In `pages/login.vue`, add a button:

```vue
<button @click="signInWithOAuth('myprovider')" ...>
  Sign in with MyProvider
</button>
```

### Step 3: Add Environment Variables

```bash
MYPROVIDER_CLIENT_ID=xxx
MYPROVIDER_CLIENT_SECRET=xxx
```

## Provider Configuration Fields

Each provider in the configuration object needs:

| Field | Description |
|-------|-------------|
| `name` | Display name for error messages |
| `authUrl` | OAuth authorization endpoint |
| `tokenUrl` | OAuth token endpoint |
| `userInfoUrl` | Endpoint to get user info (or empty for JWT) |
| `scopes` | OAuth scopes to request |
| `getUserId` | Function to extract provider's user ID |
| `getUserEmail` | Function to extract email from user info |
| `getUserName` | Function to extract name (optional) |
| `getUserPicture` | Function to extract avatar URL (optional) |

## Special Cases

### Providers Using JWT (Apple)

If the provider returns user info in JWT format (like Apple), the handler automatically detects this:

```typescript
if (providerName === 'apple') {
  const idToken = tokenResponse.id_token
  const decoded = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString())
  userEmail = provider.getUserEmail(decoded)
}
```

### Adding More Providers Later

To add Facebook, Twitter, Microsoft, etc.:

1. Add credentials to `.env`
2. Add provider config to the providers object
3. Add button to login page

That's it! The handler is already generic.

## Troubleshooting

### CORS Issues

If you see CORS errors, ensure your OAuth app's callback URL is whitelisted:
- Local: `http://localhost:3000/api/auth/{provider}`
- Production: `https://yourdomain.com/api/auth/{provider}`

### Email Not Returned

Some providers don't return email by default. You may need:
- Additional scopes (e.g., `user:email` for GitHub)
- Secondary API call to fetch email

### Callback URL Mismatch

The redirect URI must exactly match what's configured in your OAuth app. Check:
- Protocol (http vs https)
- Port number
- Path (e.g., `/api/auth/google`)

## Security Notes

- Never commit client secrets to git
- Use environment variables for all credentials
- The handler stores tokens in `userAccounts` table for potential future use (refresh tokens, etc.)
- Sessions are cookie-based for web; can be extended for mobile