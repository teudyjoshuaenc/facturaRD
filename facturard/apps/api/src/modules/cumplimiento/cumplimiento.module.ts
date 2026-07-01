import { Module } from '@nestjs/common'
import { CumplimientoController } from './cumplimiento.controller'
import { CumplimientoService } from './cumplimiento.service'

@Module({
  controllers: [CumplimientoController],
  providers: [CumplimientoService],
})
export class CumplimientoModule {}
