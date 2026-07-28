# Propuesta — Módulo de Presupuesto y Proyección de Caja

Basado en el prototipo `~/dmaia-finanzas-prototipo/index.html` ("Dmaia Control"). Este documento mapea qué se reutiliza, qué es nuevo, y el plan de implementación.

## 1. Qué es esto realmente

El prototipo NO es otro "Finanzas" — es un módulo de **presupuesto y forecast**: el usuario declara supuestos (ingresos esperados, costos fijos, % de costo variable, colchón de seguridad) y el sistema proyecta 12 meses de caja hacia adelante. Es fundamentalmente distinto de `/finanzas` actual, que reporta **datos reales ya ocurridos** (facturas emitidas, compras, pagos, movimientos manuales).

Relación entre ambos:
- `/finanzas` (ya existe) = **lo que pasó** — devengado/cobrado, lectura de comprobantes/compras/pagos.
- `/presupuesto` (nuevo) = **lo que planeaste que iba a pasar** — supuestos + proyección matemática hacia adelante.
- El propio prototipo anota que la fase 2 conecta ambos ("cuando conectemos tu facturación, las entradas se llenan solas") — o sea, el diseño ya asume que en algún punto el presupuesto lee datos reales de finanzas. Dejamos ese gancho listo pero NO lo implementamos ahora (documentado como fuera de alcance en §7).

## 2. Qué ya existe y se reutiliza al 100% (cero código nuevo)

| Pantalla del prototipo | Ya existe en FacturaRD | Notas |
|---|---|---|
| "Movimientos" (registrar entrada/salida real) | `MovimientoFinanciero` + `POST/GET/PATCH/DELETE /finanzas/movimientos` | Reutilizar tal cual. El prototipo usa categoría libre; nuestro enum (`NOMINA\|ALQUILER\|SERVICIOS\|PRESTAMO\|APORTE_CAPITAL\|IMPUESTOS\|OTROS`) ya cubre los casos reales — mapear en la UI, no tocar backend. |
| "Punto de partida → efectivo en caja" | `CapitalInicial` + `GET/PUT /finanzas/capital` | Es el mismo concepto (`monto`, `moneda`, `fecha`). Reutilizar directo. |
| Config → nombre, RNC, teléfono, correo, dirección | `Tenant` + `PATCH /tenants/empresa` | Ya existe completo (Sprint "Ajustes UI"). RNC/razón social siguen no-editables (vienen de DGII), como ya está. |
| Config → logo | `Tenant.logoUrl/logoPublicId` + subida real a Cloudinary | Ya existe (Sprint logo). El prototipo hace resize client-side a un canvas — nosotros ya tenemos subida real, es mejor, no hace falta portar esa lógica. |
| "Real vs. presupuesto" (comparación del mes) | Se compone llamando a `FinanzasService.resumen()` existente | No se reimplementa el cálculo de real — se inyecta el servicio existente. |

**Conclusión: `Movimientos`, `Configuración → empresa/logo`, y "capital inicial" no requieren ni un endpoint nuevo.** Solo requieren wiring de frontend contra hooks que ya existen (`useFinanzas.ts`).

## 3. Qué es genuinamente nuevo

No hay overlap: **onboarding de presupuesto, línea de ingresos proyectados, línea de costos fijos, parámetros de negocio (% variable, colchón, meta de margen, sector, moneda, mes fiscal), motor de proyección de 12 meses, y las alertas de riesgo.** Nada de esto existe hoy.

### 3.1 Modelo de datos (migración aditiva, mismo patrón que Sprint 13 Finanzas — cero `ALTER` sobre tablas fiscales)

**Decisión de diseño — JSON en vez de tablas relacionales para las líneas de presupuesto:**

El prototipo edita "ingresos" y "costos fijos" como una lista completa que se guarda de una vez (no hay altas/bajas persistentes fila-por-fila con historial). Ya hay precedente en este codebase de guardar bloques estructurados como JSON cuando no necesitan ser queryables individualmente (`Comprobante.datos`). Propongo:

```prisma
model PresupuestoConfig {
  id              String   @id @default(uuid())
  tenantId        String   @unique
  sector          String?
  moneda          String   @default("DOP")   // ámbito de ESTE módulo solamente — NO toca Tenant ni el motor fiscal (DGII siempre DOP)
  mesFiscalInicio Int      @default(0)        // 0=enero … 11=diciembre
  colchonMeses    Int      @default(3)
  metaMargenPct   Decimal  @db.Decimal(5, 2) @default(20)
  varPct          Decimal  @db.Decimal(5, 2) @default(0)  // costo variable como % de ingresos
  cxcInicial      Decimal  @db.Decimal(18, 2) @default(0) // por cobrar hoy — informativo, no existe en ningún lado hoy
  cxpInicial      Decimal  @db.Decimal(18, 2) @default(0) // por pagar hoy
  ingresos        Json     @default("[]")     // [{ nombre, montoMensual, crecimientoPct }]
  costosFijos     Json     @default("[]")     // [{ nombre, categoria, montoMensual }]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@map("presupuesto_config")
}
```

Un registro por tenant (como `CapitalInicial`). Se lee/escribe entero con un `PUT` — igual que el prototipo hace con su blob de `localStorage`, solo que ahora persiste en Postgres.

**Alternativa considerada y descartada:** tablas `PresupuestoIngreso`/`PresupuestoCostoFijo` separadas con CRUD por fila. Más "correcto" relacionalmente, pero agrega 2 tablas + 2 migraciones + ~8 endpoints para un caso de uso que en la práctica es "editá la lista completa y guardá" — sobre-ingeniería para lo que hace falta. Si en el futuro se necesita auditoría por línea o referenciar una línea de presupuesto desde otra tabla, ahí sí se justifica migrar a tablas.

**Por qué `moneda`/`sector` NO van en `Tenant`:** el motor fiscal (DGII) es DOP-únicamente, no negociable. Si `moneda` viviera en `Tenant`, se arriesga que algún flujo fiscal la lea por error. Vive aislada en `PresupuestoConfig`, module boundary explícito.

### 3.2 Motor de proyección — servicio puro, sin persistencia

Mismo algoritmo que `calc()` del prototipo (lo revisé línea por línea, es determinístico y correcto: `saldo`, `entra` con crecimiento compuesto por mes, `varc = entra × varPct`, `neto = entra - fijo - varc`, alertas de quiebre/riesgo por colchón). Se porta 1:1 a TypeScript, se calcula on-the-fly en cada request — **no se guarda la proyección**, se recalcula desde `PresupuestoConfig` + `CapitalInicial.monto` cada vez (barato, son 12 iteraciones).

```
GET /presupuesto/proyeccion
→ {
    filas: [{ mes, entra, fijo, variable, neto, saldo }] × 12,
    resumen: { totalEntradas, totalSalidas, totalNeto, margenPct, puntoEquilibrio, saldoFinal },
    alertas: { quiebre: {mes, saldo} | null, riesgoColchon: {mes, saldo} | null }
  }
```

### 3.3 Endpoints nuevos — módulo `presupuesto` (nuevo, separado de `finanzas`)

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/presupuesto/config` | Trae config actual (o defaults si el tenant nunca configuró) |
| `PUT` | `/presupuesto/config` | Upsert completo: perfil + ingresos[] + costosFijos[] + parámetros. Un solo call, se usa tanto en el wizard de onboarding como en la pantalla "Presupuesto" |
| `GET` | `/presupuesto/proyeccion` | Motor de cálculo — 12 meses + alertas (§3.2) |
| `GET` | `/presupuesto/comparacion?mes=YYYY-MM` | Real (vía `FinanzasService.resumen`) vs. presupuestado del mes — alimenta la pestaña "Movimientos → Real vs. presupuesto" |

Por qué módulo separado y no meterlo dentro de `FinanzasModule`: `finanzas.service.ts` ya tiene ~500 líneas cubriendo movimientos/pagos/capital/resumen/flujo/categorías/transacciones. Meterle el motor de proyección encima lo vuelve un god-service. `PresupuestoModule` importa `FinanzasModule` (para `FinanzasService.resumen()` en `/comparacion`), no al revés — dependencia unidireccional, límite de responsabilidad claro.

## 4. Frontend

**Decisión — no es una sección nueva en el sidebar, son tabs dentro de `/finanzas`:**

El prototipo es una app standalone, por eso tiene su propio shell (sidebar con Panel/Proyección/Presupuesto/Movimientos/Configuración). Portado tal cual a FacturaRD duplicaría cosas que ya tienen hogar: "Movimientos" ya vive en `/finanzas`, "Configuración → empresa/logo" ya vive en `/empresa` y `/configuracion`. Propongo:

- `/finanzas` gana dos tabs nuevos junto al toggle Devengado/Cobrado actual: **"Presupuesto"** y **"Proyección"**.
- El onboarding del wizard (6 pasos) se dispara la primera vez que el tenant entra a la tab "Presupuesto" sin `PresupuestoConfig` — modal de wizard, no una ruta aparte (mismo patrón de wizard-en-modal ya usado en otros lados del producto).
- "Real vs. presupuesto" y el balance de movimientos ya tienen hogar en la tab "Historial" existente de `/finanzas` — se le agrega la comparación contra presupuesto ahí, no una vista nueva.

Componentes nuevos (siguiendo la convención de `components/finanzas/*.tsx` existente):
- `PresupuestoOnboardingModal.tsx` — wizard 6 pasos, un solo `PUT /presupuesto/config` al final.
- `PresupuestoForm.tsx` — edición de ingresos[]/costosFijos[]/parámetros (tab "Presupuesto").
- `ProyeccionChart.tsx` — el gráfico de 12 meses (portar el canvas a como ya se hace en otros gráficos del proyecto, o SVG — revisar si ya hay una librería de charts en uso antes de decidir).
- `ProyeccionTable.tsx` — detalle mes a mes con flag de riesgo.
- Hook `usePresupuesto.ts` — espejo de `useFinanzas.ts`, contra los 4 endpoints de §3.3.

## 5. Plan de implementación (orden sugerido)

1. Migración Prisma `add_presupuesto` (modelo §3.1) + `pnpm --filter @facturard/database migrate:dev`.
2. `PresupuestoModule` backend: DTOs (`UpsertPresupuestoConfigDto` con validación de arrays de ingresos/costos), `PresupuestoService` (motor de cálculo puro + CRUD de config), `PresupuestoController` (4 rutas de §3.3). Importa `FinanzasModule`.
3. Tests e2e: `presupuesto.e2e-spec.ts` — cálculo de proyección con casos conocidos (comparar contra los mismos números que el prototipo produce, ya que el algoritmo se porta 1:1 — sirve como test de regresión cruzada), aislamiento fiscal (no toca comprobantes/reportes), defaults sin config.
4. Frontend: `usePresupuesto.ts` + los 4 componentes de §4, wireados como tabs de `/finanzas`.
5. QA manual del wizard end-to-end contra un tenant de prueba.

## 6. Preguntas abiertas — necesito tu decisión antes de tocar código

1. **¿Tabs dentro de `/finanzas` o sección nueva en el sidebar?** Recomiendo tabs (§4) por evitar duplicar Movimientos/Configuración, pero si el plan de producto es que esto crezca mucho (multi-escenario, comparar presupuestos, etc.) capaz amerita espacio propio desde ya.
2. **`cxcInicial`/`cxpInicial`** (por cobrar/por pagar hoy) — el prototipo los pide pero no los usa en ningún cálculo visible del `calc()` (los guarda pero no los proyecta). ¿Los implementamos solo como campos informativos (como hace el prototipo), o hay un uso real pensado (ej. ajustar el saldo inicial de la proyección)?
3. **Gráfico de 12 meses** — el prototipo lo dibuja a mano en `<canvas>`. ¿Seguimos esa ruta (cero dependencias) o ya hay una librería de charts aprobada en el proyecto que debería usar en su lugar?

## 7. Explícitamente fuera de alcance (por ahora)

- Conectar "ingresos proyectados" a facturas reales emitidas (la propia Fase 2 que anota el prototipo). El wizard queda 100% manual, como en el prototipo actual.
- Multi-moneda real (USD/EUR) — el campo existe en el modelo pero no hay conversión de tasas; si el tenant elige USD, los números simplemente se etiquetan USD sin FX.
- Multi-escenario / comparar presupuestos históricos.
