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
- **Database**: SQLite (production), IndexedDB (offline)
- **PWA**: @vite-pwa/nuxt with Workbox

## Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Docker

```bash
# Build image
docker build -t bkmk .

# Run container
docker run -p 3000:3000 -v ./data:/app/data bkmk
```

## Data Storage

- SQLite database in `./data/bookmarks.db`
- Local settings stored in IndexedDB for offline access
- Settings persisted in localStorage

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
