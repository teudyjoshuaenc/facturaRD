# FacturaRD — Backend Roadmap (AI Execution Spec)

> **Audience:** AI coding agent operating inside the monorepo.
> **Scope:** Backend only (`apps/api`, `packages/ecf-engine`, `packages/database`). No frontend, no roles/permissions in this phase.
> **Prime directive:** Every sprint ships with passing tests. Do NOT open the next sprint until the current sprint's acceptance tests are green and `pnpm --filter @facturard/api build` exits 0.

---

## 0. Operating Rules (read before any code)

1. **Read before write.** Before implementing any model, run `cat packages/database/prisma/schema.prisma` and inspect existing models (`Tenant`, `Comprobante`, `Certificado`, `Secuencia`, `GhlLocation`). Reuse existing enums, naming conventions (camelCase fields, `@db.Decimal(18,2)` for money), and the multi-tenant pattern (`tenantId` on every table). Match what exists; do not invent parallel conventions.
2. **Multi-tenant isolation is non-negotiable.** Every query in every service MUST filter by the authenticated `tenantId`. A tenant must never read or mutate another tenant's rows. Add an integration test per module that asserts cross-tenant access returns 404 (not 403 — do not leak existence).
3. **Migrations are explicit.** Each schema change ships as its own named migration: `pnpm --filter @facturard/database migrate:dev --name <name>`. Never edit an applied migration.
4. **Money is Decimal.** Never use `Float` for monetary or tax values. Use Prisma `Decimal`. In services, compute with a decimal-safe approach (the codebase already does this in the ecf-engine — reuse the same helper).
5. **Tests are the contract.** Each sprint lists required test files and the assertions they must contain. A sprint is "done" only when those tests exist and pass. Use the framework already configured in the repo (`jest` for `apps/api`, existing setup in `ecf-engine`). If `apps/api` has no test harness yet, set up `jest` + `supertest` against an ephemeral Postgres (Testcontainers or the docker-compose Postgres with a `_test` database) in Sprint 1 as task 0.
6. **No breaking the live path.** The emission pipeline (`Comprobante` create → BullMQ → worker → DGII → PDF → webhook) is in production emitting real invoices. Do not alter its external behavior. You will EXTEND it (draft state, references) without changing the happy path for already-working callers.
7. **Idempotency & concurrency.** Sequence assignment already uses `SELECT ... FOR UPDATE`. Any new numbering (quotes folios) follows the same atomic pattern.
8. **After each sprint:** update `CLAUDE.md` module status and append a one-line changelog entry to this file under `## Changelog`.

---

## 1. Target Domain Model (end state)

Entities to exist after all sprints. Fields are the minimum; keep existing fields on `Tenant`/`Comprobante`.

```
Tenant (exists)
  ├─ branding: logoUrl?, colorPrimario?, colorSecundario?   (Sprint 6)
  ├─ productos      Producto[]
  ├─ contactos      Contacto[]
  ├─ cotizaciones   Cotizacion[]
  ├─ comprasRecibidas CompraRecibida[]
  └─ certificado    Certificado (1:1, exists — extend passphrase persistence, Sprint 1)

Producto (Sprint 2)
Contacto (Sprint 3)  ── used by Comprobante, Cotizacion, CompraRecibida
Cotizacion + CotizacionItem (Sprint 4) ── converts to Comprobante
Comprobante (exists) ── extend: estado DRAFT, contactoId?, cotizacionId?, comprobanteReferenciaId? (Sprints 1,4,5)
CompraRecibida (Sprint 7) ── feeds 606
ReporteFiscal (Sprint 8, may be computed on-the-fly, no table required)
```

Relationship rules the AI must enforce:
- A `Comprobante` MAY reference a `Contacto` (nullable — walk-in / consumidor final needs no contact).
- A `Comprobante` of type `E33`/`E34` (nota débito/crédito) MUST carry `comprobanteReferenciaId` pointing to the referenced invoice, and inherit its `contacto` + fiscal reference (`ncfModificado`, `fechaNCFModificado`).
- A `Cotizacion` MAY convert into exactly one `Comprobante`; store `cotizacionId` on the produced `Comprobante` and flip the quote to `CONVERTIDA`.
- A `Producto` line copied into a comprobante/quote is a **snapshot** (copy name, price, itbis treatment into the item row). Later edits to the `Producto` must not mutate historical documents.

---

## SPRINT 1 — Draft emission + client certificate lifecycle

**Goal:** (a) A comprobante can be created in `DRAFT` (borrador) without going to DGII, persisted with computed totals, then emitted later on demand. (b) A non-DMAIA tenant can fully onboard its own P12 (single file per client) including passphrase, and emit invoices signed under its own certificate.

### 1.0 Test harness
- Stand up `apps/api` e2e test infra (`jest-e2e`, `supertest`, ephemeral Postgres `facturard_test`, Redis mock or real). Provide `pnpm --filter @facturard/api test:e2e`.
- Provide a test factory that creates a tenant + auth token.

### 1.1 Comprobante draft state
- Extend the `Comprobante` estado enum/state with `DRAFT`. Confirm existing states (e.g. `PENDIENTE`, `ACEPTADO`, `RECHAZADO`, `EN_PROCESO`) by reading the schema; add `DRAFT` alongside without removing any.
- Add nullable columns: `contactoId?`, `cotizacionId?`, `comprobanteReferenciaId?`. Migration `--name comprobante-draft-and-refs`.
- **Create endpoint changes:**
  - `POST /api/v1/comprobantes` accepts `emitir: boolean` (default `true` to preserve current behavior).
    - `emitir=false` → validate, compute and persist totals, assign **NO** e-NCF yet (sequence is consumed only at emission), set estado `DRAFT`, return the draft. Does NOT enqueue BullMQ, does NOT hit DGII.
    - `emitir=true` → existing behavior unchanged (assign sequence, enqueue, sign, send).
- **New endpoints:**
  - `GET /api/v1/comprobantes?estado=DRAFT` (filter already supported — verify DRAFT flows through).
  - `PATCH /api/v1/comprobantes/:id` — only allowed while estado is `DRAFT`; edit items/contacto/totales; recompute totals. Reject (409) if not DRAFT.
  - `POST /api/v1/comprobantes/:id/emitir` — transition a `DRAFT` into the live pipeline: assign e-NCF from sequence atomically, enqueue BullMQ, sign, send to DGII. Idempotent: if already non-DRAFT, return 409. This reuses the EXACT existing emission code path — extract it into a reusable service method if it currently only lives inside the create handler.
- **Totals computation** must be identical whether draft or direct emit (single shared function). ITBIS rules: I1=18%, I2=16%, I3=0%, EXENTO excluded from taxable base.

### 1.2 Client certificate + passphrase persistence
- `Certificado` already stores `p12Encrypted`, `p12Iv`, `p12Tag`, `passphraseCifrada` (AES-256-GCM). Verify. If passphrase is not yet persisted on the GHL onboarding path, fix it.
- `POST /api/v1/ghl/onboarding` currently takes `{ locationId, rnc, passphrase }` but does NOT persist passphrase. Change it to also accept the P12 upload (multipart) OR keep P12 upload on the existing `certificados` endpoint and have onboarding just create tenant+location+sequences. Decide by reading current code; the end state required:
  - After onboarding + certificate upload, a client tenant has an encrypted P12 **and** its encrypted passphrase stored, such that the signing engine can decrypt and sign **without any DMAIA fallback**.
- **Signing path audit:** confirm the worker/processor loads the P12 of the *authenticated emitting tenant* (not DMAIA). Add a test: two tenants with two different P12s each emit; assert each XML is signed with its own certificate (verify the X509 subject in the signature matches the tenant's cert).

### 1.3 Required tests (must pass)
- `comprobantes-draft.e2e-spec.ts`
  - creates draft (`emitir=false`) → 201, estado DRAFT, no e-NCF, DGII not called (mock asserts zero calls).
  - patches draft items → totals recomputed correctly (assert ITBIS math for mixed I1/EXENTO lines).
  - emits draft → e-NCF assigned, pipeline invoked once.
  - patch after emission → 409.
  - emit already-emitted → 409.
- `certificado-multitenant.e2e-spec.ts`
  - tenant A and tenant B each onboard a distinct P12+passphrase; each emits; signatures carry the correct distinct subjects.
  - cross-tenant: tenant A cannot GET tenant B's certificado (404).

**Sprint 1 done when:** all above green + build 0.

---

## SPRINT 2 — Producto (catalog)

**Goal:** Product/service catalog feeding emission and quotes. Line items snapshot product data.

### 2.1 Model
```prisma
model Producto {
  id               String   @id @default(uuid())
  tenantId         String
  tipo             String   // "BIEN" | "SERVICIO"
  nombre           String
  descripcion      String?
  precioUnitario   Decimal  @db.Decimal(18,2)
  tratamientoITBIS String   @default("I1") // I1|I2|I3|EXENTO
  unidadMedida     String?  // codificación DGII
  codigo           String?
  categoria        String?
  activo           Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  tenant           Tenant   @relation(fields: [tenantId], references: [id])
  @@unique([tenantId, codigo])
  @@index([tenantId, activo])
}
```
Migration `--name add-producto`.

### 2.2 Endpoints (JWT, tenant-scoped)
- `GET /api/v1/productos` — `?search&categoria&tipo&activo&page&limit`
- `GET /api/v1/productos/:id`
- `POST /api/v1/productos`
- `PATCH /api/v1/productos/:id`
- `DELETE /api/v1/productos/:id` — soft delete (`activo=false`)

DTO validation: `tipo ∈ {BIEN,SERVICIO}`, `tratamientoITBIS ∈ {I1,I2,I3,EXENTO}`, `precioUnitario > 0`, `nombre` required. Unique `codigo` per tenant (validate → 409 on dup).

### 2.3 Integration into emission
- Emission/quote item DTO accepts either `productoId` (snapshot fields copied server-side) or raw fields (ad-hoc line). If `productoId` given, server copies `nombre`, `precioUnitario`, `tratamientoITBIS`, `unidadMedida` into the item snapshot; client-sent overrides for price/qty are allowed but the ITBIS treatment is taken from the product unless explicitly overridden.

### 2.4 Tests — `productos.e2e-spec.ts`
- CRUD happy path.
- duplicate `codigo` → 409.
- soft delete hides from default list, still retrievable by id.
- cross-tenant read/update → 404.
- emitting a comprobante with `productoId` snapshots product fields; mutating the product afterward does NOT change the already-created comprobante item.

---

## SPRINT 3 — Contacto (clients/suppliers) + GHL sync

**Goal:** Contact catalog with DGII RNC validation and GoHighLevel import.

### 3.1 Model
```prisma
model Contacto {
  id                      String   @id @default(uuid())
  tenantId                String
  tipo                    String   // CLIENTE|PROVEEDOR|CONSUMIDOR_FINAL
  rnc                     String?
  razonSocial             String
  nombreComercial         String?
  identificadorExtranjero String?
  paisExtranjero          String?
  direccion               String?
  telefono                String?
  email                   String?
  origen                  String   @default("MANUAL") // MANUAL|GHL
  ghlContactId            String?
  rncValidado             Boolean  @default(false)
  activo                  Boolean  @default(true)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  tenant                  Tenant   @relation(fields: [tenantId], references: [id])
  @@unique([tenantId, rnc])
  @@unique([tenantId, ghlContactId])
  @@index([tenantId, tipo, activo])
}
```
Migration `--name add-contacto`.

### 3.2 Endpoints
- `GET /api/v1/contactos` — `?tipo&search&origen&page&limit`
- `GET /api/v1/contactos/:id`
- `POST /api/v1/contactos`
- `PATCH /api/v1/contactos/:id`
- `DELETE /api/v1/contactos/:id` — soft delete
- On create/update with `rnc` and `tipo != CONSUMIDOR_FINAL`: call existing `DgiiContribuyentesService.buscarPorRNC()`. If found → autocomplete `razonSocial`, set `rncValidado=true`. If DGII API unavailable → persist with `rncValidado=false` + warning in response body (do NOT block).
- Upsert semantics: creating a contact whose `rnc` already exists in the tenant updates instead of duplicating.

### 3.3 GHL sync
- Extend GHL config storage (on `GhlLocation` or a dedicated table): `ghlAccessToken?` (encrypted, same AES-256-GCM helper as P12), `ghlRncFieldKey?`.
- Migration `--name add-ghl-sync-fields`.
- `ghl-contactos.service.ts`:
  ```
  sincronizarContactos(tenantId): { importados, actualizados, sinRnc }
  ```
  - Load + decrypt token. Page through GHL `GET https://services.leadconnectorhq.com/contacts/` (headers `Authorization: Bearer <token>`, `Version: 2021-07-28`).
  - Map: `ghlContactId←id`, `razonSocial←companyName ?? name`, `email`, `telefono←phone`, `rnc←customFields[ghlRncFieldKey]` if configured, `tipo=CLIENTE`, `origen=GHL`.
  - Upsert by `(tenantId, ghlContactId)`.
  - If RNC present → validate via DGII. Count `sinRnc` for contacts imported without RNC.
  - GHL API failure → descriptive error, no silent partial writes (wrap page batch in try/catch, report how many succeeded).
- Endpoints:
  - `POST /api/v1/contactos/sincronizar-ghl` → runs sync for caller's tenant.
  - `PATCH /api/v1/contactos/configurar-ghl` → `{ ghlAccessToken, ghlRncFieldKey }` (token stored encrypted).

### 3.4 Integration into emission
- Comprobante/quote accept `contactoId`. Server copies buyer identity (RNC, razonSocial, dirección, identificadorExtranjero, país) into the document snapshot. `CONSUMIDOR_FINAL` contact or no contact → E32-style buyer-less path preserved.

### 3.5 Tests — `contactos.e2e-spec.ts`
- CRUD + soft delete + cross-tenant 404.
- create with valid RNC (mock DGII) → razonSocial autocompleted, rncValidado true.
- create with RNC while DGII mock is down → persisted, rncValidado false, warning present.
- duplicate RNC → update-in-place, no duplicate row.
- `ghl-sync.e2e-spec.ts`: mock GHL API returning 2 pages; assert importados/actualizados/sinRnc counts; re-run sync → all become "actualizados", zero duplicates; contact with mapped RNC gets validated.

---

## SPRINT 4 — Cotizaciones (non-fiscal → convert to e-CF)

**Goal:** Quotes with internal numbering, convertible into a real comprobante reusing the emission pipeline. Quotes never touch DGII.

### 4.1 Models
```prisma
model Cotizacion {
  id            String   @id @default(uuid())
  tenantId      String
  folio         String   // internal, e.g. COT-000123
  contactoId    String?
  estado        String   @default("BORRADOR") // BORRADOR|ENVIADA|APROBADA|RECHAZADA|VENCIDA|CONVERTIDA
  fechaVigencia DateTime?
  subtotal      Decimal  @db.Decimal(18,2)
  itbis         Decimal  @db.Decimal(18,2)
  total         Decimal  @db.Decimal(18,2)
  comprobanteId String?  // set once converted
  notas         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  items         CotizacionItem[]
  @@unique([tenantId, folio])
  @@index([tenantId, estado])
}

model CotizacionItem {
  id               String   @id @default(uuid())
  cotizacionId     String
  productoId       String?
  nombre           String
  descripcion      String?
  cantidad         Decimal  @db.Decimal(18,3)
  precioUnitario   Decimal  @db.Decimal(18,2)
  tratamientoITBIS String
  unidadMedida     String?
  cotizacion       Cotizacion @relation(fields: [cotizacionId], references: [id], onDelete: Cascade)
}
```
Migration `--name add-cotizacion`.

### 4.2 Folio numbering
- Atomic per-tenant counter for quote folios (reuse the `SELECT FOR UPDATE` pattern; a `secuencias`-like row keyed by tenant, or a dedicated `CotizacionFolio` counter). Folios are internal, NOT e-NCF, and never sent to DGII.

### 4.3 Endpoints
- `GET /api/v1/cotizaciones` — `?estado&contactoId&search&page&limit`
- `GET /api/v1/cotizaciones/:id`
- `POST /api/v1/cotizaciones` — items from `productoId` or raw; compute totals; estado BORRADOR.
- `PATCH /api/v1/cotizaciones/:id` — allowed unless estado ∈ {CONVERTIDA}. Recompute totals.
- `PATCH /api/v1/cotizaciones/:id/estado` — transitions (BORRADOR→ENVIADA→APROBADA/RECHAZADA; auto VENCIDA if past fechaVigencia — compute on read).
- `POST /api/v1/cotizaciones/:id/convertir` — **the key flow.** Body may specify target `tipoECF` (default E31 if contacto has RNC, else E32) and `emitir` (default false → produces a DRAFT comprobante; true → emits immediately).
  - Builds a comprobante from the quote (contacto + item snapshots), links `comprobante.cotizacionId` and `cotizacion.comprobanteId`, flips quote to CONVERTIDA.
  - Reuses Sprint 1 draft/emit machinery. Converting is idempotent: a CONVERTIDA quote returns 409 on re-convert.

### 4.4 Tests — `cotizaciones.e2e-spec.ts`
- CRUD + folio uniqueness + monotonic folios under concurrency (fire N parallel creates, assert no folio collision).
- totals math matches emission math for identical items.
- convert with `emitir=false` → DRAFT comprobante exists, quote CONVERTIDA, bidirectional link set, DGII not called.
- convert then emit the resulting draft → e-NCF assigned.
- re-convert CONVERTIDA → 409.
- cross-tenant 404.

---

## SPRINT 5 — Notas de Crédito/Débito from an existing invoice (E33/E34)

**Goal:** Emit E33 (débito) / E34 (crédito) referencing an existing accepted comprobante, inheriting the fiscal reference. Generators already exist in ecf-engine; wire the app layer.

### 5.1 Endpoint
- `POST /api/v1/comprobantes/:id/nota` — body `{ tipo: "E33"|"E34", codigoModificacion, razonModificacion, items?, indicadorNotaCredito? }`.
  - Source comprobante must be `ACEPTADO`. Validate.
  - Build the note inheriting `contacto`, and set `ncfModificado` = source e-NCF, `fechaNCFModificado` = source emission date, `comprobanteReferenciaId` = source id.
  - Follows draft/emit conventions: default `emitir=true` here (notes are usually immediate), but allow `emitir=false` for a draft note.
  - Reuse existing E33/E34 XML generators and the emission pipeline.

### 5.2 Rules
- `codigoModificacion` validated against DGII-allowed values (1–5). E34 (crédito) vs E33 (débito) selects the correct generator and reference semantics already implemented in ecf-engine — do not reimplement, call them.

### 5.3 Tests — `notas.e2e-spec.ts`
- note on non-ACEPTADO source → 409.
- E34 references source correctly (assert `ncfModificado`, `comprobanteReferenciaId`, inherited contacto in the produced XML input).
- emitted note goes through pipeline once.
- cross-tenant: cannot create a note on another tenant's invoice (404).

---

## SPRINT 6 — Tenant branding in PDF

**Goal:** Per-tenant logo + colors in the printed representation, with safe fallback to current defaults.

### 6.1 Model
- Add to `Tenant`: `logoUrl?`, `colorPrimario?`, `colorSecundario?`. Migration `--name add-tenant-branding`.

### 6.2 PDF engine
- `packages/ecf-engine/src/pdf/index.ts`: extend the PDF input with optional `logoUrl?`, `colorPrimario?`, `colorSecundario?`.
  - If provided, use in header + accents. If absent, current defaults (do not regress DMAIA output).
  - Logo: if `logoUrl` is http(s), fetch with timeout + size cap; if local path, read; on any failure, omit logo, never crash the PDF.
- The caller that assembles PDF input (processor / comprobantes service) passes the tenant's branding fields.

### 6.3 Endpoint
- `PATCH /api/v1/tenants/branding` — `{ logoUrl?, colorPrimario?, colorSecundario? }`. Validate colors are hex (`^#[0-9A-Fa-f]{6}$`). (Real file upload/storage deferred; accept URL for now, keep the contract upload-ready.)

### 6.4 Tests
- `branding.e2e-spec.ts`: set branding → PDF generation uses provided color (assert on generated PDF input object or a rendered-color probe); invalid hex → 400; unreachable logo URL → PDF still generated without logo.

---

## SPRINT 7 — Recepción y Compras (feeds 606)

**Goal:** Register supplier purchases (E41 and manual), give commercial approval to received e-CF. The DGII receiver endpoints (`/fe/*`) already exist; add the application/persistence layer.

### 7.1 Model
```prisma
model CompraRecibida {
  id               String   @id @default(uuid())
  tenantId         String
  contactoId       String?  // supplier
  tipo             String   // "E41" | "GASTO_MENOR" | "SIN_COMPROBANTE" | "RECIBIDO_ECF"
  ncf              String?  // supplier's NCF/e-NCF
  rncProveedor     String?
  razonSocialProveedor String?
  fechaComprobante DateTime?
  subtotal         Decimal  @db.Decimal(18,2)
  itbis            Decimal  @db.Decimal(18,2)
  itbisRetenido    Decimal  @db.Decimal(18,2) @default(0)
  total            Decimal  @db.Decimal(18,2)
  estadoAprobacion String?  // for received e-CF: APROBADO|RECHAZADO|PENDIENTE
  origen           String   @default("MANUAL") // MANUAL|RECEPCION_DGII
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  tenant           Tenant   @relation(fields: [tenantId], references: [id])
  @@index([tenantId, fechaComprobante])
}
```
Migration `--name add-compra-recibida`.

### 7.2 Endpoints
- `GET /api/v1/compras` — `?tipo&fechaDesde&fechaHasta&search&page&limit`
- `GET /api/v1/compras/:id`
- `POST /api/v1/compras` — manual registration (E41 / gasto menor / sin comprobante). Supplier via `contactoId` or raw RNC.
- `PATCH /api/v1/compras/:id`
- `DELETE /api/v1/compras/:id`
- `POST /api/v1/compras/:id/aprobacion-comercial` — `{ decision: "APROBADO"|"RECHAZADO" }` for received e-CF; calls the existing `/fe/aprobacioncomercial` engine path to notify DGII, persists the decision.
- **Bridge:** when the `/fe/recepcion` receiver accepts an inbound e-CF for a tenant, persist a `CompraRecibida` with `origen=RECEPCION_DGII`, `tipo=RECIBIDO_ECF`, `estadoAprobacion=PENDIENTE`. (Extend the existing receiver handler; do not change its DGII-facing contract.)

### 7.3 Tests — `compras.e2e-spec.ts`
- manual CRUD + cross-tenant 404.
- inbound receiver e-CF creates a CompraRecibida (simulate a receiver call, assert row).
- commercial approval transitions estadoAprobacion and invokes the approval engine (mock asserts one call).

---

## SPRINT 8 — Reportes 606 / 607 / 608

**Goal:** Generate DGII fiscal report datasets by date range. Computation from existing data; no persistence required (compute-on-request). Output a structured JSON the frontend/exporter can turn into the DGII TXT format; also provide the TXT.

### 8.1 Endpoints
- `GET /api/v1/reportes/607?desde&hasta` — sales: from `Comprobante` where estado ACEPTADO and type is a sales e-CF (E31/E32/E33/E34/E44/E45/E46) in range. Fields per DGII 607 layout (RNC/cédula comprador, tipo id, NCF, fecha, montos, ITBIS).
- `GET /api/v1/reportes/606?desde&hasta` — purchases: from `CompraRecibida` in range (DGII 606 layout).
- `GET /api/v1/reportes/608?desde&hasta` — voided: comprobantes anulados in range.
- Each supports `?formato=json|txt`. `txt` returns the DGII pipe/positional format; `json` returns rows + totals.

### 8.2 Rules
- Amounts summed with decimal safety. Group/format exactly per current DGII 606/607/608 specs — **read the DGII layout doc referenced in CLAUDE.md before formatting**; if uncertain about a column, emit it in JSON and leave the TXT column blank rather than guessing wrong.
- Tenant-scoped strictly.

### 8.3 Tests — `reportes.e2e-spec.ts`
- seed known comprobantes/compras → 607/606 row counts and totals match hand-computed expectations.
- date-range boundaries inclusive/exclusive correct.
- txt line count == data row count; no header leakage into totals.
- cross-tenant isolation.

---

## SPRINT 9 — Cumplimiento (read-only fiscal dashboard data)

**Goal:** Aggregate endpoint(s) surfacing fiscal health. Pure reads, no new tables.

### 9.1 Endpoint
- `GET /api/v1/cumplimiento` returns:
  - `certificado`: { vigente: bool, diasRestantes, vencido: bool }.
  - `secuencias`: per tipo → { disponibles, porAgotarse: bool, venceEn? }.
  - `comprobantesConProblema`: count of RECHAZADO in last N days + ids.
  - `reportesPendientes`: which of 606/607 for the current period have not been generated/exported (based on a simple flag or last-export timestamp — if not tracked, report as "no generado" heuristically by period).
  - `indicadorGeneral`: derived OK/WARN/CRITICAL.

### 9.2 Tests — `cumplimiento.e2e-spec.ts`
- expiring certificate → WARN; expired → CRITICAL + emission-block flag surfaced.
- rejected invoices reflected in count.
- tenant isolation.

---

## SPRINT 10 — Migration sequence sync (fixes DGII error 1209)

**Goal:** Let a migrating client set their last-used e-NCF per type so FacturaRD continues numbering from `last+1`, preventing `[1209] secuencia ya utilizada`.

### 10.1 Endpoint
- `POST /api/v1/secuencias/sincronizar` — body: `[{ tipoECF, ultimaSecuencia }]`. Sets `ultima_secuencia` per (tenant, tipo). Guard: new value must be `>=` current stored value (never move a sequence backwards; reject 409). Atomic via existing `SELECT FOR UPDATE`.
- Wire into onboarding: an optional step "¿ya emitías e-CF? última secuencia por tipo" persists via this endpoint. New clients (no prior emission) start at 1 with no action.

### 10.2 Tests — `secuencias-sync.e2e-spec.ts`
- set higher last sequence → next assigned = last+1.
- attempt to lower a sequence → 409.
- new tenant, no sync → starts at 1.
- concurrent assignment after sync → no collision (parallel emits produce distinct consecutive e-NCFs).

---

## Cross-Cutting Acceptance (must hold after every sprint)

1. `pnpm --filter @facturard/api build` → exit 0, no TS errors.
2. `pnpm --filter @facturard/api test:e2e` → all green.
3. `pnpm --filter @facturard/ecf-engine test` → still 112+/all green (no regressions).
4. No endpoint returns another tenant's data (add the isolation test in each module).
5. The production emission happy path is unchanged for existing callers (a regression test emits a plain E31 exactly as before and asserts pipeline parity).

## End-to-End Scenario Test (run after Sprint 5, expand after 8)

`flujo-completo.e2e-spec.ts` — proves modules interlock:
1. Create Producto (servicio, I1) and Contacto (CLIENTE with valid RNC, mocked DGII).
2. Create Cotizacion using that product+contact → totals correct, estado BORRADOR → ENVIADA → APROBADA.
3. Convert quote with `emitir=false` → DRAFT comprobante, quote CONVERTIDA, DGII not called.
4. Emit the draft → e-NCF assigned, pipeline invoked, estado transitions past DRAFT.
5. Create an E34 nota crédito on the emitted invoice → references it correctly.
6. `GET /reportes/607` for the period → includes the invoice; `/608` reflects nothing yet; after the nota crédito, amounts reconcile.
Assert every cross-entity link (cotizacion.comprobanteId, comprobante.cotizacionId, nota.comprobanteReferenciaId) is set and tenant-scoped.

## Suggested Order & Dependencies

```
Sprint 1 (draft + client certs)  ── foundation, unblocks everything
   ├─ Sprint 2 (Producto) ─┐
   ├─ Sprint 3 (Contacto) ─┴─ both feed →
   │        └─ Sprint 4 (Cotizaciones) → depends on 1,2,3
   ├─ Sprint 5 (Notas CD) → depends on 1
   ├─ Sprint 6 (Branding) → independent, can slot anytime after 1
   ├─ Sprint 7 (Compras) → depends on 3
   │        └─ Sprint 8 (Reportes) → depends on 1(sales),7(purchases)
   │                └─ Sprint 9 (Cumplimiento) → depends on 1,8
   └─ Sprint 10 (Seq sync) → depends on 1, high real-world priority (do early if a migrating client onboards)
```

## Changelog
<!-- append: [date] SprintN — summary — tests: X passing -->
- [2026-07-01] Sprint 1 — draft emission (estado DRAFT, eNCF nullable, PATCH draft, POST :id/emitir) + e2e harness (jest-e2e/supertest, Postgres efímero 5433, cola mockeada) + auditoría de firma multi-tenant. Migración `comprobante-draft-and-refs`. Tests: 11 e2e passing, 112 ecf-engine passing, build 0.
- [2026-07-01] Sprint 2 — Producto (catálogo CRUD + soft delete, código único por tenant) e integración de snapshot (item con productoId copia nombre/precio/ITBIS/unidad; editar el producto no muta documentos previos). Migración `add-producto`. Tests: productos.e2e-spec.ts.
- [2026-07-01] Sprint 3 — Contacto (CRUD + soft delete, validación RNC vs DgiiContribuyentesService con warning no bloqueante, upsert por RNC) + sync GHL (token cifrado AES-256-GCM + ghlRncFieldKey por tenant, paginación, conteo importados/actualizados/sinRnc) + snapshot comprador (contactoId) en emisión. Migraciones `add-contacto`, `add-ghl-sync-fields`. Tests: contactos.e2e-spec.ts, ghl-sync.e2e-spec.ts. Total e2e: 24 passing, 112 ecf-engine passing, build 0.
