# Changelog — FacturaRD

Todas las fechas en formato AAAA-MM-DD.

## [Sprint 13 · Frontend] — 2026-07-20 — Tablero de Finanzas (flujo de caja)

Tab `/finanzas` que consume el backend del Sprint 13. Sigue el patrón de diseño de los otros tabs
(reutiliza los primitivos existentes; ningún componente nuevo de librería). NO fiscal.

### Added
- **Ruta `src/app/(dashboard)/finanzas/page.tsx`** — header con toggle **Devengado/Cobrado**
  (`ToggleGroup`) + selector mes/año (`Select`, estilo `reportes`); KPIs (ingresos, egresos, balance,
  capital acumulado); gráfico de flujo del año; movimientos manuales (tabla + alta/edición/baja) con
  filtro por tipo; aside con capital inicial (editable) y desglose por categoría.
- **Hooks `src/hooks/useFinanzas.ts`** — `useFinanzasResumen/Flujo/Categorias`, `useMovimientos`,
  `useCapital` + mutaciones (`useCrearMovimiento/Actualizar/Eliminar`, `useSetCapital`). Query keys
  `['finanzas-*', …]`; invalidación por predicado; tipos espejo del backend; toasts con `sonner`.
- **Componentes `src/components/finanzas/`** — `FinanzasMetrics` (KPI row estilo `CotizacionesMetrics`),
  `FlujoChart` (**gráfico de barras SVG/CSS a mano** — no hay librería de charts en el repo; ingresos
  vs egresos por mes, responsive con `overflow-x-auto`), `CategoriasBreakdown`, `CapitalCard` (+ modal),
  `MovimientosTable`, `MovimientoModal`. Reutilizan `Card/Button/Badge/Select/Input/Modal/ToggleGroup/
  Spinner` y `formatCurrency/formatDate`.
- **Navegación** — entrada "Finanzas" en `OPERACION_ITEMS` (`Sidebar`, icono `public/assets/finanzas.svg`
  con la técnica de máscara existente) + `PAGE_META['/finanzas']` en el layout.
- **Responsive** — mismos breakpoints que los demás tabs (`sm:grid-cols-2 lg:grid-cols-4` KPIs,
  `lg:grid-cols-3` cuerpo, headers `flex-wrap`, tablas/gráfico en `overflow-x-auto`); correcto a 1200px.
  Build de producción `next build` en verde.

## [Test harness] — 2026-07-20 — Endurecimiento del harness e2e (anti-flakiness)

Deuda técnica del harness pagada antes de que la suite crezca. Sin cambios de producción.

### Fixed
- **Flakiness intermitente (fallos "404" al azar en distintos specs).** Root cause: read-after-write
  entre conexiones del pool de Prisma dentro de un mismo archivo (un SELECT en otra conexión no veía la
  fila recién escrita → parecía "no encontrado"). Fix: `?connection_limit=1` en la `DATABASE_URL` de
  test (`test:e2e`) → todas las queries serializan en una conexión, consistencia estricta. Suite estable
  (12+ corridas seguidas 133/133).
- **Handles abiertos entre specs.** `ReceptorService` cierra su cliente ioredis en `onModuleDestroy`
  (se dispara en `app.close()`); nuevo teardown por-archivo (`setupFilesAfterEnv`) desconecta el pool de
  Prisma al terminar cada spec. La suite ahora **sale sola sin `--forceExit`** (se conserva el flag como
  red de seguridad).

### Changed
- **Aislamiento entre specs.** Truncate por-archivo: `createTestApp()` limpia la base al arrancar cada
  archivo (helper compartido `test/helpers/reset-db.ts`, lista de tablas centralizada, usada también por
  `globalSetup`). Evita contaminación cruzada a medida que crecen los tests.

## [Sprint 13] — 2026-07-20 — Módulo Finanzas (flujo de caja: ingresos/egresos)

Nuevo módulo NO fiscal para el tablero de flujo financiero. **Aislamiento fiscal total:**
100% de lectura sobre lo fiscal + tablas propias. NO consume e-NCF, NO firma, NO encola, NO toca
el estado DGII de las facturas, NO altera secuencias ni los reportes 606/607/608. El path de
emisión de DMAIA queda intacto.

### Added
- **Migración aditiva `20260720161637_add_finanzas`** — sólo `CREATE TYPE`/`CREATE TABLE`/índices/FK
  sobre tablas nuevas; cero `ALTER` de columnas sobre tablas fiscales. Nuevos enums `MovimientoTipo`,
  `MovimientoCategoria`, `PagoTipo` y modelos:
  - `MovimientoFinanciero` (movimientos manuales: nómina, alquiler, aporte de capital, impuestos…);
    `tipo` INGRESO/EGRESO, `categoria`, `monto` Decimal(18,2), `moneda` (default DOP), `fecha`,
    `descripcion`, `metodoPago`. Índice `(tenantId, fecha)`.
  - `Pago` (cobros de facturas / pagos de compras). `tipo` COBRO/PAGO, `comprobanteId?`/`compraId?`
    (referencias virtuales, `onDelete SET NULL`), `monto`. **Registrar un Pago NO modifica el
    comprobante/compra** — es sólo una referencia contable. Soporta pagos parciales.
  - `CapitalInicial` (uno por tenant, `@@unique(tenantId)`) — saldo de partida.
- **Módulo `finanzas`** (`apps/api/src/modules/finanzas/`), todos los endpoints JWT + tenant-scoped
  bajo `/api/v1/finanzas`:
  - Movimientos: `POST|GET /movimientos`, `GET|PATCH|DELETE /movimientos/:id`.
  - Pagos: `POST /pagos`, `GET /pagos`, `DELETE /pagos/:id`, `GET /saldo?comprobanteId|compraId`
    (saldo pendiente = monto − abonos; **rechaza sobrepago** con 400; no se cobra un DRAFT).
  - Capital: `GET|PUT /capital` (upsert).
  - Tablero: `GET /resumen` (totales en dos vistas **devengado** y **cobrado**, con capital acumulado),
    `GET /flujo?agrupacion=mes|semana&vista=devengado|cobrado` (serie temporal), `GET /categorias`
    (desglose de movimientos manuales).
- **Lógica devengado vs cobrado.** Fuente unificada por CONSULTA de las 4 fuentes (facturas fiscales,
  compras, pagos, movimientos manuales) — sin tabla duplicada.
  - **Ingreso fiscal NETO:** facturas positivas (E31/E32/E44-47 + notas débito E33) **menos** notas de
    crédito **E34**. Estados que cuentan como devengado: `ACEPTADO`, `ACEPTADO_CONDICIONAL`, y en vuelo
    (`PENDIENTE`/`EN_COLA`/`ENVIANDO`); RECHAZADO/ERROR/DRAFT NO suman.
  - **Notas de venta internas** (`esFiscal=false`, `INTERNO`) suman como ingreso pero **distinguibles**
    (`ingresosNotaVenta` aparte de `ingresosFiscal`).
  - Movimientos manuales cuentan en **ambas** vistas (caja inmediata). Sólo DOP (el campo `moneda`
    existe pero no se mezclan monedas en los totales). Capital acumulado = capital inicial + flujo neto
    **acumulado** hasta `hasta` (ignora `desde`).
- **Tests** — `apps/api/test/finanzas.e2e-spec.ts` (**17 casos** por área): movimientos CRUD +
  tenant isolation + validaciones; cobro NO cambia el estado DGII (assert explícito), pagos parciales,
  sobrepago 400, DRAFT no cobrable, pago sobre compra + isolation; devengado vs cobrado difieren con
  capital acumulado distinto, netting E34, nota de venta distinguible, capital upsert; serie temporal
  por bucket; desglose por categoría; **aislamiento fiscal** (reporte 607 idéntico antes/después).
  **133 e2e + 118 ecf-engine, build 0.** DMAIA fiscal intacto.

## [Ajustes UI] — 2026-07-15 — Datos del emisor, Empresa, cotizaciones y PDFs

Lote de ajustes de frontend (y backend de soporte). Sin cambios en el path de emisión de DMAIA.

### Added
- **Datos de contacto del emisor.** Nuevas columnas `telefono` y `email` en `Tenant`
  (migración `20260715000000_add_tenant_emisor_contacto`; `direccion`/`logoUrl` ya existían).
  Endpoint `PATCH /tenants/empresa` (dirección/teléfono/correo/logoUrl; RNC y razón social NO editables,
  vienen de la DGII). Onboarding (`POST /ghl/onboarding` + `CrearCuentaStep`) captura estos datos como
  opcionales. Aparecen en el bloque emisor del PDF/detalle (`pdf-input.builder` + motor PDF, incl. correo).
- **PDF de cotización.** `GET /cotizaciones/:id/pdf` reutiliza el motor del ecf-engine en un nuevo
  **modo `COTIZACION`**: mismo diseño fiscal pero sin e-NCF ni QR/timbre, con folio COT-xxxx y leyenda
  "documento NO fiscal". Motor PDF ahora acepta `modo: 'ECF' | 'BORRADOR' | 'COTIZACION'` + `emailEmisor`
  + `folio`.
- **Cotizaciones — flujo real.** Detalle: botón *Marcar enviada* (BORRADOR→ENVIADA), *Descargar PDF*,
  y *Convertir en factura* con **diálogo de confirmación**. Badge `CONVERTIDA` → **"Facturada"** con
  enlace "Ver factura {e-NCF}" (usa `comprobanteId`). Confirmación también en el listado.
- **Empresa** (`/empresa`): tab activado en producción, cableado a datos reales. Editable
  dirección/teléfono/correo + **logo por URL** (con vista previa y validación de imagen); RNC/razón
  social solo-lectura; "Vista previa" muestra el bloque emisor con datos reales.

### Changed
- **Descarga de PDF ampliada.** `GET /comprobantes/:id/pdf` ahora sirve borradores/pendientes como
  **vista previa** (modo BORRADOR, sin QR); aceptados siguen saliendo como e-CF fiscal con QR
  (comportamiento idéntico al anterior). Rechazados/errores → 404 (y su botón de descarga se oculta).
- **Cotizaciones — guardar vs enviar.** Al crear, el botón dice **"Guardar"** (queda BORRADOR); ya no
  hay "Guardar y enviar" ni cambio de estado automático. El envío es una acción aparte desde el detalle.
- **Historial en detalle.** Factura: se limpió a **solo eventos reales** (creación/emisión + respuesta
  DGII con trackId/mensaje, timestamps reales; sin pasos con horas inventadas). Cotización: se **eliminó**
  el historial fabricado ("cliente abrió el enlace", etc.), reemplazado por un panel de detalles reales.
- **Tab "Estado DGII" (detalle de factura) ahora state-aware.** Antes mostraba "Aceptado por DGII"
  **incondicionalmente** (peligroso: una factura rechazada/pendiente aparecía como aceptada). Ahora la
  tarjeta refleja el estado real: ACEPTADO/CONDICIONAL → verde con trackId + código real; RECHAZADO →
  roja con el `mensajeDGII` (motivo); ERROR → ámbar con el mensaje; PENDIENTE/EN_COLA/ENVIANDO → neutra
  "En proceso"; DRAFT → "Borrador, no enviado a la DGII". Todo desde `estado`/`trackId`/`mensajeDGII`.
- Sidebar: se quitó el bloque de usuario estático ("Sarah Mitchell"). Header: se quitaron el chip
  "Automatización N activos" y la campana de notificaciones.

### Notas
- **Logo por URL (pendiente futuro):** hoy el logo se guarda como URL http(s) pública (el motor PDF la
  descarga). No hay subida de archivo real (blob storage); queda como mejora futura.

### Verificación
- 101 tests e2e (api) + 118 tests (ecf-engine) verdes. Build 0 en `@facturard/api` y `@facturard/web`.
- Smoke test: los 3 modos de PDF (ECF/BORRADOR/COTIZACION) renderizan sin excepción.
- Sin cambios en el path de emisión de producción de DMAIA (XML/firma/secuencias intactos).

## [Sprint 11] — 2026-07-13 — Onboarding sin certificado

Usuarios NO certificados ante la DGII pueden registrarse, cotizar y preparar facturas (borradores),
y certificarse después. Sin certificado no se puede EMITIR; el bloqueo se garantiza en el backend.

### Added
- `POST /ghl/onboarding`: certificado (P12 + passphrase) ahora **opcional**. Sin él, crea el tenant
  operativo (cotizar/borradores) pero sin poder emitir; transacción atómica en ambos casos.
- Identificación por **RNC o Cédula** (`tipoIdentificacion`), validada contra la DGII; respaldo con
  nombre manual para cédula fuera del padrón (`GhlAuthService.resolverIdentidad`).
- `puedeEmitir` + `motivoNoEmite` (`sinCertificado`/`certificadoVencido`/`sinSecuencias`) en
  `GET /tenants` y `GET /cumplimiento`; helper compartido `apps/api/src/common/emision-status.ts`.
- Frontend: onboarding rediseñado (3 fases) con `IdentificacionStep` y `CertificacionChoiceStep`;
  sección "Certificación fiscal" en Configuración (`CertificacionFiscalCard`, ancla
  `#certificacion-fiscal`) con subida de P12 + secuencias + ayuda/contacto DMAIA.
- Tests: `apps/api/test/sin-certificado.e2e-spec.ts` (11 casos).

### Changed
- `ComprobantesService`: barrera única `assertPuedeEmitir(tenantId)` en `crear(emitir=true)` y
  `emitir()` → **409** claro y accionable sin certificado activo/vigente (antes gastaba/validaba de
  forma menos explícita). Borradores (DRAFT) y cotizaciones no pasan por la barrera.
- Frontend `/nueva-factura`: mensaje de bloqueo con enlace directo a Certificación fiscal; *Guardar
  borrador* permanece habilitado sin certificado.

### Removed
- `apps/web/src/components/onboarding/RncStep.tsx` (reemplazado por `IdentificacionStep`).

### Verificación
- 101 tests e2e (api) + 118 tests (ecf-engine) verdes. Build 0 en `@facturard/api` y `@facturard/web`.
- Sin cambios en el path de emisión de producción de DMAIA.
