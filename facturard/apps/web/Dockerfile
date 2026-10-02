# Frontend Next.js para el VPS. Contexto de build = raíz del repo (igual que la API).
#   docker build -f facturard/apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=... .
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0
ENV PNPM_HOME=/root/.pnpm
WORKDIR /app

FROM base AS deps
COPY facturard/package.json facturard/pnpm-lock.yaml facturard/pnpm-workspace.yaml ./
COPY facturard/apps/web/package.json ./apps/web/
COPY facturard/packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile --filter @facturard/web...

FROM base AS builder
# NEXT_PUBLIC_* se incrustan en el bundle en tiempo de BUILD, no de ejecución:
# cambiar la URL de la API exige reconstruir la imagen.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SHOW_WIP_TABS
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SHOW_WIP_TABS=$NEXT_PUBLIC_SHOW_WIP_TABS \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY facturard/package.json facturard/pnpm-workspace.yaml ./
COPY facturard/packages/config ./packages/config
COPY facturard/apps/web ./apps/web
RUN pnpm --filter @facturard/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3001
CMD ["node", "apps/web/server.js"]
