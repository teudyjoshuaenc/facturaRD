import { Module } from '@nestjs/common'
import { ContactosController } from './contactos.controller'
import { ContactosService } from './contactos.service'
import { GhlContactosService } from './ghl-contactos.service'
import { CryptoService } from '../../common/services/crypto.service'
import { TenantsModule } from '../tenants/tenants.module'

@Module({
  imports: [TenantsModule], // reutiliza DgiiContribuyentesService
  controllers: [ContactosController],
  providers: [ContactosService, GhlContactosService, CryptoService],
  exports: [ContactosService],
})
export class ContactosModule {}
