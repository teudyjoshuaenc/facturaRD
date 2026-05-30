FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY facturard/package.json facturard/pnpm-lock.yaml ./
COPY facturard/apps/api/package.json ./apps/api/
COPY facturard/packages/config/package.json ./packages/config/
COPY facturard/packages/database/package.json ./packages/database/
COPY facturard/packages/shared/package.json ./packages/shared/
COPY facturard/packages/ecf-engine/package.json ./packages/ecf-engine/
COPY facturard/packages/api-client/package.json ./packages/api-client/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY facturard/ .
RUN pnpm --filter @facturard/ecf-engine build
RUN pnpm --filter @facturard/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
