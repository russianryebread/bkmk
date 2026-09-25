# Builder: build deps and build app
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package manifest first for caching
COPY package*.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy sources and build
COPY . .
RUN bun run build

# Production: smaller runtime image, copy built app and node_modules
FROM oven/bun:1-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup

# Copy production files, built output, and node_modules from builder
COPY --from=builder --chown=appuser:appgroup /app/.output ./.output
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json
# Keep migration inputs available when running database commands in the image.
COPY --from=builder --chown=appuser:appgroup /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=appuser:appgroup /app/server/database/schema.ts ./server/database/schema.ts
COPY --from=builder --chown=appuser:appgroup /app/server/database/migrations ./server/database/migrations

# Ensure permissions
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["bun", ".output/server/index.mjs"]
