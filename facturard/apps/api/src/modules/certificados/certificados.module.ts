import { Module } from '@nestjs/common'
import { CertificadosController } from './certificados.controller'
import { CertificadosService } from './certificados.service'
import { CryptoService } from '../../common/services/crypto.service'
import { RolesGuard } from '../../common/guards/roles.guard'

@Module({
  controllers: [CertificadosController],
  providers: [CertificadosService, CryptoService, RolesGuard],
  exports: [CertificadosService],
})
export class CertificadosModule {}
