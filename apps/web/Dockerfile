# syntax=docker/dockerfile:1

# 1. Base Node image
FROM node:20-alpine AS base
WORKDIR /app

# 2. Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

# 3. Builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/ ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Provide build-time fallback envs for static prerendering
ENV NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDevBuildFallbackKey123
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=pulse-dev.firebaseapp.com
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=pulse-dev

RUN npm run build

# 4. Production Runner
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets and standalone server output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
