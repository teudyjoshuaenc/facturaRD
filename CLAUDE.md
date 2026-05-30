# CLAUDE.md — FacturaRD

## 1. DESCRIPCIÓN DEL PROYECTO
FacturaRD — SaaS de facturación electrónica para PYMEs dominicanas.
Permite emitir Comprobantes Fiscales Electrónicos (e-CF) cumpliendo
la Ley 32-23 de la DGII, con integración directa a GoHighLevel.

---

## 2. STACK COMPLETO
- Monorepo: Turborepo + pnpm workspaces
- Backend: NestJS 10 + TypeScript strict
- ORM: Prisma 6 + PostgreSQL 16
- Cache/Colas: Redis 7 + BullMQ
- Frontend: Next.js 16.2 (pendiente)
- Deploy: Railway (api) + Vercel (web)
- API Client: openapi-typescript + openapi-fetch

---

## 3. ESTRUCTURA DEL MONOREPO
```
apps/api               → NestJS backend (puerto 3000)
apps/web               → Next.js frontend (pendiente)
packages/ecf-engine    → núcleo técnico DGII (firma, XML, PDF)
packages/database      → Prisma schema + cliente
packages/shared        → tipos compartidos
packages/api-client    → tipos generados desde OpenAPI
packages/config        → tsconfig base estricto
```

---

## 4. COMANDOS ESENCIALES

```bash
# Docker (siempre primero)
docker compose up -d
docker compose down

# Desarrollo
pnpm --filter @facturard/api dev        # API en puerto 3000
pnpm --filter @facturard/api build      # Build producción

# Base de datos
pnpm --filter @facturard/database migrate:dev --name {nombre}
pnpm --filter @facturard/database migrate:deploy
pnpm --filter @facturard/database studio
pnpm --filter @facturard/database seed

# Tests
pnpm --filter @facturard/ecf-engine test   # 112 tests

# OpenAPI
pnpm generate:api   # genera packages/api-client/src/generated.ts
```

---

## 5. VARIABLES DE ENTORNO (`apps/api/.env`)
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://facturard:facturard_dev@localhost:5432/facturard
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=facturard-jwt-secret-desarrollo-local-muy-largo-123456789
JWT_REFRESH_SECRET=facturard-refresh-secret-desarrollo-local-123456789
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=facturard-encryption-32chars-dev!

SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM=noreply@facturard.do
APP_URL=http://localhost:3000
```

---

## 6. CREDENCIALES DE DESARROLLO
- **DB:** `postgresql://facturard:facturard_dev@localhost:5432/facturard`
- **Redis:** `localhost:6379`
- **Usuario ADMIN:** `wilmer@dmaia.do` / (ver seed)
- **SUPER_ADMIN:** `admin@dmaia.do` / `Admin1234!`
- **Tenant DMAIA:** RNC `132883225`, plan `PYME`

---

## 7. MÓDULOS COMPLETADOS
- ✅ Auth — register (valida RNC vs DGII), login, logout
- ✅ Auth — Refresh token con rotación completa + jti + SHA-256 + optimistic lock
- ✅ Auth — Forgot/reset password con Sendgrid (modo DEV: loguea el link)
- ✅ Tenants — SUPER_ADMIN ve todos, ADMIN ve solo el suyo
- ✅ Certificados — P12 cifrado AES-256-GCM, nunca en plano
- ✅ Comprobantes — crear → BullMQ → worker → DGII → DB
- ✅ Secuencias — asignación automática con SELECT FOR UPDATE; eNCF E310000000001 ✓
- ✅ API Keys — hash SHA-256, prefijo `frd_`
- ✅ Webhooks — HMAC auto-generado
- ✅ Webhooks GHL — receiver (POST /webhooks/ghl/:tenantId) + salientes HMAC-SHA256 + integración worker
- ✅ Health — `GET /api/v1/health`
- ✅ PlanActivoGuard — trial 14 días, HTTP 402 si vence
- ✅ ecf-engine — firma XMLDSig, generadores XML, cliente DGII, PDF
- ✅ Receptor DGII (Paso 7) — /fe/autenticacion, /fe/recepcion, /fe/aprobacioncomercial (fuera de api/v1)

---

## 8. PRÓXIMOS PASOS (en orden de prioridad)
1. ~~Probar secuencias automáticas~~ ✅ E310000000001 asignado automáticamente
2. ~~Refresh token — `POST /auth/refresh`~~ ✅ Rotación + jti + SHA-256
3. ~~Forgot/reset password~~ ✅ + Sendgrid (poner SENDGRID_API_KEY real en prod)
4. ~~Webhooks GHL — receiver + salientes HMAC-SHA256~~ ✅ Receiver + sender + integrado en worker
5. Suscripciones — Azul/CardNet
6. Reportes DGII — 606, 607, 608
7. Frontend Next.js 16.2
8. Cambiar ENV a producción cuando certifiquen

---

## 9. DGII — NOTAS CRÍTICAS
- `normalizeXml()` SIEMPRE antes de firmar cualquier XML
- Filename multipart DEBE ser: `{RNCEmisor}{eNCF}.xml`
  - Ejemplo: `132883225E310000000001.xml`
- `CodigoSeguridad` = primeros 6 chars del `SignatureValue`
- E32 < 250K: enviar RFCE primero a `fc.dgii.gov.do`,
  luego XML completo por el portal
- Ambiente certificación: `certecf`
- Ambiente producción: `ecf` (cambiar cuando certifiquen)
- URLs base:
  - Auth:      `https://ecf.dgii.gov.do/{env}/autenticacion`
  - Recepción: `https://ecf.dgii.gov.do/{env}/recepcion`
  - Consulta:  `https://ecf.dgii.gov.do/{env}/consultaresultado`
  - RFCE:      `https://fc.dgii.gov.do/{env}/recepcionfc`

---

## 10. ARQUITECTURA — DECISIONES IMPORTANTES
- Multi-tenant: `tenant_id` en TODAS las tablas
- P12 cifrado AES-256-GCM en DB (`p12Encrypted`, `p12Iv`, `p12Tag`)
- Passphrase cifrada con formato `iv:tag:data` en base64
- BullMQ para envío asíncrono (no bloquea el request)
- Secuencias: `@@unique([tenantId, tipoECF])` + increment atómico
- Trial: `trialEndsAt` en Tenant, `PlanActivoGuard` en comprobantes
- API keys: hash SHA-256, nunca recuperables
- Webhooks salientes: firma HMAC-SHA256
- Audit log: append-only, retención 10 años (DGII)
- JWT: 15min access + 7 días refresh con rotación

---

## 11. CERTIFICACIÓN DGII (estado actual)
- **RNC:** `132883225` (DMAIA SRL)
- **Portal:** https://ecf.dgii.gov.do/certecf/portalcertificacion
- **Estado:** Paso 7 — Implementado y listo para registro en portal DGII
- **Certificado P12:** `certs/dmaia.p12` (gitignored)
- **Ambiente actual del código:** `certification`
- **Cuando aprueben:** cambiar a `production` en `ecf-engine/src/dgii/`

## 12. RECEPTOR DGII — URLs para registrar (Paso 7)

Con ngrok corriendo (`ngrok http 3000`), registrar en el portal DGII:

```
GET  https://{ngrok}.ngrok-free.app/fe/autenticacion/api/semilla
POST https://{ngrok}.ngrok-free.app/fe/autenticacion/api/validacioncertificado
POST https://{ngrok}.ngrok-free.app/fe/recepcion/api/ecf
POST https://{ngrok}.ngrok-free.app/fe/aprobacioncomercial/api/ecf
```

NOTAS TÉCNICAS DEL RECEPTOR:
- Los endpoints `/fe/*` están FUERA del prefijo `api/v1` (excluidos en main.ts con setGlobalPrefix)
- Redis almacena semillas con TTL 5 min (key: `semilla:{UUID}`)
- Semillas son de UN SOLO USO (se eliminan tras validar — anti-replay)
- JWT de receptor: secret=`JWT_SECRET:receptor-ecf`, issuer=`facturard-receptor-ecf`, TTL=1h
- Validación XMLDSig de la firma del emisor: PENDIENTE para producción (en cert sólo se valida la semilla)
- `comprobanteRecibido.tenantId` → se resuelve por RNCComprador del e-CF vs Tenant.rnc
