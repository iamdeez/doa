# ============================================================
# Stage 1: builder — install deps, generate prisma client, build
# ============================================================
FROM node:20-alpine AS builder

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/ui/package.json ./packages/ui/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/backend/ ./apps/backend/
COPY packages/ ./packages/

# Generate Prisma client
RUN pnpm --filter backend exec prisma generate

# Build NestJS app
RUN pnpm --filter backend run build

# ============================================================
# Stage 2: runtime — production-only deps + built artifacts
# ============================================================
FROM node:20-alpine AS runtime

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifests for production install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/ui/package.json ./packages/ui/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built dist and prisma client from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Liveness probe — hits GET /health (no external deps; uses node http)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "apps/backend/dist/main.js"]
