import { Module } from '@nestjs/common'
import { ComprasController } from './compras.controller'
import { ComprasService } from './compras.service'
import { CertificadosModule } from '../certificados/certificados.module'

@Module({
  imports: [CertificadosModule], // firma del ACECF con el P12 del tenant
  controllers: [ComprasController],
  providers: [ComprasService],
  exports: [ComprasService],
})
export class ComprasModule {}
