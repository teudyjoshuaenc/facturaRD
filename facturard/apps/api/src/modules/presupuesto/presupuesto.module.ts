import { Module } from '@nestjs/common'
import { PresupuestoController } from './presupuesto.controller'
import { PresupuestoService } from './presupuesto.service'
import { FinanzasModule } from '../finanzas/finanzas.module'

// Presupuesto/proyección de caja a 12 meses. NO fiscal, NO participa del
// ciclo DGII. Importa FinanzasModule (composición unidireccional: solo lee
// FinanzasService.resumen() para comparar real vs. presupuestado).
@Module({
  imports: [FinanzasModule],
  controllers: [PresupuestoController],
  providers: [PresupuestoService],
})
export class PresupuestoModule {}
