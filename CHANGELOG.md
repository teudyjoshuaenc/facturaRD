# Changelog — FacturaRD

Todas las fechas en formato AAAA-MM-DD.

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
