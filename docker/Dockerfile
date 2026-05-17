# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm install (não npm ci) — mais permissivo com optional deps platform-specific
# do esbuild que vêm como deps de tsx. npm ci no alpine estava quebrando em
# @esbuild/aix-ppc64 mesmo com "optional: true" + "os: [aix]" no lock.
RUN npm install --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/lib/db/migrations ./src/lib/db/migrations
COPY --from=builder /app/drizzle.config.ts ./
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
