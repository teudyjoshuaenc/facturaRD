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
- ✅ Comprobantes — borradores DRAFT (crear emitir=false), PATCH draft, POST :id/emitir (Sprint 1)
- ✅ Certificados — firma multi-tenant verificada (cada tenant firma con su P12, sin fallback DMAIA)
- ✅ Test harness e2e — `pnpm --filter @facturard/api test:e2e` (Postgres efímero 5433, cola BullMQ mockeada)
- ✅ Productos — catálogo CRUD + soft delete; snapshot de producto en items al emitir (Sprint 2)
- ✅ Contactos — CRUD + soft delete, validación RNC vs DGII, upsert por RNC; snapshot comprador al emitir (Sprint 3)
- ✅ Contactos GHL — sincronización (GET services.leadconnectorhq.com/contacts), token cifrado + ghlRncFieldKey por tenant (Sprint 3)
- ✅ Cotizaciones — folio interno atómico (COT-000001), items snapshot (incl. indicadorBienoServicio), estados, convertir→comprobante reutilizando ComprobantesService.crear (Sprint 4)
- ✅ Notas CD — POST /comprobantes/:id/nota (E33/E34) sobre fuente ACEPTADO, hereda comprador + referencia fiscal, reutiliza pipeline (Sprint 5)
- ✅ Branding — logoUrl/colorPrimario/colorSecundario en Tenant, PDF con logo (fetch 5s/2MB, tolerante) y colores; PATCH /tenants/branding valida hex (Sprint 6)
- ✅ Compras — CompraRecibida CRUD (E41/GASTO_MENOR/SIN_COMPROBANTE), bridge receptor /fe/recepcion → CompraRecibida (RECEPCION_DGII, aditivo, no cambia el ARECF), aprobación comercial reusando el motor ACECF del ecf-engine (Sprint 7)
- ✅ Reportes DGII — GET /reportes/607|606|608 (json|txt). TXT oficial COMPLETO: delimitado por pipe, encabezado `RNC|codigo|AAAAMM|cantidad` + detalle en orden exacto (606: 23 campos, layout feb-2026; 607: 23 campos, layout dic-2025; 608: 3 campos, catálogo anulación verificado). Nombre archivo `DGII_F_{fmt}_{RNC}_{AAAAMM}.TXT`, modo "en cero", suma decimal-safe, catálogos centrales (`reportes.catalogo.ts`). Campos no capturados van VACÍOS (no se inventan). (Sprint 8)
  - **607 Facturas de Consumo (E32 < RD$250,000):** NO van al detalle del TXT; se reportan como RESUMEN AGREGADO (cantidad + monto) que se carga en la OFV. Método `resumenFacturasConsumo()` lo calcula aparte. E32 ≥ 250,000 sí van al detalle.
  - **608 con e-CF:** los e-CF anulados se gestionan por NOTA DE CRÉDITO / cancelación electrónica que la DGII recibe directamente, NO por el 608 (que aplica sobre todo a comprobantes físicos serie B). Para tenants 100% e-CF el 608 normalmente será en cero. El generador mapea la anulación por nota (codigoModificacion=1) al catálogo (código 4 = Corrección de la información; motivos e-CF realistas: 4,5,6,7).
- ✅ Cumplimiento — GET /cumplimiento (certificado/secuencias/rechazos/reportes + indicadorGeneral OK/WARN/CRITICAL, flag bloqueaEmision) (Sprint 9)
- ✅ Secuencias sync — POST /secuencias/sincronizar (guard no-retroceso 409, atómico; fix error 1209) (Sprint 10)
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
5. ~~Reportes DGII — 606, 607, 608~~ ✅ GET /reportes/607|606|608 (json|txt) — Sprint 8
6. Suscripciones — Azul/CardNet
7. Frontend Next.js 16.2
8. Cambiar ENV a producción cuando certifiquen

**Backend roadmap (BACKEND_ROADMAP.md) COMPLETO — Sprints 1-10 + TXT oficial reportes.** 65 tests e2e + 112 ecf-engine, build 0.
TXT reportes 606/607/608 implementado contra los instructivos oficiales DGII (606 feb-2026,
607 dic-2025, 608 catálogo verificado). Los campos que aún no capturamos por comprobante/compra
van vacíos (nunca se inventan); ver `reportes.catalogo.ts` para los códigos por defecto.

---

## 8bis. FIXES DE CUMPLIMIENTO DGII (auditoría normativa)

- ✅ **FIX 2 — EXENTO → IndicadorFacturacion 4 (ya correcto).** Verificado end-to-end: producto `EXENTO`
  → string interno `'E'` en `datos` → `mapIndicador('E')` = **4** en el XML; el `'E'` nunca llega al XML
  y el ítem queda fuera de la base gravada de ITBIS. Sin cambios de código.
- ✅ **FIX 3 — 606 excluye compras sin NCF.** `reporte606` filtra `tipo !== 'SIN_COMPROBANTE'` y NCF no
  vacío (el 606 exige NCF en el campo 4). Las SIN_COMPROBANTE siguen visibles en `/compras`, solo se
  excluyen del TXT/JSON del 606.
- ✅ **FIX 4 — E32 ≥ RD$250,000 exige identificación del comprador.** `crear()` (emisión) y `emitir()`
  rechazan con 400 un E32 sobre el umbral sin RNC/Cédula ni identificador extranjero. Umbral en la
  constante `UMBRAL_IDENTIFICACION_E32` (comprobantes.service.ts). Por debajo del umbral, permitido.
- ✅ **FIX 1 — IndicadorNotaCredito (regla de 30 días) — APLICADO con el XSD oficial vigente.**
  - Se **reemplazaron por completo** los XSD del repo de **e-CF 33 y e-CF 34 v.1.0** por los oficiales
    vigentes de la DGII (fecha oficial 01/04/2026). No fue solo el campo: se adoptó el esquema entero.
  - `IndicadorNotaCredito` (solo E34) pasó de `enum {1,2}` ("Anulación/Corrección") a **`integer 0..1`
    OBLIGATORIO** (`minOccurs=1`). Semántica **0/1 por regla de 30 días**: `0` si el e-CF afectado tiene
    ≤30 días calendario respecto a la fecha de la nota; `1` si >30 (y con `1` la nota **NO rebaja ITBIS** —
    Ley 11-92 Art. 338 párrafo; Reglamento 293-11 Art. 8).
  - **Cálculo automático** en `POST /comprobantes/:id/nota` (E34): el servidor compara `fechaEmision` del
    comprobante fuente con la fecha de la nota (`diasCalendarioEntre`), `>30 → 1`, si no `0`. **La fecha
    manda**: si el caller envía un valor, se ignora. Cuando es `1`, la respuesta incluye `avisoITBIS`.
  - **E33 no lleva el campo** (no existe en su XSD) — no se agrega.
  - Tipo del engine `IdDoc34.indicadorNotaCredito` = `0 | 1`; DTOs (`crear-nota.dto.ts`,
    `create-comprobante.dto.ts`) actualizados a `0|1` (se eliminó la semántica `1|2`).
  - Otros cambios adoptados del esquema oficial (no afectan a los generadores actuales, que emiten un
    subconjunto válido): E34 elimina `FechaVencimientoSecuencia` y las tablas de forma de pago; añade
    `IdentificadorExtranjero`, `RazonModificacion`, bloque `Mineria`; `Item`/`Pagina` hasta 10000
    (`Integer4→Integer5`); varios campos pasan a opcionales. E33 mantiene `FechaVencimientoSecuencia` y
    añade `IndicadorEnvioDiferido`/`IndicadorMontoGravado`/`Mineria`. **E31/E32 no se tocaron** (sus XSD
    son standalone y siguen usando `Integer4…`).
  - Verificado: E31/E32/E33/E34 generan XML que **valida contra los XSD nuevos** (ecf-engine 114 tests);
    `0` y `1` pasan la validación y `2` es rechazado por el XSD (`maxInclusive 1`).

### Comportamiento actual de REINTENTO tras rechazo (investigado, sin modificar — FIX 5)
- El **e-NCF se asigna al crear/emitir** (`SecuenciasService.siguienteENCF`, atómico) y se persiste
  antes de que corra el worker.
- **Error técnico** en el worker (excepción: red/DGII sin trackId) → BullMQ reintenta el **mismo job con
  el mismo e-NCF** hasta 3× (backoff exponencial); si agota, estado `ERROR`.
- **Rechazo formal de la DGII** (respuesta "rechazado") es un retorno normal, **no** excepción → **no se
  reintenta**; `RECHAZADO` es terminal.
- **No hay endpoint de re-emisión**: `/comprobantes/:id/emitir` solo acepta `DRAFT` (409 en otros estados).
  Para reintentar tras un rechazo, el usuario **crea un comprobante NUEVO → consume un e-NCF NUEVO**; el
  e-NCF rechazado queda "quemado" en `RECHAZADO` y **no se reutiliza**.
- **DECISIÓN ABIERTA (pendiente, no resuelta):** un e-NCF **rechazado queda "quemado"** y **hoy NO se
  reporta en el 608** (que solo reporta anulados por nota `codigoModificacion=1`). ¿Debe un e-NCF
  rechazado/quemado reportarse como anulado en el 608? — pregunta abierta para decidir más adelante.

### MANTENIMIENTO RECURRENTE — XSD oficiales DGII
- **Verificar periódicamente** si la DGII publicó nuevas versiones de los XSD oficiales (portal
  **Documentación Técnica / XSD**) y compararlas contra las del repo
  (`packages/ecf-engine/src/xml/schemas/`). Los XSD del repo **deben mantenerse alineados con los
  oficiales vigentes**.
- **Última alineación:** e-CF 33 y 34 **v.1.0 con fecha oficial 01/04/2026**. (e-CF 31/32 pendientes de
  re-verificar contra el portal en la próxima revisión.)

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
- La DGII no tiene API pública oficial para validar RNC/razón social
- API validación RNC: `https://api-dgii.dominicantechnology.com/api/v1/rnc/{rnc}`
  - Respuesta: `{ exito, fuente, data: { rnc, razon_social, actividad_economica, fecha_inicio, estado, regimen_pago } }`
  - 404 con `{ error }` si el RNC no existe
  - Límite: 100 requests/día por IP en plan gratuito (considerar plan de pago para producción)

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

---

## 13. FRONTEND

**Stack:** Next.js 15, TypeScript strict, Tailwind CSS, React Query v5, Sonner (toasts), Axios

**Rutas (App Router, route group `(dashboard)`):**
```
/                → entry point: lee ?location_id, decide onboarding o dashboard
/onboarding      → wizard 4 pasos + éxito: 1) Negocio (RNC vs DGII) →
                   2) Certificado (captura .p12/.pfx + passphrase) →
                   3) Cuenta (POST /ghl/onboarding multipart transaccional, guarda JWT;
                      un 400 vuelve al paso 2 sin perder el RNC validado) →
                   4) Secuencias (opcional: POST /secuencias/sincronizar; "Omitir" visible) →
                   éxito → CTA a /nueva-factura
/dashboard       → métricas del mes + facturas recientes
/facturas        → lista paginada con filtros por estado y búsqueda
/nueva-factura   → formulario emitir comprobante (E31/E32)
/configuracion   → empresa, certificado P12, webhook GHL
```

**Comandos:**
```bash
pnpm --filter @facturard/web dev    # puerto 3001
pnpm --filter @facturard/web build  # build producción
```

**Variables de entorno (`apps/web/.env.local`):**
```env
NEXT_PUBLIC_API_URL=https://better-invoice-production.up.railway.app/api/v1
```

**Deploy:** Vercel — root directory en Vercel debe ser `facturard/apps/web` (no la raíz del monorepo).
El `vercel.json` en `apps/web/` usa `cd ../.. && pnpm install` / `cd ../.. && pnpm --filter @facturard/web build`
para instalar y construir desde la raíz del workspace, y fija `outputDirectory: ".next"` explícito
(la auto-detección de Vercel para monorepos Turborepo duplicaba el path a `apps/web/apps/web/.next`).

**Arquitectura clave:**
- Autenticación: GHL iframe → GET /ghl/init → JWT en localStorage (`frd_token`)
- Sin login propio: el entry point `/` siempre arranca desde GHL con `?location_id`
- Sin `location_id` → pantalla "Abre FacturaRD desde GoHighLevel" (acceso inválido)
- Interceptor 401: re-llama GET /ghl/init con el `frd_location_id` guardado para refrescar el token
- Estado global: AuthContext (token + tenant) + UIContext (sidebar abierto/cerrado)
- Server state: React Query con queryKey tipados por recurso

**Onboarding transaccional (backend `POST /ghl/onboarding`):**
- Es **multipart/form-data**: `locationId`, `rnc`, `passphrase` y el archivo P12 en `file`.
- En UNA transacción atómica: valida RNC (DGII) + valida/cifra el P12 (reusa `CertificadosService.buildCertificadoData`, mismo AES-256-GCM que `/certificados/upload`) → crea Tenant + GhlLocation + secuencias base + Certificado. Si algo falla, rollback total (sin tenant ni certificado huérfanos). Devuelve el JWT del tenant nuevo.
- Passphrase incorrecta o P12 inválido → 400 y NO se crea nada. Location/RNC ya registrados → 409.
- `POST /certificados/upload` sigue vigente para RE-subir/renovar el certificado de un tenant existente.

---

## 14. TIPOS DE e-CF — FUENTE: PDF DGII v1.0 (octubre 2025)

Obligatoriedad: 0=No aplica, 1=Obligatorio, 2=Condicional, 3=Opcional

| Campo                    | E31 | E32 | E33 | E34 | E41 | E43 | E44 | E45 | E46 | E47 |
|--------------------------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| FechaVencimientoSecuencia|  1  |  0  |  1  |  0  |  1  |  1  |  1  |  1  |  1  |  1  |
| IndicadorNotaCredito     |  0  |  0  |  0  |  1  |  0  |  0  |  0  |  0  |  0  |  0  |
| TipoIngresos             |  1  |  1  |  1  |  1  |  0  |  0  |  1  |  1  |  1  |  0  |
| TipoPago                 |  1  |  1  |  1  |  1  |  1  |  3  |  1  |  1  |  1  |  3  |
| RNCComprador             |  1  |  2  |  2  |  2  |  1  |  0  |  2  |  1  |  2  |  0  |
| IdentificadorExtranjero  |  0  |  3  |  0  |  0  |  0  |  0  |  0  |  0  |  3  |  2  |
| RazonSocialComprador     |  1  |  2  |  2  |  2  |  1  |  0  |  1  |  1  |  1  |  3  |
| PaisComprador            |  0  |  0  |  0  |  0  |  0  |  0  |  0  |  0  |  2  |  1  |
| InformacionReferencia    |  2  |  0  |  1  |  1  |  2  |  2  |  2  |  2  |  2  |  2  |

**Restricciones de IndicadorFacturacion por tipo:**
- E43: DEBE ser 4 (Exento) — no aplica ITBIS
- E46: DEBE ser 3 (ITBIS 0% — tasa cero exportaciones)
- E47: IndicadorBienoServicio DEBE ser 2 (Servicio)

**CodigoModificacion (InformacionReferencia):**
- 1=Anulación total, 2=Corrección montos, 3=Corrección texto, 4=Reemplazo NCF contingencia, 5=Ref. factura consumo

**Implementación:**
- Generadores XML: `packages/ecf-engine/src/xml/` (e32/, e33-34/, e41-47/)
- DTOs API: `apps/api/src/modules/comprobantes/dto/create-comprobante.dto.ts`
- Processor: `apps/api/src/modules/comprobantes/ecf-emission.processor.ts`
- Frontend: `apps/web/src/components/nueva-factura/ComprobanteForm.tsx`

---

NOTAS TÉCNICAS DEL RECEPTOR:
- Los endpoints `/fe/*` están FUERA del prefijo `api/v1` (excluidos en main.ts con setGlobalPrefix)
- Redis almacena semillas con TTL 5 min (key: `semilla:{UUID}`)
- Semillas son de UN SOLO USO (se eliminan tras validar — anti-replay)
- JWT de receptor: secret=`JWT_SECRET:receptor-ecf`, issuer=`facturard-receptor-ecf`, TTL=1h
- Validación XMLDSig de la firma del emisor: PENDIENTE para producción (en cert sólo se valida la semilla)
- `comprobanteRecibido.tenantId` → se resuelve por RNCComprador del e-CF vs Tenant.rnc
