import { Module } from '@nestjs/common'
import { ContactosController } from './contactos.controller'
import { ContactosService } from './contactos.service'
import { GhlContactosService } from './ghl-contactos.service'
import { CryptoService } from '../../common/services/crypto.service'
import { GhlHttpService } from '../../common/services/ghl-http.service'
import { TenantsModule } from '../tenants/tenants.module'

@Module({
  imports: [TenantsModule], // reutiliza DgiiContribuyentesService
  controllers: [ContactosController],
  providers: [ContactosService, GhlContactosService, CryptoService, GhlHttpService],
  exports: [ContactosService],
})
export class ContactosModule {}
