FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev
COPY facturard/package.json ./
COPY facturard/pnpm-lock.yaml ./
COPY facturard/pnpm-workspace.yaml ./
COPY facturard/apps/api/package.json ./apps/api/
COPY facturard/packages/config/package.json ./packages/config/
COPY facturard/packages/database/package.json ./packages/database/
COPY facturard/packages/shared/package.json ./packages/shared/
COPY facturard/packages/ecf-engine/package.json ./packages/ecf-engine/
COPY facturard/packages/api-client/package.json ./packages/api-client/
COPY facturard/packages/database/prisma ./packages/database/prisma/
RUN pnpm install --frozen-lockfile

FROM base AS builder
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/ecf-engine/node_modules ./packages/ecf-engine/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY facturard/ .
RUN pnpm --filter @facturard/ecf-engine build
RUN pnpm --filter @facturard/database generate
RUN pnpm --filter @facturard/api build

FROM node:20-alpine AS runner
RUN apk add --no-cache cairo pango
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
