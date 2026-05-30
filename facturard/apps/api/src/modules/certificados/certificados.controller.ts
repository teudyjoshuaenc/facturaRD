import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger'
import { CertificadosService } from './certificados.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'
import { UserRole } from '@facturard/database'
import type { JwtPayload } from '../auth/strategies/jwt.strategy'

const MAX_P12_SIZE = 1024 * 1024 // 1 MB

@ApiTags('Certificados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('certificados')
export class CertificadosController {
  constructor(private readonly service: CertificadosService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Sube y almacena el certificado P12 del tenant (cifrado AES-256-GCM)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'passphrase'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Archivo .p12' },
        passphrase: { type: 'string', description: 'Contraseña del certificado' },
      },
    },
  })
  upload(
    @CurrentTenant() tenantId: string,
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: MAX_P12_SIZE })] }))
    file: Express.Multer.File,
    @Body('passphrase') passphrase: string,
  ) {
    return this.service.upload(tenantId, file.buffer, passphrase)
  }

  @Get()
  @ApiOperation({ summary: 'Lista certificados. SUPER_ADMIN puede filtrar por ?tenantId=' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Solo para SUPER_ADMIN' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') filterTenantId?: string,
  ) {
    return this.service.findAll(user.tenantId, user.role, filterTenantId)
  }

  @Get('active')
  @ApiOperation({ summary: 'Devuelve el certificado activo del tenant actual' })
  getActive(@CurrentTenant() tenantId: string) {
    return this.service.getActive(tenantId)
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Desactiva un certificado (soft delete)' })
  deactivate(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.deactivate(tenantId, id)
  }
}
