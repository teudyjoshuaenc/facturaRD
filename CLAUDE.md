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
- Deploy: VPS propio con Docker Compose (api + web + postgres + redis) detrás del nginx del host — ver `deploy/README.md`
- API Clients: openapi-typescript + openapi-fetch

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
- ✅ Onboarding sin certificado — usuarios NO certificados ante la DGII pueden registrarse (RNC o
  Cédula), cotizar y guardar borradores; se certifican después. `POST /ghl/onboarding` con P12
  opcional; `assertPuedeEmitir` bloquea la emisión sin cert; `puedeEmitir`/`motivoNoEmite` en
  `GET /tenants` y `/cumplimiento`; sección "Certificación fiscal" en Configuración (Sprint 11)
- ✅ Datos del emisor + Empresa + PDFs (Ajustes UI 2026-07-15) — `Tenant.telefono`/`email` nuevos
  (migración `20260715000000_add_tenant_emisor_contacto`); `PATCH /tenants/empresa`
  (dirección/teléfono/correo/logoUrl; **RNC y razón social NO editables**, vienen de DGII). El bloque
  emisor del PDF ahora incluye dirección/teléfono/correo. **Logo por URL**: `logoUrl` es una URL http(s)
  pública que el motor PDF descarga; **subida de archivo real (blob storage) queda PENDIENTE/futuro**.
  Motor PDF con `modo: 'ECF'|'BORRADOR'|'COTIZACION'`: `GET /comprobantes/:id/pdf` sirve borradores/
  pendientes como vista previa (sin QR) además de los aceptados (rechazado/error → 404);
  `GET /cotizaciones/:id/pdf` genera el PDF de cotización (folio COT-xxxx, sin e-NCF/QR, leyenda no
  fiscal). Cotizaciones: crear = "Guardar" (BORRADOR), *Enviar*/*Convertir con confirmación*/*PDF* en el
  detalle, badge CONVERTIDA→"Facturada" con enlace a la factura. Historial de detalle limpiado a eventos
  reales (factura) / eliminado el inventado (cotización). Sidebar sin bloque de usuario; header sin chip
  de automatización ni campana.
- ✅ **Nota de venta interna (documento sin comprobante) — Fase 2 (Sprint 12).** "Emitir" ≠ "enviar a la
  DGII": el usuario crea una factura y elige la CLASE. Migración aditiva
  `20260716000000_add_nota_venta_interna`: `Comprobante.esFiscal Boolean @default(true)`,
  `folioInterno String?` (unique por tenant), `eliminado Boolean @default(false)`, estado enum `INTERNO`,
  y tabla contador `documento_folios` (mismo patrón atómico que `cotizacion_folios`).
  - **Backend:** `POST /comprobantes` con `esFiscal:false` → rama nueva en `crear()` ANTES de toda
    lógica de emisión: asigna `folioInterno` (`NV-000001`, `DocumentoFolioService`), estado `INTERNO`;
    **NO consume e-NCF, NO firma, NO encola BullMQ, NO toca la DGII**, no exige certificado ni campos
    fiscales. `actualizarDraft` ahora edita DRAFT **o** nota (`esFiscal=false`) — un e-CF emitido sigue
    inmutable (409). `DELETE /comprobantes/:id` = soft-delete SOLO de notas (`eliminado=true`; fiscal→409).
    `findAll` excluye `eliminado` y acepta `?clase=fiscal|borrador|nota`. `findOne` excluye eliminados.
    `resumen` (dashboard) filtra `esFiscal:true`. **Doble defensa reportes:** 607 y 608 con `esFiscal:true`
    explícito (las notas nunca entran a 606/607/608).
  - **PDF:** nuevo `PdfModo='INTERNO'` (espejo de 'COTIZACION'): sin QR/timbre, título "NOTA DE VENTA",
    folio `NV-xxxx`, leyenda "no es un e-CF". Servido por el mismo `GET /comprobantes/:id/pdf`.
  - **Puente nota→fiscal (solo PREFILL en v1):** el botón "Facturar formalmente" abre el form fiscal
    prellenado vía `?cloneId=` — es una **emisión NUEVA** (e-NCF/firma/DGII), NO muta la nota. Sin enlace
    bidireccional ni columna `documentoOrigenId` todavía (pendiente si el flujo se usa).
  - **Frontend:** "Emitir" fuera del sidebar; botón "Crear factura" en `/facturas`; toggle en el form
    "Factura fiscal (e-CF)"/"Nota de venta (sin comprobante)" (reusa `ComprobanteForm`; en nota, un solo
    botón "Crear nota de venta", sin cert ni campos fiscales); badge "Nota de venta" + folio `NV-` en la
    lista; filtro "Clase"; acciones editar/eliminar en filas de nota. Fix colateral: el PATCH del hook ya
    NO envía `emitir` (el UpdateDTO lo omite → antes 400 latente en edición de borrador).
  - **Tests:** `nota-venta.e2e-spec.ts` (10 casos: no e-NCF/firma/cola, folio atómico, sin cert, editable,
    soft-delete, filtro clase, fiscal inmutable PATCH+DELETE→409, regresión DMAIA, puente prefill, doble
    defensa 607). **113 e2e + 118 ecf-engine, build 0. DMAIA fiscal intacto.**
- ✅ **Finanzas — flujo de caja (ingresos/egresos) — Sprint 13.** Módulo **NO fiscal**, 100% de LECTURA
  sobre lo fiscal + tablas propias. **Aislamiento total: NO consume e-NCF, NO firma, NO encola, NO toca
  el estado DGII, NO altera secuencias ni los reportes 606/607/608.** Migración aditiva
  `20260720161637_add_finanzas` (sólo tablas/enums nuevos; cero `ALTER` de columnas fiscales).
  - **Modelos:** `MovimientoFinanciero` (manuales: INGRESO/EGRESO × categoría NOMINA|ALQUILER|SERVICIOS|
    PRESTAMO|APORTE_CAPITAL|IMPUESTOS|OTROS), `Pago` (COBRO sobre factura / PAGO sobre compra — sólo
    referencia contable, pagos parciales, `onDelete SET NULL`), `CapitalInicial` (uno por tenant). Todos
    Decimal(18,2), `moneda` default DOP (no se mezclan monedas).
  - **Endpoints** (`/api/v1/finanzas`, JWT + tenant-scoped): `movimientos` CRUD; `pagos`
    (`POST`/`GET`/`DELETE :id`) + `GET /saldo?comprobanteId|compraId` (saldo pendiente = monto − abonos,
    **rechaza sobrepago 400**, no cobra DRAFT); `GET|PUT /capital` (upsert); `GET /resumen` (dos vistas
    **devengado** y **cobrado** + capital acumulado); `GET /flujo?agrupacion=mes|semana&vista=…` (serie);
    `GET /categorias` (desglose de manuales); `GET /transacciones` (feed unificado facturas/compras/
    notas/movimientos/pagos con `monto` firmado, filtros tipo/origen, paginado; base del historial y del
    export a Excel/CSV).
  - **Devengado vs cobrado:** fuente unificada por CONSULTA de las 4 fuentes (facturas, compras, pagos,
    movimientos) — sin tabla duplicada. **Ingreso fiscal NETO** = facturas (+ nota débito E33) − notas de
    crédito **E34**. Estados devengados: ACEPTADO/ACEPTADO_CONDICIONAL + en vuelo (PENDIENTE/EN_COLA/
    ENVIANDO); RECHAZADO/ERROR/DRAFT no suman. Notas de venta internas suman pero **distinguibles**
    (`ingresosNotaVenta`). Movimientos manuales cuentan en ambas vistas. Capital acumulado ignora `desde`
    (acumulado hasta `hasta`); los totales del rango sí respetan `desde/hasta`.
  - **Tests:** `finanzas.e2e-spec.ts` (17 casos por área: CRUD/isolation/validaciones, cobro NO cambia
    estado DGII [assert explícito], pagos parciales, sobrepago, DRAFT no cobrable, devengado≠cobrado con
    capital acumulado distinto, netting E34, nota de venta distinguible, serie por bucket, categorías,
    **aislamiento fiscal: reporte 607 idéntico antes/después**). **133 e2e + 118 ecf-engine, build 0.
    DMAIA fiscal intacto.**

- ✅ **Envío EN LOTE + UX de selección múltiple — Sprint 14.** UN SOLO correo con los PDFs de varias
  facturas adjuntos (el cliente que pide las facturas del mes, el contador que necesita el lote). NO es
  un correo por factura. Post-emisión y NO fiscal, igual que el envío individual.
  - **Límite real de GHL (verificado contra la doc oficial):** `/conversations/messages/upload` acepta
    **5 archivos por request y 5 MB por archivo**; el composer de email admite **20 MB** de adjuntos en
    total. El cap de `attachments[]` al enviar el mensaje **NO está documentado** → no se apuesta a él:
    **máximo 5 comprobantes por correo**, el único techo sostenible. Constantes en `enviar-lote.dto.ts`.
    (Para lotes grandes, la salida futura es un ZIP —tipo permitido por GHL—; anotado como v2, no hecho.)
  - **Backend:** `POST /comprobantes/enviar-lote` (ruta literal declarada ANTES de las rutas `:id`).
    Body `{ canal:'email', comprobanteIds[1..5], destinatarios[1..5], asunto?, mensaje? }`. Reutiliza el
    flujo ya verificado (`regenerarPdfBuffer` → `subirPdf` → `enviarEmail`), sin cliente HTTP paralelo.
    **Todo-o-nada:** primero resuelve los comprobantes (404 si alguno es de otro tenant) y genera TODOS
    los PDFs; si uno falla → **400 nombrando cuál y por qué, sin subir ni enviar nada y sin escribir
    filas**. Después sube (N uploads secuenciales) y manda **un único** `POST /conversations/messages`
    con las N URLs → no existe "medio enviado". Nunca `ENVIADO` sin 2xx de GHL.
  - **Destinatarios:** GHL admite un solo `emailTo` → el primero va en Para y el resto en `emailCc`.
    Validación de formato y máximo 5 en el DTO (`MAX_DESTINATARIOS`), no sólo en la UI.
  - **Contacto ancla:** GHL exige un `contactId` y un lote puede mezclar clientes. Prioridad: contacto
    del **primer destinatario** si existe sincronizado (el hilo queda en la conversación de quien pidió
    las facturas); si no, el contacto de la **primera factura**. Se devuelve explícito en la respuesta
    (`ancla.origen = 'destinatario' | 'primerComprobante'`) y se nombra en el toast — no es magia invisible.
  - **Registro:** migración aditiva `20260722120000_add_envio_lote_id` (`EnvioComprobante.loteId String?`
    + índice). **Una fila POR COMPROBANTE** compartiendo `loteId`, `ghlMessageId` y `ghlConversationId`:
    cada factura conserva su propio "enviada el X" y `GET :id/envios` sigue igual. No se agrupa por
    `ghlMessageId` (es nullable y no existe en las filas FALLIDO).
  - **Frontend — la selección dejó de estar escondida.** Se eliminó el "modo selección" detrás del botón
    de lápiz: **checkboxes siempre visibles** + "seleccionar todo" en el header con **estado
    indeterminado**; el click en la fila siempre abre el detalle. Nueva `BulkActionBar` al **pie de la
    tabla** (lista de acciones extensible, sin el contenedor animado de `w-[497px]` del header), visible
    sólo con selección: "N seleccionadas" + *Enviar por correo* + *Exportar* + *Descargar* + *Limpiar*.
    Con más de 5 seleccionadas **no se bloquea la selección**, se apaga *Enviar* **con el motivo escrito**
    ("Máximo 5 facturas por correo · tienes 7"); igual si alguna es RECHAZADO/ERROR (sin PDF posible).
    La selección **se limpia al cambiar de página o de filtros** (antes lo seleccionado en otra página se
    descartaba en silencio). **`handleBulkDownload` ya no simula éxito**: apagado con "próximamente"
    (misma regla que se aplicó a Reenviar).
  - **Un solo modal, un solo componente de chips:** `ReenviarModal` toma `comprobantes: Comprobante[]`
    (individual = array de 1) y lista los adjuntos cuando son varios. Los destinatarios se escriben con
    `DestinatariosInput` (`components/ui/destinatarios-input.tsx`, chips + validación + máx 5), **pensado
    para que el cambio de chips del envío individual lo consuma**. El envío individual conserva su
    destinatario fijo de solo lectura hasta que ese cambio aterrice: no se pinta un campo editable que el
    backend individual todavía ignora.
  - **Tests:** `envio-lote.e2e-spec.ts` (28 casos: aislamiento fiscal 606/607 + no encola, un solo mensaje
    con N adjuntos, Para/Cc, registro con `loteId` compartido, ancla por destinatario/por factura/
    case-insensitive, límites 5 comprobantes y 5 destinatarios, emails inválidos, todo-o-nada con PDF
    roto, 404 de otro tenant, fallo del 2º upload sin enviar correo, 5xx→503 con filas FALLIDO).
- ✅ **Cascada del contacto ancla — Sprint 14b.** La API v2 de GHL es **contact-first**: enviar EXIGE un
  `contactId`, no se puede mandar a quien no exista como contacto (la v1 sí lo permitía). Sólo el ANCLA
  tiene esa restricción — `emailCc`/`emailBcc` aceptan direcciones cualesquiera. **Aplica a los dos
  flujos (individual y lote) con el mismo código**, `resolverAncla()`.
  - **Cascada, de menos a más invasiva:** (1) algún destinatario ya es Contacto local sincronizado
    (0 llamadas) → (2) algún destinatario existe en GHL (`GET /contacts/search/duplicate`, **lectura**,
    scope `contacts.readonly` que ya teníamos) → (3) contacto del primer comprobante (0 llamadas) →
    (4) **crear** un contacto mínimo (`POST /contacts/`, scope **`contacts.write`**). El paso 3 va ANTES
    de crear a propósito: si hay alternativa NO se escribe en el CRM del cliente, aunque el hilo quede
    en una conversación subóptima (el destinatario lo recibe igual por Cc).
  - **⚠️ Cruza una línea: hasta aquí la integración era SÓLO LECTURA sobre el CRM.** Por eso la escritura
    está acotada: **sólo el email** (no se inventa nombre, teléfono ni ningún dato de la persona), con
    `tags: ['facturard-envio']` y `source: 'FacturaRD'` — dos vías para auditar y limpiar lo que creamos.
    **NUNCA actualiza un contacto existente**: por eso se descartó `POST /contacts/upsert`, que resolvería
    todo en una llamada pero puede modificar datos ajenos. Se busca SIEMPRE antes de crear (la DB local
    puede estar desincronizada; GHL es la autoridad) y un fallo de la búsqueda no se traga — se prefiere
    fallar antes que duplicar a ciegas. `logger.warn` (no `log`) en cada creación.
  - **Errores de scope por llamada:** `pedirAGhl` recibe el permiso que hay que nombrar, así un 401/403
    al crear dice "falta **contacts.write**" y no el scope equivocado. El ancla se resuelve ANTES de subir
    PDFs y de enviar: sin ancla no se toca nada y no queda un lote a medias.
  - **Se reporta, no es invisible:** `ancla { ghlContactId, razonSocial, origen, email, creado }` en la
    respuesta de AMBOS endpoints (`origen ∈ contactoLocal|contactoGhl|primerComprobante|creado`) + toast
    aparte en la UI cuando `creado`.
  - **Efecto colateral bueno:** un contacto sin `ghlContactId` dejó de ser un callejón sin salida (antes
    400 "no está sincronizado"). Si no hay Contacto local **ninguno**, sigue siendo 400 —no hay correo de
    dónde sacar el destinatario— pero ahora el mensaje dice qué hacer; eso lo cierra del todo el cambio
    de chips del envío individual (pendiente).
  - **🐞 Fix — campo fantasma `datos.receptor.email`.** La UI leía el correo del comprador de un campo que
    **nadie escribe** (no existe en `CreateComprobanteDto`): siempre `undefined` → el modal decía "este
    cliente no tiene correo" y apagaba *Enviar* aunque el Contacto sí lo tuviera. Ahora el backend resuelve
    `contactoEmail` desde el Contacto local (misma regla que el envío: `contactoId` → RNC) en
    `GET /comprobantes` y `GET /comprobantes/:id`, con UNA consulta por página. `orderBy: createdAt asc`
    explícito en ambos lados para que la UI y el envío elijan el MISMO contacto cuando hay varios por RNC.
  - **Tests:** `envio-ancla.e2e-spec.ts` (14 casos: los 4 pasos de la cascada, que basta con que UNO de los
    destinatarios sea contacto, que se busca ANTES de crear, que el payload de creación es exactamente
    email+tag+source **sin nombre ni teléfono**, que el 2º envío al mismo destinatario NO crea un segundo
    contacto, 403→contacts.write sin subir PDFs, 401→contacts.readonly, 5xx sin crear duplicado, sin
    location vinculada → 400, y que el flujo individual usa la misma cascada) + 3 casos de regresión de
    `contactoEmail`. **212 e2e + 118 ecf-engine, build API y web en 0.**

- ✅ **🐞 Fix — "el precio incluye ITBIS" + descripción de línea (2026-08-18).** Dos bugs del formulario
  de factura reportados en producción, mismo origen: el modal capturaba datos que nadie leía.
  - **(1) El check "El precio incluye ITBIS" se ignoraba al guardar.** La vista previa del modal SÍ
    desagregaba (36,049 → 30,550 + 5,499), pero `handleSave` mandaba el precio **tecleado** y el ITBIS se
    sumaba **encima** (36,049 → total 42,537.82). Ahora la conversión ocurre UNA sola vez, en el punto de
    captura: `precioBaseSinItbis(precio, rate, incluye)` (`lib/comprobantes.ts`, redondeo a 2 decimales
    porque el DTO rechaza más) en `NuevoProductoModal` y `EditarProductoModal`. **Invariante:** el precio
    que sale del modal —y el que viaja al DTO/XML/PDF/totales— es SIEMPRE la base sin ITBIS; el check es
    sólo comodidad de captura y no se persiste. Arregla de una vez las 3 rutas que usan esos modales
    (línea de factura, catálogo `/producto`, cotizaciones).
  - **(2) La descripción de la línea se borraba al salir del modal.** No existía en NINGÚN lado del
    pipeline: ni en `ItemRow`, ni en el payload, ni en `CreateItemDto`. Ahora `descripcion` viaja
    entera → `DescripcionItem` del e-CF (`AlfNum1000Type`, **tope 1000**, `@MaxLength(1000)` + `maxLength`
    en el textarea). `resolverItem` la toma de la línea y cae al texto del catálogo como snapshot
    (`item.descripcion ?? producto.descripcion`); el processor la pasa al builder XML. `EditarProductoModal`
    además **precarga** descripción y unidad (antes se limpiaban en cada apertura) y manda `''` (no
    `undefined`) para poder BORRARLAS. `useProductos` dejó de tirar `descripcion` en create/update/list.
  - **PDF:** `EcfItem.detalle` nuevo, se imprime bajo el nombre en gris 6.5pt y **la fila ahora crece**
    (`heightOfString`) — con alto fijo el texto largo se salía del borde. Sirve para e-CF y cotización.
  - **Convertir cotización → factura** ahora arrastra la descripción de cada línea.
  - **No hay migración ni backfill:** los borradores creados ANTES con el check marcado quedaron con el
    precio inflado (el ITBIS ya sumado dentro de la base) — hay que corregirlos a mano.
  - **Tests:** `item-descripcion.e2e-spec.ts` (5 casos: guarda lo enviado, snapshot del catálogo, la línea
    gana sobre el catálogo, >1000 → 400, el PATCH del borrador la conserva). **252 e2e + 118 ecf-engine,
    build API y web en 0.**

- ✅ **Borrador de catálogo en Productos (2026-08-19).** Un producto se puede guardar **sin terminar**,
  igual que un comprobante DRAFT: se guarda a medias, no se puede facturar hasta publicarlo. Migración
  aditiva `20260819130000_add_producto_borrador`: `Producto.borrador Boolean @default(false)` +
  `@@index([tenantId, borrador])`. Cero `ALTER` sobre columnas fiscales.
  - **Backend:** `POST /productos` con `borrador:true` → `precioUnitario` **opcional** (se persiste 0 como
    marcador; `@ValidateIf` en el DTO). **Sin el flag no se relajó nada**: precio obligatorio y > 0 como
    siempre. `GET /productos?clase=publicado|borrador|todos`; **el default excluye borradores**, así el
    selector de emisión y todo caller viejo siguen limpios sin tocarles una línea. `PATCH` con
    `borrador:false` = **publicar**, y exige precio > 0 + nombre (400 si no) — un publicado sin precio
    rompería la emisión río abajo. Editar un borrador NO exige precio.
  - **Barrera de emisión:** `ComprobantesService.resolverItem` rechaza con **400** una línea cuyo
    `productoId` sea borrador, **antes de consumir e-NCF**. Doble defensa: el selector ya no los lista.
  - **Frontend:** `NuevoProductoModal` con prop `allowDraft` (ON en `/producto`, **OFF en emisión** — un
    borrador no se factura, ahí no tiene sentido): botón *Guardar borrador*, habilitado con sólo el
    nombre. `EditarProductoModal` sobre un borrador muestra *Guardar borrador* y su primaria pasa a
    *Publicar*. `/producto`: badge ámbar **Borrador** (no togglea activo/inactivo — se publica desde el
    modal) + opción "Borrador" en el filtro Estado; la página pide `clase=todos`.
  - **NO es autosave:** cerrar la ventana sigue sin guardar nada (tampoco en `/nueva-factura`). El
    guardado es el botón explícito, igual que "Guardar borrador" de factura. Autosave = pendiente.
  - **Tests:** `producto-borrador.e2e-spec.ts` (10 casos: guarda sin precio, borrador con precio,
    publicado sin precio → 400, default sin borradores, `clase=borrador|todos`, no facturable → 400 sin
    gastar e-NCF, publicar exige precio, publicado ya factura, editable sin precio, regresión producto
    normal). **262 e2e + 118 ecf-engine, build API y web en 0.**

  - ⚠️ **e2e local:** el contenedor `ecp-postgres` (otro proyecto) ocupa el puerto **5433**, el mismo de
    `pnpm --filter @facturard/api test:e2e` → falla con `P1000 Authentication failed` (engañoso: no es la
    password, es que Prisma pega contra la BD equivocada). Bájalo, o corre jest a mano contra otro puerto.

- ✅ **🐞 Fix — "El precio incluye ITBIS" hundía el precio en cada edición (2026-08-19).** Reportado en
  producción: escribes 15,000 con el check marcado y en cada guardado el precio baja
  (15,000 → 12,711.86 → 10,772.76 → …). **Causa:** el check era sólo modo de captura y **no se
  persistía**; al reabrir, el input mostraba la BASE con el check apagado, y volver a marcarlo hacía que
  `precioBaseSinItbis` dividiera un precio **ya dividido**. No era idempotente.
  - **Fix:** se persiste el modo de captura y el formulario devuelve el precio **como lo escribiste**.
    Migraciones aditivas `20260819160000_add_producto_precio_incluye_itbis`
    (`Producto.precioIncluyeItbis Boolean @default(false)`) y `20260819170000_add_producto_precio_captura`
    (`Producto.precioCaptura Decimal(18,2)?`). **Invariante intacto:** `precioUnitario` SIGUE siendo la
    base sin ITBIS — es lo único que viaja al DTO/XML/PDF/totales. Los dos campos nuevos son sólo para
    RE-MOSTRAR.
  - **Por qué DOS columnas y no una:** reconstruir el precio desde la base pierde un centavo
    (15,000/1.18 = 12,711.8644… → se guarda `12,711.86` → ×1.18 = **14,999.99**). El test lo cazó. Por eso
    `precioCaptura` guarda el monto tecleado EXACTO; `precioSegunCaptura()` (`lib/comprobantes.ts`) lo usa
    y sólo recalcula si falta (productos viejos). Al desmarcar el check, `precioCaptura` se pone a **null**
    (si no, quedaría un monto viejo contradiciendo el precio).
  - **Sin backfill:** los productos que ya se hundieron por este bug quedaron con el precio bajo — hay que
    corregirlos a mano.
  - **Tests:** `precio-incluye-itbis.e2e-spec.ts` (7 casos: persiste el modo, la base no se toca, ida y
    vuelta exacta a 15,000, **3 ciclos abrir→guardar sin que baje** [idempotencia], default sin flag,
    desmarcar borra el monto de captura, cambio de modo por PATCH).

- ✅ **🐞 Fix — el CLIENTE no sobrevivía en un borrador (2026-08-19).** Al reabrir un borrador había que
  volver a elegir el cliente. **Causa:** el formulario mandaba sólo `rncComprador` + `razonSocialComprador`
  — **nunca el `contactoId`** (el backend sí lo soportaba, `comprobantes.service.ts`), y al reabrir el
  match era **por RNC** (`ComprobanteForm.tsx`). Cualquier cliente **sin RNC** (consumidor final, contacto
  sin RNC) viajaba con `rnc:''` y era imposible de reencontrar.
  - **Fix:** `contactoId` se manda siempre que haya cliente, en `POST` **y** en el `PATCH` del borrador
    (`useNuevaFactura.ts`). Al reabrir se busca **primero por `contactoId`** (identidad exacta) y sólo
    después por RNC — compatibilidad con borradores viejos. Un RNC vacío ya **no** cuenta como
    coincidencia (antes cualquier contacto sin RNC podía hacer match con otro).
  - **🐞 Tercer bug destapado por el test — cambiar de cliente NO cambiaba la razón social.**
    `actualizarDraft` hacía `{...datosActuales, ...dto}` y en `resolverDto` el valor explícito gana sobre
    el del contacto: el borrador quedaba con el **contacto nuevo** y el **nombre/RNC del anterior** — que
    es lo que imprime el PDF y lo que viajaría a la DGII. Ahora, si el PATCH cambia de contacto, se
    descartan los campos de comprador heredados (`sinDatosComprador`) salvo los que el propio PATCH mande.
  - **Tests:** `draft-cliente.e2e-spec.ts` (5 casos: guarda `contactoId`, **cliente sin RNC sobrevive**,
    el PATCH lo conserva si no se toca, el PATCH lo cambia ENTERO [nombre + RNC], regresión de borradores
    viejos sólo con RNC). **274 e2e + 118 ecf-engine, build API y web en 0.**

  - ⚠️ **e2e local (2):** con `connection_limit=1` (el que trae el script) la prueba de concurrencia de
    cotizaciones (15 POST en paralelo) tira `read ECONNRESET` de forma intermitente — **no es una
    regresión**, se reproduce igual sin cambios. Con `connection_limit=5` la suite completa pasa en verde.

- ✅ **🐞 Fix — el mismo bug del ITBIS, ahora en la LÍNEA DE FACTURA (2026-08-19).** El fix anterior cubría
  el catálogo, pero **el flujo de facturas seguía roto**: editar una línea en `/nueva-factura` volvía a
  hundir el precio. La línea vive en memoria (`ItemRow`), no en la DB, así que `precioIncluyeItbis`/
  `precioCaptura` de `Producto` no la alcanzaban: `StepDetalle.tsx` armaba el "producto" para el modal
  **sin el modo de captura** → el modal abría con la base y el check apagado → re-marcarlo dividía otra vez.
  - **Fix:** `ItemRow` lleva `precioIncluyeItbis?` y `precioCaptura?` (memoria pura, **NO viajan al DTO**;
    `precioUnitarioItem` sigue siendo la base sin ITBIS). Se propagan en los 3 puntos: `addFromProduct`
    (el producto del catálogo arrastra su modo a la línea), `editingAsProducto` (al abrir el modal) y
    `handleEditItem` (al guardar). Mismo modal, misma regla que el catálogo.
  - **Lista de `/producto`:** la columna "Precio final" usa `precioCaptura` cuando aplica — enseñaba
    14,999.99 donde el usuario puso 15,000.

### ⚠️ EL CENTAVO — investigado, documentado, NO arreglado (decisión fiscal pendiente)
Capturar **15,000 con ITBIS incluido** produce un comprobante con **montoTotal 14,999.99**, no 15,000.
- **Causa:** `packages/ecf-engine/src/xml/calculator.ts` calcula el ITBIS sobre el monto YA redondeado:
  `montoITBIS = r2(r2(cantidad × precio) × 0.18)`.
- **Es matemáticamente imposible con 2 decimales**, no es cuestión de elegir mejor la base:
  `12,711.86 → ITBIS 2,288.13 → 14,999.99` y `12,711.87 → ITBIS 2,288.13 → 15,000.01`. Ninguna base de 2
  decimales cae en 15,000.00.
- **Se probó subir el precio a 4 decimales** (el XSD lo permite: `PrecioUnitarioItem` es
  `Decimal20D1or4ValidationType`, `fractionDigits=4`) y **NO lo arregla**: `montoItem` se redondea a 2
  antes de aplicar el ITBIS, así que el total sigue en 14,999.99. El cambio se **revirtió** (tocaba
  columnas fiscales sin ganar nada).
- **El único arreglo real** es calcular el ITBIS sobre la base SIN redondear
  (`r2(cantidad × precio × 0.18)` → 2,288.14 → total 15,000.00). **No se hizo**: cambia el monto que se le
  declara a la DGII y hay riesgo de rechazo si su validador recalcula
  `TotalITBIS1 = round(MontoGravadoI1 × 0.18)` = 2,288.13. **Requiere decisión explícita.**
- Mientras tanto: la UI enseña el precio capturado (15,000) y el **total real** de la factura es
  14,999.99. Fijado en `precio-incluye-itbis.e2e-spec.ts` para que el día que se cambie sea a propósito.

**276 e2e + 118 ecf-engine, build API y web en 0.**

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

- ✅ **FIX 7 — NombreItem > 80 caracteres quemaba el e-NCF.** En prod, la factura E310000000012 de
  DMAIA quedó en `ERROR`: un nombre de artículo de 96 caracteres (" Dmaia 360 Instalación Incluye:
  1) CRM, 2) Pagina Web, 3) Posicionamiento SEO, 4) Redes Sociales") generó un XML que NO valida contra
  el XSD (`NombreItem` es `AlfNum80Type`, máx **80**, en E31/E32/E33/E34). La falla aparecía en el worker
  —en `generateXml`, ANTES de firmar y de contactar la DGII— pero DESPUÉS de haber consumido el e-NCF, que
  quedó quemado. Ahora se valida ANTES de consumir la secuencia y se **rechaza con 400** (no se trunca: el
  nombre es contenido fiscal). Helper `assertNombresItemValidos` (`comprobantes.service.ts`), llamado en los
  DOS caminos que consumen e-NCF: `resolverDto` (crear/crear+emitir, cubre el nombre ad-hoc Y el del
  snapshot de producto — el catálogo no limita el largo) y `emitir` (borrador ya guardado, por si vino sin
  la validación). Constante `MAX_NOMBRE_ITEM=80`; también `@MaxLength(80)` en `CreateItemDto.nombreItem`
  como primera línea. **La E310000000012 nunca llegó a la DGII** (falló en validación local), pero el e-NCF
  12 quedó consumido: DMAIA re-crea con el nombre acortado → E310000000013. Tests: 6 casos en
  `comprobantes-draft.e2e-spec.ts` (81/96/snapshot/borrador-viejo → 400 sin encolar; 80 → 201). **218 e2e.**


- ✅ **FIX 2 — EXENTO → IndicadorFacturacion 4 (ya correcto).** Verificado end-to-end: producto `EXENTO`
  → string interno `'E'` en `datos` → `mapIndicador('E')` = **4** en el XML; el `'E'` nunca llega al XML
  y el ítem queda fuera de la base gravada de ITBIS. Sin cambios de código.
- ✅ **FIX 3 — 606 excluye compras sin NCF.** `reporte606` filtra `tipo !== 'SIN_COMPROBANTE'` y NCF no
  vacío (el 606 exige NCF en el campo 4). Las SIN_COMPROBANTE siguen visibles en `/compras`, solo se
  excluyen del TXT/JSON del 606.
- ✅ **FIX 4 — E32 ≥ RD$250,000 exige identificación del comprador.** `crear()` (emisión) y `emitir()`
  rechazan con 400 un E32 sobre el umbral sin RNC/Cédula ni identificador extranjero. Umbral en la
  constante `UMBRAL_IDENTIFICACION_E32` (comprobantes.service.ts). Por debajo del umbral, permitido.
- ✅ **FIX 6 — Error DGII [145] "Fecha de vencimiento de secuencia inválida".** La
  `<FechaVencimientoSecuencia>` YA NO usa un default hardcodeado (`31-12-2028`). Ahora se resuelve por
  prioridad: (a) `payload.fechaVencimiento` (override manual DD-MM-YYYY), (b) `secuencias.fechaVencimiento`
  del tipo (formateada con getUTC*, sin corrimiento de día), (c) si el tipo la EXIGE y no hay ninguna →
  **400 claro** ("Falta la fecha de vencimiento de la secuencia para el tipo X; configúrala en
  Empresa/Secuencias"), NUNCA un default silencioso. Se resuelve ANTES de consumir la secuencia (no se
  quema un e-NCF si falta). `TIPOS_REQUIEREN_FECHAVENC` = E31,E33,E41,E43,E44,E45,E46,E47 (E32/E34 no la
  llevan → emiten sin exigirla). `siguienteENCF` ahora devuelve `{ eNCF, fechaVencimiento }` y existe
  `getFechaVencimiento(tenantId, tipoECF)`. El processor conserva `requireFechaVenc()` como última barrera
  (falla claro si faltara). `POST /secuencias/sincronizar` acepta `fechaVencimiento` (ISO) por tipo
  (guardado a mediodía UTC; actualizar solo el número NO borra la fecha). Onboarding paso 4: input de
  fecha por tipo (obligatorio para los que la exigen). **La nota E33 NO hereda la fecha del fuente**: usa
  su propia secuencia. DMAIA (dc591cb7): E31 seteada a `2026-12-31` en prod (verificada en PDF de
  E310000000008). Tests: `fecha-vencimiento.e2e-spec.ts` (origen secuencia / override / error sin gastar
  e-NCF / E32 sin fecha) + sync guarda fecha por tipo. 84 e2e + 114 ecf-engine, build 0.
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

### 🐞 BUG PENDIENTE — Formulario E34 manda `indicadorNotaCredito` con el valor VIEJO (1|2)
- **Consecuencia directa del FIX 1 (regla de 30 días):** el backend se corrigió a `0|1`
  (`@IsIn([0, 1])` en `create-comprobante.dto.ts`; semántica 0=≤30 días / 1=>30 días), pero el
  **formulario de nueva factura quedó con el valor viejo `1|2`** (semántica anterior "Anulación/
  Corrección"). En `apps/web/src/components/nueva-factura/StepCliente.tsx` el `indicadorNotaOptions`
  sigue siendo `[{value:'1'…},{value:'2'…}]` y `ComprobanteForm.tsx` envía
  `indicadorNotaCredito: Number(indicadorNotaCredito) as 1 | 2`.
- **Síntoma:** crear/guardar/emitir un **E34 desde el formulario** con "Indicador Nota de Crédito = 2"
  → **HTTP 400** (`indicadorNotaCredito must be one of the following values: 0, 1`). Con `1` pasa la
  validación pero la semántica es incorrecta (el servidor **debería calcularlo por fecha**, no tomarlo
  del formulario).
- **Causa raíz:** el campo quedó como entrada manual en la UI cuando el FIX 1 ya lo volvió
  **derivado en el servidor** (`crearNota` calcula 0/1 por `diasCalendarioEntre` e ignora lo que envíe
  el caller). El path correcto de nota de crédito es `POST /comprobantes/:id/nota` (que sí calcula bien);
  el formulario de emisión directa de E34 quedó desalineado.
- **NO arreglado aún (anotado a pedido).** Arreglo esperado cuando se retome: quitar el input manual de
  `IndicadorNotaCredito` del formulario E34 (o mapearlo a `0|1`) y dejar que el backend lo derive por
  fecha. No es uno de los 3 bugs de la Fase 1.

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

## 8ter. ONBOARDING SIN CERTIFICADO (Sprint 11)

Un e-CF **ES** el envío a la DGII: sin certificado digital no existe factura fiscal. Pero un usuario
NO certificado SÍ puede usar FacturaRD para **cotizar** (no fiscal) y **guardar borradores** (DRAFT, no
consume e-NCF ni toca la DGII). Lo único vetado sin certificado es **EMITIR**. Este sprint habilita ese
flujo de principio a fin y protege la emisión en el backend (no basta con ocultar el botón).

- ✅ **Onboarding con certificado OPCIONAL.** `POST /ghl/onboarding` (multipart) acepta `file` +
  `passphrase` **opcionales**. Con ellos → tenant CON certificado (listo para emitir). Sin ellos →
  tenant SIN certificado (operativo para cotizar/borradores). En AMBOS casos la creación es una
  **transacción atómica** (tenant + GhlLocation + secuencias base [+ certificado si vino]); si algo
  falla, rollback total. `POST /certificados/upload` sigue vigente para certificar/renovar después.
- ✅ **Identificación por RNC o Cédula.** DTO acepta `tipoIdentificacion: 'RNC' | 'CEDULA'`. Se valida
  contra la DGII (mismo servicio `DgiiContribuyentesService.buscarPorRNC`, que funciona para ambos por
  el endpoint `/rnc/{valor}`). Para **cédula** fuera del padrón (persona física), si el usuario envía un
  `razonSocial` manual se acepta **sin validar** (con `logger.warn`); un **RNC de empresa** SIEMPRE debe
  validar (sin respaldo manual). La cédula **NO reemplaza** la certificación: solo es otra forma de
  identificarse. Lógica en `GhlAuthService.resolverIdentidad`.
- ✅ **Barrera de emisión en el backend — `ComprobantesService.assertPuedeEmitir(tenantId)`.** Un tenant
  solo puede ENVIAR a la DGII con certificado **activo Y vigente**. Sin él (o vencido) → **409** con
  mensaje claro y accionable ("No puedes emitir a la DGII sin un certificado digital activo…").
  - `POST /comprobantes` con `emitir=true` sin cert → 409. Con `emitir=false` (DRAFT) → **201** (guarda
    borrador, no pasa por la barrera). `POST /comprobantes/:id/emitir` sin cert → 409 **sin gastar
    e-NCF** (la barrera corre antes de consumir la secuencia). Cotizaciones → funcionan siempre.
- ✅ **Estado "listo para emitir" — `puedeEmitir` + `motivoNoEmite`.** Helper puro compartido en
  `apps/api/src/common/emision-status.ts`: `puedeEmitir` = cert activo + vigente + secuencias;
  `motivoNoEmite ∈ { 'sinCertificado' | 'certificadoVencido' | 'sinSecuencias' | null }`. Expuesto en
  `GET /tenants` (SafeTenant, calculado en O(1) consultas para N tenants) y en `GET /cumplimiento`.
- ✅ **Frontend — onboarding simplificado (3 fases: Identifícate · Certificación · Listo).**
  `IdentificacionStep` (toggle RNC/Cédula + nombre manual de respaldo), `CertificacionChoiceStep`
  ("¿Ya facturas electrónicamente ante la DGII?"). Rama "Todavía no" → crea tenant sin certificado y
  entra (mensaje positivo, aterriza en `/cotizaciones`). Rama "Sí" → `CertificadoStep` + `SecuenciasStep`.
  `CrearCuentaStep` maneja ambos casos (P12 opcional). (`RncStep` eliminado, reemplazado por
  `IdentificacionStep`.)
- ✅ **Frontend — emisión bloqueada con enlace.** En `/nueva-factura`, sin certificado el botón *Emitir
  e-CF* queda deshabilitado con el mensaje pedido + enlace directo a **Configuración → Certificación
  fiscal** (`#certificacion-fiscal`). *Guardar borrador* sigue habilitado; cotizaciones sin bloqueo.
- ✅ **Frontend — "Certificación fiscal" en Configuración** (`CertificacionFiscalCard`, ancla
  `certificacion-fiscal`). Estado visible ("No certificado" / "Certificado activo · vence en X días"),
  subida del P12 (mismo dropzone del onboarding) + configuración de secuencias (mismo `SecuenciasStep`),
  ayuda ("qué es el certificado / contacto DMAIA"). Al subir el P12, `puedeEmitir` pasa a true y el botón
  de Emitir se desbloquea.
- **Tests:** `apps/api/test/sin-certificado.e2e-spec.ts` (11 casos: onboarding sin P12, cédula, cédula
  fuera de padrón con nombre manual, DRAFT/emitir/cotización sin cert, subir P12 desbloquea, regresión
  del tenant certificado). **101 e2e + 118 ecf-engine, build 0.** No cambia el path de emisión de DMAIA.

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
/onboarding      → wizard 3 fases (Identifícate · Certificación · Listo). Certificado OPCIONAL
                   (Sprint 11): 1) Identifícate (RNC o Cédula vs DGII; nombre manual de respaldo
                   para cédula fuera de padrón) → 2) "¿Ya facturas ante la DGII?": (a) "Sí" →
                   .p12/.pfx + passphrase + secuencias; (b) "Todavía no" → crea tenant SIN
                   certificado y entra (aterriza en /cotizaciones) → POST /ghl/onboarding multipart
                   (P12 opcional), guarda JWT → 3) Listo
/dashboard       → métricas del mes + facturas recientes
/facturas        → lista paginada con filtros por estado y búsqueda. Descarga de PDF disponible para
                   cualquier estado sin error (aceptado = e-CF fiscal; borrador/pendiente = vista previa)
/producto        → catálogo de productos/servicios. Estados Activo/Inactivo + **Borrador** (badge ámbar,
                   filtro "Borrador"): producto guardado sin terminar, puede no tener precio y NO se
                   puede facturar; se publica desde el modal de edición (*Publicar*). El selector de
                   emisión nunca lista borradores (default de GET /productos)
/empresa         → datos del emisor (ACTIVO en prod): editable dirección/teléfono/correo + logo por URL
                   (vista previa + validación); RNC/razón social solo-lectura (vienen de DGII);
                   "Vista previa" con datos reales. PATCH /tenants/empresa
/cotizaciones/[id] → detalle: Descargar PDF, Marcar enviada, Convertir en factura (con confirmación),
                   badge "Facturada" + enlace a la factura; sin historial inventado
/finanzas        → tablero de flujo de caja (Sprint 13). Toggle Devengado/Cobrado + selector mes/año;
                   KPIs (ingresos/egresos/balance/capital acumulado), gráfico de flujo del año (barras
                   CSS), desglose por categoría, capital inicial (editable). **Historial = feed unificado
                   de Transacciones** (facturas +verde / compras −rojo / notas / manuales), con filtros
                   tipo/origen, paginación, **exportar a Excel/CSV** por período+filtros, y editar/eliminar
                   solo en filas manuales (+ modal de alta). Hooks en useFinanzas.ts contra /finanzas/*;
                   reutiliza Card/Select/ToggleGroup/Modal/Input/Button/Badge. Sin librería de gráficos
                   (SVG/CSS a mano). NO fiscal: sólo lee/registra caja, no toca emisión ni reportes
/nueva-factura   → formulario emitir comprobante (E31/E32). Sin certificado: *Emitir e-CF* queda
                   deshabilitado con enlace a Configuración → Certificación fiscal; *Guardar
                   borrador* sigue habilitado (DRAFT)
/configuracion   → empresa, "Certificación fiscal" (CertificacionFiscalCard, ancla
                   #certificacion-fiscal: estado + subir P12 + secuencias + ayuda/contacto DMAIA),
                   webhook GHL (emisión entrante), y "Integración con GoHighLevel" para IMPORTAR
                   contactos (PATCH /contactos/configurar-ghl: Private Integration Token + ghlRncFieldKey)
/contacto        → directorio de contactos + "Sincronizar con GoHighLevel"
                   (POST /contactos/sincronizar-ghl → resumen importados/actualizados/sinRnc)
```

**Comandos:**
```bash
pnpm --filter @facturard/web dev    # puerto 3001
pnpm --filter @facturard/web build  # build producción
```

**Variables de entorno (`apps/web/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1   # en el VPS se fija en el build: https://API_DOMAIN/api/v1
```

**Deploy (VPS, 2026-10-02 — Railway y Vercel eliminados):** todo en `deploy/` —
`docker-compose.prod.yml` (api + web + postgres 16 + redis 7 con AOF; api/web publicados SÓLO en
127.0.0.1:`API_PORT`/`WEB_PORT`), `nginx/facturard.conf` (nginx del host + certbot hace TLS,
`APP_DOMAIN`→web, `API_DOMAIN`→api; sin `X-Frame-Options` por el iframe de GHL), `.env.example` (se copia a `deploy/.env`),
`backup.sh` (pg_dump diario) y `README.md` (guía). Web: `apps/web/Dockerfile` (Next `output:
'standalone'`) + `Dockerfile.dockerignore` (el `.dockerignore` raíz excluye `apps/web`).
`NEXT_PUBLIC_API_URL` se incrusta en el build (cambiarla exige `--build`). Arranque en limpio: base
vacía, `ENCRYPTION_KEY` nueva — **no perderla ni cambiarla** una vez haya datos; NO correr el seed en
prod. pnpm fijado a `9.15.0` en los Dockerfiles (el latest falla con
`ERR_PNPM_PNPM_ENGINE_NO_NATIVE_BINARY`). Build local desde el disco externo falla por los `._*` de
macOS: construir desde una copia limpia. CI = sólo build + tests; deploy manual (`git pull` + `up -d --build`).

**Arquitectura clave:**
- Autenticación: GHL iframe → GET /ghl/init → JWT en localStorage (`frd_token`)
- Sin login propio: el entry point `/` siempre arranca desde GHL con `?location_id`
- Sin `location_id` → pantalla "Abre FacturaRD desde GoHighLevel" (acceso inválido)
- Interceptor 401: re-llama GET /ghl/init con el `frd_location_id` guardado para refrescar el token
- Estado global: AuthContext (token + tenant) + UIContext (sidebar abierto/cerrado)
- Server state: React Query con queryKey tipados por recurso
- **Sincronización de contactos GHL (una vía, GHL→FacturaRD):** hook `useGhlSync`
  (estado conectado desde GET /tenants, `guardarConexion`, `sincronizar`). UI:
  `GhlContactosCard` en /configuracion (token cifrado + campo RNC + instrucciones) y
  botón "Sincronizar con GoHighLevel" en /contacto (deshabilitado/aviso si no hay conexión;
  resumen importados/actualizados/sinRnc; enlace "ver sin RNC"; refresca la lista).
- **Auth GHL (resuelto):** la sync envía `?locationId=<location del tenant>` (tomado de
  `ghl_locations`, del onboarding — no se pide al usuario) + `Authorization: Bearer <token>`
  con fallback automático a `Authorization: <token>` (sin Bearer) si GHL responde 401/403
  (los Private Integration Token admiten ambos formatos). `Version: 2021-07-28`.
- **Seguridad:** GET /tenants ya NO devuelve `ghlAccessToken`; expone `ghlConectado: boolean`.
- `PATCH /contactos/configurar-ghl`: el token es opcional al actualizar (si se omite y ya hay
  uno guardado, se conserva; solo se actualiza `ghlRncFieldKey`). Obligatorio para conectar.

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
