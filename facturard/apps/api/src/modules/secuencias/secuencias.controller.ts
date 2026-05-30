import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { SecuenciasService } from './secuencias.service'
import { InicializarSecuenciasDto } from './dto/inicializar-secuencia.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { SameTenantGuard } from '../../common/guards/same-tenant.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole, TipoECF } from '@facturard/database'
import type { JwtPayload } from '../auth/strategies/jwt.strategy'

@ApiTags('Secuencias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('secuencias')
export class SecuenciasController {
  constructor(private readonly service: SecuenciasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todas las secuencias del tenant actual' })
  getSecuencias(@CurrentUser() user: JwtPayload) {
    return this.service.getSecuencias(user.tenantId)
  }

  @Get('estadisticas')
  @ApiOperation({ summary: 'Estadísticas de secuencias del tenant' })
  getEstadisticas(@CurrentUser() user: JwtPayload) {
    return this.service.getEstadisticas(user.tenantId)
  }

  @Get(':tipoECF')
  @ApiOperation({ summary: 'Obtiene la secuencia de un tipo de e-CF específico' })
  getSecuencia(@CurrentUser() user: JwtPayload, @Param('tipoECF') tipoECF: TipoECF) {
    return this.service.getSecuencia(user.tenantId, tipoECF)
  }

  @Post('inicializar')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Inicializa o reinicia secuencias para un tenant (SUPER_ADMIN)' })
  inicializar(@Body() dto: InicializarSecuenciasDto, @CurrentUser() user: JwtPayload) {
    const items = dto.secuencias.map((s) => {
      const item: { tipoECF: TipoECF; ultimaSecuencia?: number; fechaVencimiento?: Date } = {
        tipoECF: s.tipoECF,
      }
      if (s.ultimaSecuencia !== undefined) item.ultimaSecuencia = s.ultimaSecuencia
      if (s.fechaVencimiento) item.fechaVencimiento = new Date(s.fechaVencimiento)
      return item
    })
    return this.service.inicializarSecuencias(user.tenantId, items)
  }

  @Post('inicializar-todos')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Inicializa todos los tipos de e-CF para el tenant (SUPER_ADMIN)' })
  inicializarTodos(@CurrentUser() user: JwtPayload) {
    return this.service.inicializarTodosLosTipos(user.tenantId)
  }
}
