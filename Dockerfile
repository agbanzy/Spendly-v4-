# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Upgrade npm to v11 to match lockfile version
# Use wget+tarball method since `npm install -g npm@11` breaks on Alpine
RUN wget -qO- https://registry.npmjs.org/npm/-/npm-11.12.1.tgz | tar xz -C /usr/local/lib/node_modules/npm --strip-components=1

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Accept VITE_ build args for client-side env vars
ARG VITE_COGNITO_USER_POOL_ID
ARG VITE_COGNITO_CLIENT_ID
ARG VITE_COGNITO_DOMAIN
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_PAYSTACK_PUBLIC_KEY

# Copy source and build — ARGs must be set as ENV for Vite to pick them up
COPY . .
ENV VITE_COGNITO_USER_POOL_ID=$VITE_COGNITO_USER_POOL_ID \
    VITE_COGNITO_CLIENT_ID=$VITE_COGNITO_CLIENT_ID \
    VITE_COGNITO_DOMAIN=$VITE_COGNITO_DOMAIN \
    VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY \
    VITE_PAYSTACK_PUBLIC_KEY=$VITE_PAYSTACK_PUBLIC_KEY
RUN npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Only copy what's needed for production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

# Copy migration files and schema (drizzle-kit needs these)
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts

# Upgrade npm and install production dependencies only
RUN wget -qO- https://registry.npmjs.org/npm/-/npm-11.12.1.tgz | tar xz -C /usr/local/lib/node_modules/npm --strip-components=1 && \
    npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Create non-root user and writable directories
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads
# Ensure all app files are readable by appuser
RUN chmod -R a+rX /app
USER appuser

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

# Run idempotent DB migration before starting server
CMD ["sh", "-c", "node scripts/run-migration.cjs migrate && node dist/index.cjs"]
