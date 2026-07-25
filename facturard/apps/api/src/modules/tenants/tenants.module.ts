import { Module } from '@nestjs/common'
import { TenantsController } from './tenants.controller'
import { TenantsService } from './tenants.service'
import { DgiiContribuyentesService } from './dgii-contribuyentes.service'
import { CloudinaryService } from '../../common/services/cloudinary.service'
import { RolesGuard } from '../../common/guards/roles.guard'
import { SameTenantGuard } from '../../common/guards/same-tenant.guard'

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, DgiiContribuyentesService, CloudinaryService, RolesGuard, SameTenantGuard],
  exports: [TenantsService, DgiiContribuyentesService],
})
export class TenantsModule {}
