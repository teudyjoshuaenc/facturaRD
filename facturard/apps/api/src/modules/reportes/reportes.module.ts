import { Module } from '@nestjs/common'
import { ReportesController } from './reportes.controller'
import { ReportesService } from './reportes.service'
import { ComprobantesModule } from '../comprobantes/comprobantes.module'

@Module({
  imports: [ComprobantesModule], // reutiliza el cálculo de totales de la emisión
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
