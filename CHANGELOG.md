# Changelog — FacturaRD

Todas las fechas en formato AAAA-MM-DD.

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
