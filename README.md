# Bkmk

A personal bookmarking application with offline reading and sync capabilities.

## Features

- **Bookmark Management**: Save, organize, and search bookmarks
- **Offline Support**: PWA with IndexedDB for local storage and offline access
- **Sync**: Automatic sync when connection is restored
- **Reader Mode**: Clean reading experience with customizable font size, family, and line height
- **Notes**: Markdown and secret note support
- **Tags**: Organize bookmarks with colored tags
- **Dark Mode**: Automatic theme based on system preference or manual toggle

## Tech Stack

- **Runtime**: Bun
- **Frontend**: Nuxt 4, Vue 3, Tailwind CSS
- **Backend**: Nitro server
- **Database**: PostgreSQL with Drizzle ORM, IndexedDB (offline)
- **PWA**: @vite-pwa/nuxt with Workbox

## Setup

```bash
# Install dependencies
bun install

# Copy environment file and configure database
cp .env.example .env
# Edit .env with your DATABASE_URL

# Database commands (uses drizzle-kit)
bun run db:generate  # Generate migrations from schema
bun run db:push      # Push schema to database (quick sync)
bun run db:migrate   # Run migrations
bun run db:studio    # Open Drizzle Studio
bun run db:check     # Check migrations

# Run development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Docker

### Docker Compose (Recommended for local development)

```bash
# Start all services (app + PostgreSQL)
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# With fresh database
docker compose down -v && docker compose up -d
```

### Manual Docker

```bash
# Build image
docker build -t bkmk .

# Run with PostgreSQL
docker run -p 3000:3000 -e POSTGRES_URL=postgresql://... bkmk
```

## Database

- **ORM**: Drizzle ORM with PostgreSQL
- **Migrations**: Run `bunx drizzle-kit push` or `bunx drizzle-kit migrate`
- **Schema**: See `server/database/schema.ts`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_URL` | PostgreSQL connection string |

## API Endpoints

- `GET /api/bookmarks` - List bookmarks
- `POST /api/scrape` - Scrape and save a new bookmark
- `GET /api/tags` - List tags
- `POST /api/notes/markdown` - Create markdown notes
- `POST /api/notes/secret` - Create encrypted secret notes

## PWA Features

- Installable as desktop/mobile app
- Service worker for offline caching
- Background sync when back online
