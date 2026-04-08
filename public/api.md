# Overview

The Bkmk API is a RESTful API built on Nuxt/Nitro that provides programmatic access to bookmark management, notes, and tagging functionality.

**Base URL:** `https://bkmk.hoshor.me/api`

**Response Format:** All responses return JSON with appropriate HTTP status codes.

**Common Headers:**
```
Content-Type: application/json
```

---

## Authentication

Bkmk supports multiple authentication methods:

### OAuth (Recommended)

Sign in with your existing accounts from popular providers:

| Provider | Endpoint |
|----------|----------|
| Google | `GET /api/auth/google` |
| GitHub | `GET /api/auth/github` |
| Apple | `GET /api/auth/apple` |

**Usage:**
1. Redirect user to `/api/auth/{provider}` (e.g., `/api/auth/google`)
2. User is redirected to provider's login page
3. After authorization, user is redirected back to your app and logged in
4. Session cookie is automatically set

**Configuration:**
```bash
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
APPLE_CLIENT_ID=xxx
APPLE_CLIENT_SECRET=xxx
```

### Bearer Token Authentication

For third-party apps, browser extensions, CLI tools, and mobile apps:

**Usage:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     https://your-bkmk-instance.com/api/bookmarks
```

**How it works:**
1. Login via `POST /api/auth/login` with your credentials
2. Receive a session token in the response
3. Use the token in the `Authorization: Bearer <token>` header for all subsequent requests
4. Sessions expire after 7 days

### Cookie-Based Authentication (Web App)

For the web application, authentication uses httpOnly cookies:

1. Login via `POST /api/auth/login` or OAuth
2. Server sets an `auth_token` httpOnly cookie
3. All subsequent requests automatically include the cookie

### Account Linking

Users signed up via OAuth can later add a password, and password-based users can link OAuth accounts. If an OAuth email matches an existing account, they're automatically linked.

### CORS Support

The API includes CORS headers for cross-origin requests from browser-based apps:

**Environment Variable:**
```
CORS_ORIGINS=https://myapp.com,https://dashboard.example.com
# Or allow all origins:
CORS_ORIGINS=*
```

**Headers included:**
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`
- `Access-Control-Allow-Credentials`
- `Access-Control-Max-Age`

---

## Bookmarks API

There are two ways to create bookmarks:

| Method | Endpoint | Use Case |
|--------|----------|----------|
| **Scrape & Save** | `POST /api/scrape` | Fetch URL content, extract metadata, create bookmark in one step |
| **Direct Create** | `POST /api/bookmarks` | Create bookmark with data you already have (no scraping) |

### List Bookmarks

```
GET /api/bookmarks
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `sort` | string | created_at | Sort field: `created_at`, `title`, `saved_at`, `is_favorite`, `sort_order` |
| `order` | string | desc | Sort order: `asc` or `desc` |
| `tag` | string | - | Filter by tag name |
| `domain` | string | - | Filter by source domain |
| `favorite` | boolean | - | Filter favorites only |
| `unread` | boolean | - | Filter unread only |

**Response:**
```json
{
  "bookmarks": [
    {
      "id": "uuid",
      "title": "Bookmark Title",
      "url": "https://example.com/article",
      "description": "Description of the page",
      "cleaned_markdown": "# Article content...",
      "original_html": "<html>...</html>",
      "reading_time_minutes": 5,
      "saved_at": "2024-01-15T10:30:00Z",
      "last_accessed_at": "2024-01-16T08:00:00Z",
      "is_favorite": false,
      "is_read": true,
      "read_at": "2024-01-16T08:00:00Z",
      "source_domain": "example.com",
      "word_count": 1200,
      "thumbnail_image_path": "/api/images/abc123",
      "tags": ["tech", "programming"],
      "tag_ids": ["uuid1", "uuid2"],
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

### Create Bookmark

```
POST /api/bookmarks
```

**Body:**
```json
{
  "title": "My Bookmark",
  "url": "https://example.com/article",
  "description": "Optional description",
  "cleaned_markdown": "Optional pre-processed markdown",
  "original_html": "Optional pre-processed HTML",
  "reading_time_minutes": 5,
  "saved_at": "2024-01-15T10:30:00Z",
  "is_favorite": false,
  "is_read": false,
  "source_domain": "example.com",
  "word_count": 1200
}
```

**Response:**
```json
{
  "success": true,
  "bookmark": {
    "id": "uuid",
    "title": "My Bookmark",
    "url": "https://example.com/article",
    "tags": [],
    "tag_ids": []
  }
}
```

---

### Get Single Bookmark

```
GET /api/bookmarks/:id
```

**Response:** Single bookmark object (same structure as list items).

**Notes:**
- Updates `last_accessed_at` timestamp
- Returns 404 if bookmark doesn't exist or belongs to another user

---

### Update Bookmark

```
PUT /api/bookmarks/:id
```

**Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "is_favorite": true,
  "is_read": true,
  "sort_order": 1
}
```

**Response:**
```json
{
  "success": true
}
```

---

### Delete Bookmark

```
DELETE /api/bookmarks/:id
```

**Response:**
```json
{
  "success": true
}
```

---

### Search Bookmarks

```
GET /api/bookmarks/search?q=search+term&limit=20
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Search query |
| `limit` | number | 20 | Max results (max 100) |

**Response:**
```json
{
  "bookmarks": [...],
  "total": 5
}
```

**Notes:**
- Uses PostgreSQL full-text search with English language configuration
- Searches: title (highest weight), description (medium weight), content (lower weight)
- Falls back to case-insensitive LIKE search if FTS fails

---

### Manage Bookmark Tags

```
GET /api/bookmarks/:id/tags
POST /api/bookmarks/:id/tags
DELETE /api/bookmarks/:id/tags
```

**GET Response:**
```json
{
  "tags": [
    {
      "id": "uuid",
      "name": "tech",
      "parent_tag_id": null,
      "color": "#3B82F6",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**POST Body:**
```json
{
  "tag_ids": ["uuid1", "uuid2"]
}
```

**DELETE Body:**
```json
{
  "tag_ids": ["uuid1"]
}
```

---

## Notes API

### Markdown Notes

#### List Notes

```
GET /api/notes/markdown?page=1&limit=20&sort=updatedAt&tag=optional
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `sort` | string | updatedAt | Sort: `createdAt`, `title`, `updatedAt`, `isFavorite` |
| `tag` | string | - | Filter by tag name |

**Response:**
```json
{
  "notes": [
    {
      "id": "uuid",
      "title": "Note Title",
      "content": "Markdown content...",
      "isFavorite": true,
      "tags": ["work", "important"],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-16T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10,
    "totalPages": 1
  }
}
```

---

#### Create Note

```
POST /api/notes/markdown
```

**Body:**
```json
{
  "title": "My Note",
  "content": "Markdown content here",
  "isFavorite": false,
  "tags": ["personal"]
}
```

**Response:** Created note object with tags array.

---

#### Get Note

```
GET /api/notes/markdown/:id
```

**Response:** Single note object with full content.

---

#### Update Note

```
PUT /api/notes/markdown/:id
```

**Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "isFavorite": true,
  "tags": ["work", "updated"]
}
```

**Response:** Updated note object.

---

#### Delete Note

```
DELETE /api/notes/markdown/:id
```

**Response:**
```json
{
  "success": true
}
```

---

### Create Tag

```
POST /api/tags
```

**Body:**
```json
{
  "name": "programming",
  "parent_tag_id": "uuid-of-parent",
  "color": "#10B981"
}
```

**Validation:**
- `name` is required
- Duplicate names are rejected with 409

---

### Get Tag

```
GET /api/tags/:id
```

---

### Update Tag

```
PUT /api/tags/:id
```

**Body:**
```json
{
  "name": "new-name",
  "parent_tag_id": "uuid",
  "color": "#EF4444"
}
```

---

### Delete Tag

```
DELETE /api/tags/:id
```

**Response:**
```json
{
  "success": true
}
```

**Notes:** Removes all bookmark-tag associations. Returns 404 if tag doesn't exist.

---

## Scraping API

### Scrape URL

```
POST /api/scrape
```

**Body:**
```json
{
  "url": "https://example.com/article"
}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Article Title",
  "url": "https://example.com/article",
  "description": "Page description...",
  "cleaned_markdown": "# Title\n\nContent...",
  "original_html": "<html>...</html>",
  "reading_time_minutes": 5,
  "word_count": 1200,
  "source_domain": "example.com",
  "saved_at": "2024-01-15T10:30:00Z",
  "isFavorite": false,
  "isRead": false,
  "tags": [],
  "tag_ids": [],
  "imagesProcessed": 5
}
```

**Features:**
- Extracts page title, description, and main content
- Converts HTML to cleaned markdown
- Calculates reading time and word count
- Downloads and stores images locally
- Handles video URLs (YouTube, Vimeo, TikTok, etc.) with oEmbed metadata
- Returns 409 if bookmark already exists for URL

---

## User Management

### Login

```
POST /api/auth/login
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Notes:**
- Sets `auth_token` httpOnly cookie automatically for web app sessions
- Returns `token` for programmatic/API access (use this for browser extensions, CLI tools, etc.)

---

### Signup

```
POST /api/auth/signup
```

**Body:**
```json
{
  "email": "newuser@example.com",
  "password": "password123"
}
```

**Validation:**
- Email must be valid format
- Password must be at least 8 characters

---

### Get Current User

```
GET /api/auth/me
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

### Logout

```
POST /api/auth/logout
```

**Response:**
```json
{
  "success": true
}
```

---

### Change Password

```
POST /api/auth/change-password
```

**Body:**
```json
{
  "current_password": "oldpassword",
  "new_password": "newpassword123"
}
```

---

### Request Password Reset

```
POST /api/auth/reset-request
```

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

---

### Reset Password

```
POST /api/auth/reset-password
```

**Body:**
```json
{
  "token": "reset-token-from-email",
  "password": "newpassword123"
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "data": {}
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Not logged in |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error |

---

## Future API Improvements

The following improvements are planned or could be added in the future:

### API Key System

For third-party apps, provide long-lived API keys with scopes:

```json
// POST /api/auth/api-keys
{
  "name": "My Browser Extension",
  "scopes": ["bookmarks:read", "bookmarks:write"]
}
```

### Rate Limiting

Add rate limiting to prevent abuse:

```json
// Response headers:
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642000000

// 429 Too Many Requests:
{
  "statusCode": 429,
  "message": "Rate limit exceeded. Try again in 60 seconds.",
  "retryAfter": 60
}
```

### OpenAPI/Swagger Documentation

Generate auto-documented API with Swagger UI for interactive API exploration.

### Webhook Support

Notify third-party apps of changes in real-time:

```json
// POST /api/webhooks
{
  "url": "https://myapp.com/webhook",
  "events": ["bookmark.created", "bookmark.deleted", "note.updated"],
  "secret": "webhook-secret-123"
}
```

### Batch Operations

Efficient bulk operations for importing large datasets.

### Export/Import

Data portability with standard formats (JSON, CSV, HTML bookmark format).

### Cursor-Based Pagination

For efficient navigation of large datasets.

### Field Selection

Reduce payload size by specifying which fields to return.

---

## Example: Browser Extension

A minimal browser extension would use the API like this:

```typescript
// background.js
const API_BASE = 'https://bkmk.example.com/api';

// Save bookmark on page action click
async function saveBookmark(tab) {
  // Get stored API key or token
  const { apiKey } = await browser.storage.local.get('apiKey');
  
  const response = await fetch(`${API_BASE}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ url: tab.url })
  });
  
  if (response.ok) {
    const data = await response.json();
    showNotification(`Saved: ${data.title}`);
  }
}

// Example: List recent bookmarks
async function listBookmarks() {
  const { apiKey } = await browser.storage.local.get('apiKey');
  
  const response = await fetch(`${API_BASE}/bookmarks?limit=10`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  
  return response.json();
}
```

---

## Support

For API questions, feature requests, or bug reports:
- Open an issue at: [https://github.com/russianryebread/bkmk](https://github.com/russianryebread/bkmk)
- Documentation: [https://bkmk.hoshor.me/docs](https://bkmk.hoshor.me/docs)
