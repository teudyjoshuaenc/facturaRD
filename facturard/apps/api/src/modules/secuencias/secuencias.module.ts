import { Module } from '@nestjs/common'
import { SecuenciasController } from './secuencias.controller'
import { SecuenciasService } from './secuencias.service'
import { SecuenciasDgiiService } from './secuencias-dgii.service'
import { DgiiTrackIdsClient } from './dgii-trackids.client'
import { CertificadosModule } from '../certificados/certificados.module'

@Module({
  imports: [CertificadosModule],
  controllers: [SecuenciasController],
  providers: [SecuenciasService, SecuenciasDgiiService, DgiiTrackIdsClient],
  exports: [SecuenciasService],
})
export class SecuenciasModule {}
