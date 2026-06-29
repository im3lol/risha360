# syntax=docker/dockerfile:1

# ============================================================================
# Risha 360 — Next.js app + autonomous discovery worker
# Multi-stage: build with Bun, run the standalone server with Node.
# ============================================================================

# ── Build stage ─────────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app

# Install dependencies first for better layer caching.
# Not using --frozen-lockfile: the committed bun.lock can drift from the bun
# version in this base image; a plain install resolves consistently.
COPY package.json bun.lock ./
RUN bun install

# Copy the source (see .dockerignore for what is excluded).
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so they
# must be present here (passed via docker-compose build.args).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN bun run build

# ── Runtime stage: standalone Next.js server ─────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# distDir is ".next-runtime" (see next.config.ts), so the standalone bundle and
# its static assets live under that directory rather than ".next".
# --chown so the non-root `node` user can read them.
COPY --from=builder --chown=node:node /app/.next-runtime/standalone ./
COPY --from=builder --chown=node:node /app/.next-runtime/static ./.next-runtime/static
COPY --from=builder --chown=node:node /app/public ./public

# Run as the unprivileged built-in `node` user instead of root.
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# ── Worker stage: always-on discovery tick ───────────────────────────────────
# Tiny image — the worker is a single script that pings the app's /api/agent/tick.
FROM node:20-bookworm-slim AS worker
WORKDIR /app
COPY --chown=node:node scripts/discovery-worker.mjs ./scripts/discovery-worker.mjs
USER node
CMD ["node", "scripts/discovery-worker.mjs"]
