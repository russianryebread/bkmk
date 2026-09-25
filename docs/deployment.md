# Deploy the web app

Bkmk runs as a Nuxt server backed by PostgreSQL. Serve it over HTTPS so login cookies and the offline PWA work correctly. The Docker Compose file in this repository is for local development; it uses a sample database password and runs `db:push` at startup.

## Production on a server with Bun

1. Install Bun and PostgreSQL, then clone the repository onto the server.
2. Create `.env` from `.env.example`. Set `POSTGRES_URL` to your production database and `AUTH_SECRET` to a unique value generated with `openssl rand -base64 32`. Keep that secret stable across restarts. Set OAuth credentials only for providers you use.
3. Back up an existing database before applying migrations. From the repository root, run:

   ```sh
   bun install --frozen-lockfile
   bun run db:migrate
   bun run build
   NODE_ENV=production HOST=127.0.0.1 PORT=3000 bun .output/server/index.mjs
   ```

4. Run the last command under your process manager so it starts after a reboot. Put an HTTPS reverse proxy in front of `127.0.0.1:3000`. For example, a Caddy site block is:

   ```caddyfile
   bkmk.example.com {
       reverse_proxy 127.0.0.1:3000
   }
   ```

5. Open the site and sign in. If you use OAuth, configure each provider's callback URL for this domain. If the iOS app should use this deployment, change `AppConfig.apiBaseURL` in `ios-share-extension/BkmkShare/Shared/AppConfig.swift` to `https://bkmk.example.com/api` and rebuild the app.

## Docker with an external PostgreSQL database

The Docker image includes the database migration files. Build it, migrate, and run it with an environment file containing `POSTGRES_URL` and `AUTH_SECRET`:

```sh
docker build -t bkmk:latest .
docker run --rm --env-file .env.production bkmk:latest bunx drizzle-kit migrate
docker run -d --name bkmk --restart unless-stopped --env-file .env.production \
  -p 127.0.0.1:3000:3000 bkmk:latest
```

Put the same HTTPS reverse proxy in front of the container. For an existing database previously managed with `db:push`, check migration history before running `db:migrate` so migrations are not applied twice.
