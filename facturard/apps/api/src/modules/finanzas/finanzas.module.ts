import { Module } from '@nestjs/common'
import { FinanzasController } from './finanzas.controller'
import { FinanzasService } from './finanzas.service'

// Módulo de flujo de caja (ingresos/egresos). 100% lectura sobre lo fiscal +
// sus propias tablas (movimientos, pagos, capital). NO participa del ciclo DGII.
@Module({
  controllers: [FinanzasController],
  providers: [FinanzasService],
  exports: [FinanzasService],
})
export class FinanzasModule {}
