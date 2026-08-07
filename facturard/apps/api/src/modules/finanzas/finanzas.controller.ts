import { Controller, Get, Post, Patch, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { FinanzasService } from './finanzas.service'
import { CreateMovimientoDto } from './dto/create-movimiento.dto'
import { UpdateMovimientoDto } from './dto/update-movimiento.dto'
import { ListMovimientosDto } from './dto/list-movimientos.dto'
import { CreatePagoDto } from './dto/create-pago.dto'
import { ListPagosDto } from './dto/list-pagos.dto'
import { SetCapitalDto } from './dto/set-capital.dto'
import { RangoDto } from './dto/rango.dto'
import { FlujoDto } from './dto/flujo.dto'
import { SaldoDto } from './dto/saldo.dto'
import { ListTransaccionesDto } from './dto/list-transacciones.dto'
import { AperturaCajaDto } from './dto/apertura-caja.dto'
import { CierreCajaDto } from './dto/cierre-caja.dto'
import { ListCajaDto } from './dto/list-caja.dto'
import { GetCajaDto } from './dto/get-caja.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'

@ApiTags('Finanzas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finanzas')
export class FinanzasController {
  constructor(private readonly service: FinanzasService) {}

  // ─── Movimientos manuales ──────────────────────────────────────────────
  @Post('movimientos')
  @ApiOperation({ summary: 'Registra un movimiento manual (ingreso/egreso)' })
  crearMovimiento(@CurrentTenant() tenantId: string, @Body() dto: CreateMovimientoDto) {
    return this.service.crearMovimiento(tenantId, dto)
  }

  @Get('movimientos')
  @ApiOperation({ summary: 'Lista movimientos manuales con filtros y paginación' })
  listMovimientos(@CurrentTenant() tenantId: string, @Query() query: ListMovimientosDto) {
    return this.service.listMovimientos(tenantId, query)
  }

  @Get('movimientos/:id')
  @ApiOperation({ summary: 'Detalle de un movimiento manual' })
  findMovimiento(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findMovimiento(tenantId, id)
  }

  @Patch('movimientos/:id')
  @ApiOperation({ summary: 'Actualiza un movimiento manual' })
  actualizarMovimiento(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateMovimientoDto) {
    return this.service.actualizarMovimiento(tenantId, id, dto)
  }

  @Delete('movimientos/:id')
  @ApiOperation({ summary: 'Elimina un movimiento manual' })
  eliminarMovimiento(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.eliminarMovimiento(tenantId, id)
  }

  // ─── Pagos / cobros ────────────────────────────────────────────────────
  @Post('pagos')
  @ApiOperation({ summary: 'Registra un cobro (factura) o pago (compra). NO toca el estado DGII' })
  crearPago(@CurrentTenant() tenantId: string, @Body() dto: CreatePagoDto) {
    return this.service.crearPago(tenantId, dto)
  }

  @Get('pagos')
  @ApiOperation({ summary: 'Lista pagos/cobros con filtros' })
  listPagos(@CurrentTenant() tenantId: string, @Query() query: ListPagosDto) {
    return this.service.listPagos(tenantId, query)
  }

  @Delete('pagos/:id')
  @ApiOperation({ summary: 'Elimina un pago/cobro' })
  eliminarPago(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.eliminarPago(tenantId, id)
  }

  @Get('saldo')
  @ApiOperation({ summary: 'Saldo pendiente de una factura o compra (monto − abonos)' })
  saldo(@CurrentTenant() tenantId: string, @Query() query: SaldoDto) {
    return this.service.saldo(tenantId, query)
  }

  // ─── Capital inicial ───────────────────────────────────────────────────
  @Get('capital')
  @ApiOperation({ summary: 'Saldo de partida del negocio' })
  getCapital(@CurrentTenant() tenantId: string) {
    return this.service.getCapital(tenantId)
  }

  @Put('capital')
  @ApiOperation({ summary: 'Setea/actualiza el saldo de partida' })
  setCapital(@CurrentTenant() tenantId: string, @Body() dto: SetCapitalDto) {
    return this.service.setCapital(tenantId, dto)
  }

  // ─── Tablero ───────────────────────────────────────────────────────────
  @Get('resumen')
  @ApiOperation({ summary: 'Totales ingresos/egresos/balance/capital en vistas devengado y cobrado' })
  resumen(@CurrentTenant() tenantId: string, @Query() query: RangoDto) {
    return this.service.resumen(tenantId, query)
  }

  @Get('flujo')
  @ApiOperation({ summary: 'Serie temporal ingresos/egresos por mes o semana (para el gráfico)' })
  flujo(@CurrentTenant() tenantId: string, @Query() query: FlujoDto) {
    return this.service.flujo(tenantId, query)
  }

  @Get('categorias')
  @ApiOperation({ summary: 'Desglose de movimientos manuales por categoría' })
  categorias(@CurrentTenant() tenantId: string, @Query() query: RangoDto) {
    return this.service.categorias(tenantId, query)
  }

  @Get('transacciones')
  @ApiOperation({ summary: 'Feed unificado (facturas/compras/notas/movimientos) filtrable — base del historial y export' })
  transacciones(@CurrentTenant() tenantId: string, @Query() query: ListTransaccionesDto) {
    return this.service.transacciones(tenantId, query)
  }

  // ─── Caja diaria (apertura/cierre de efectivo) ──────────────────────────
  @Get('caja')
  @ApiOperation({ summary: 'Estado de la caja del día: no abierta / abierta (monto actual en vivo) / cerrada' })
  getCaja(@CurrentTenant() tenantId: string, @Query() query: GetCajaDto) {
    return this.service.getCaja(tenantId, query.fecha)
  }

  @Get('caja/historial')
  @ApiOperation({ summary: 'Historial de aperturas/cierres de caja' })
  listCajas(@CurrentTenant() tenantId: string, @Query() query: ListCajaDto) {
    return this.service.listCajas(tenantId, query)
  }

  @Post('caja/apertura')
  @ApiOperation({ summary: 'Abre la caja del día con el efectivo inicial' })
  abrirCaja(@CurrentTenant() tenantId: string, @Body() dto: AperturaCajaDto) {
    return this.service.abrirCaja(tenantId, dto)
  }

  @Post('caja/cierre')
  @ApiOperation({ summary: 'Cierra la caja del día: calcula esperado y diferencia contra lo contado' })
  cerrarCaja(@CurrentTenant() tenantId: string, @Body() dto: CierreCajaDto) {
    return this.service.cerrarCaja(tenantId, dto)
  }
}
