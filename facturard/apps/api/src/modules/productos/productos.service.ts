import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { Prisma, prisma } from '@facturard/database'
import type { Producto } from '@facturard/database'
import type { CreateProductoDto } from './dto/create-producto.dto'
import type { UpdateProductoDto } from './dto/update-producto.dto'
import type { ListProductosDto } from './dto/list-productos.dto'
import type { PaginatedResponse } from '@facturard/shared'

@Injectable()
export class ProductosService {
  async crear(tenantId: string, dto: CreateProductoDto): Promise<Producto> {
    await this.assertCodigoLibre(tenantId, dto.codigo)
    return prisma.producto.create({
      data: {
        tenantId,
        tipo: dto.tipo,
        nombre: dto.nombre,
        precioUnitario: dto.precioUnitario,
        tratamientoITBIS: dto.tratamientoITBIS ?? 'I1',
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.unidadMedida !== undefined && { unidadMedida: dto.unidadMedida }),
        ...(dto.codigo !== undefined && { codigo: dto.codigo }),
        ...(dto.categoria !== undefined && { categoria: dto.categoria }),
      },
    })
  }

  async findAll(tenantId: string, query: ListProductosDto): Promise<PaginatedResponse<Producto>> {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const where: Prisma.ProductoWhereInput = {
      tenantId,
      // Filtro de 3 estados: sin parámetro → todos (activos e inactivos);
      // activo=true → sólo activos; activo=false → sólo inactivos (soft-deleted).
      ...(query.activo !== undefined && { activo: query.activo }),
      ...(query.tipo !== undefined && { tipo: query.tipo }),
      ...(query.categoria !== undefined && { categoria: query.categoria }),
      ...(query.search !== undefined && query.search.trim() !== ''
          ? {
            OR: [
              { nombre: { contains: query.search, mode: 'insensitive' } },
              { codigo: { contains: query.search, mode: 'insensitive' } },
              { descripcion: { contains: query.search, mode: 'insensitive' } },
            ],
          }
          : {}),
    }

    const [data, total] = await prisma.$transaction([
      prisma.producto.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.producto.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(tenantId: string, id: string): Promise<Producto> {
    const producto = await prisma.producto.findFirst({ where: { id, tenantId } })
    if (!producto) throw new NotFoundException(`Producto ${id} no encontrado`)
    return producto
  }

  async actualizar(tenantId: string, id: string, dto: UpdateProductoDto): Promise<Producto> {
    await this.findOne(tenantId, id) // 404 si no es del tenant
    if (dto.codigo !== undefined) await this.assertCodigoLibre(tenantId, dto.codigo, id)

    return prisma.producto.update({
      where: { id },
      data: {
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.precioUnitario !== undefined && { precioUnitario: dto.precioUnitario }),
        ...(dto.tratamientoITBIS !== undefined && { tratamientoITBIS: dto.tratamientoITBIS }),
        ...(dto.unidadMedida !== undefined && { unidadMedida: dto.unidadMedida }),
        ...(dto.codigo !== undefined && { codigo: dto.codigo }),
        ...(dto.categoria !== undefined && { categoria: dto.categoria }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
    })
  }

  async remove(tenantId: string, id: string): Promise<Producto> {
    await this.findOne(tenantId, id) // 404 si no es del tenant
    // Soft delete: activo=false. El registro sigue accesible por id.
    return prisma.producto.update({ where: { id }, data: { activo: false } })
  }

  /** Rechaza (409) un código ya usado por otro producto del tenant. */
  private async assertCodigoLibre(tenantId: string, codigo?: string, exceptoId?: string): Promise<void> {
    if (codigo === undefined || codigo === '') return
    const existing = await prisma.producto.findFirst({ where: { tenantId, codigo } })
    if (existing && existing.id !== exceptoId) {
      throw new ConflictException(`Ya existe un producto con el código "${codigo}"`)
    }
  }
}
