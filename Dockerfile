# Builder: build deps and build app
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies required for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-dev \
    build-essential \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifest first for caching
COPY package*.json ./

# Install all dependencies (including native modules)
RUN npm ci

# Copy sources and build
COPY . .
RUN npm run build

# Production: smaller runtime image, copy built app and node_modules
FROM node:22-slim AS production

WORKDIR /app

# Create non-root user
RUN useradd --user-group --create-home --shell /bin/false appuser

# Copy production files, built output, and node_modules from builder
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Ensure permissions
RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]