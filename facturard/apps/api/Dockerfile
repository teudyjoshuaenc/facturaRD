FROM node:20-alpine AS base
RUN npm install -g pnpm
# Forzar pnpm a usar un store local al contenedor.
# Docker Desktop (VirtioFS) monta el home del Mac en el contenedor;
# sin esto, pnpm usa /Users/wilmer/Library/pnpm/store y trae binarios Mach-O.
ENV PNPM_HOME=/root/.pnpm
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
RUN pnpm install --frozen-lockfile --shamefully-hoist

FROM base AS builder
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/ecf-engine/node_modules ./packages/ecf-engine/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/api-client/node_modules ./packages/api-client/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY facturard/ .
RUN pnpm --filter @facturard/ecf-engine build
RUN pnpm --filter @facturard/database generate
RUN pnpm --filter @facturard/database build
RUN pnpm --filter @facturard/shared build
RUN pnpm --filter @facturard/api-client build
RUN pnpm --filter @facturard/api build

FROM node:20-alpine AS runner
RUN apk add --no-cache cairo pango
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Paquetes internos: dist + package.json (Docker no preserva symlinks de workspace correctamente)
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/ecf-engine/dist ./packages/ecf-engine/dist
COPY --from=builder /app/packages/ecf-engine/package.json ./packages/ecf-engine/
COPY --from=builder /app/packages/ecf-engine/node_modules ./packages/ecf-engine/node_modules

# Recrear symlinks @facturard/* con rutas absolutas
RUN rm -rf node_modules/@facturard && \
    mkdir -p node_modules/@facturard && \
    ln -sf /app/packages/database  node_modules/@facturard/database && \
    ln -sf /app/packages/shared    node_modules/@facturard/shared && \
    ln -sf /app/packages/ecf-engine node_modules/@facturard/ecf-engine

COPY --from=builder /app/apps/api/package.json ./

# Prisma CLI y migrations (requeridos por migrate deploy en startup)
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

EXPOSE 3000
CMD ["sh", "-c", "npm run start:prod"]
