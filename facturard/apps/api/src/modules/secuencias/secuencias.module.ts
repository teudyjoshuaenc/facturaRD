import { Module } from '@nestjs/common'
import { SecuenciasController } from './secuencias.controller'
import { SecuenciasService } from './secuencias.service'

@Module({
  controllers: [SecuenciasController],
  providers: [SecuenciasService],
  exports: [SecuenciasService],
})
export class SecuenciasModule {}
