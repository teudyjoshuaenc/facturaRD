import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { ReportesService } from './reportes.service'
import { ReporteQueryDto } from './dto/reporte-query.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'

@ApiTags('Reportes DGII')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  private enviarTxt(res: Response, txt: string, filename: string): void {
    res.type('text/plain')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(txt)
  }

  @Get('607')
  @ApiOperation({ summary: 'Reporte 607 (ventas). formato=json|txt' })
  @ApiQuery({ name: 'desde', required: true })
  @ApiQuery({ name: 'hasta', required: true })
  @ApiQuery({ name: 'formato', enum: ['json', 'txt'], required: false })
  async r607(@CurrentTenant() tenantId: string, @Query() q: ReporteQueryDto, @Res() res: Response): Promise<void> {
    const data = await this.service.reporte607(tenantId, q.desde, q.hasta)
    if (q.formato === 'txt') {
      this.enviarTxt(res, this.service.toTxt607(data), this.service.nombreArchivo(data))
      return
    }
    res.json(data)
  }

  @Get('606')
  @ApiOperation({ summary: 'Reporte 606 (compras). formato=json|txt' })
  @ApiQuery({ name: 'desde', required: true })
  @ApiQuery({ name: 'hasta', required: true })
  @ApiQuery({ name: 'formato', enum: ['json', 'txt'], required: false })
  async r606(@CurrentTenant() tenantId: string, @Query() q: ReporteQueryDto, @Res() res: Response): Promise<void> {
    const data = await this.service.reporte606(tenantId, q.desde, q.hasta)
    if (q.formato === 'txt') {
      this.enviarTxt(res, this.service.toTxt606(data), this.service.nombreArchivo(data))
      return
    }
    res.json(data)
  }

  @Get('608')
  @ApiOperation({ summary: 'Reporte 608 (anulados). formato=json|txt' })
  @ApiQuery({ name: 'desde', required: true })
  @ApiQuery({ name: 'hasta', required: true })
  @ApiQuery({ name: 'formato', enum: ['json', 'txt'], required: false })
  async r608(@CurrentTenant() tenantId: string, @Query() q: ReporteQueryDto, @Res() res: Response): Promise<void> {
    const data = await this.service.reporte608(tenantId, q.desde, q.hasta)
    if (q.formato === 'txt') {
      this.enviarTxt(res, this.service.toTxt608(data), this.service.nombreArchivo(data))
      return
    }
    res.json(data)
  }
}
