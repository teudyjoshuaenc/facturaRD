import { Module } from '@nestjs/common'
import { CotizacionesController } from './cotizaciones.controller'
import { CotizacionesService } from './cotizaciones.service'
import { CotizacionFolioService } from './cotizacion-folio.service'
import { ComprobantesModule } from '../comprobantes/comprobantes.module'

@Module({
  imports: [ComprobantesModule], // reutiliza ComprobantesService (totales + crear/emisión)
  controllers: [CotizacionesController],
  providers: [CotizacionesService, CotizacionFolioService],
  exports: [CotizacionesService],
})
export class CotizacionesModule {}
