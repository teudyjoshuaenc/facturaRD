import { Injectable, NotFoundException } from '@nestjs/common'
import * as crypto from 'crypto'
import { prisma } from '@facturard/database'
import type { ApiKey } from '@facturard/database'
import type { CreateApiKeyDto } from './dto/create-api-key.dto'

export interface CreatedApiKey extends Omit<ApiKey, 'keyHash'> {
  key: string
}

@Injectable()
export class ApiKeysService {
  async create(tenantId: string, dto: CreateApiKeyDto): Promise<CreatedApiKey> {
    const rawKey = `frd_${crypto.randomBytes(32).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

    const apiKey = await prisma.apiKey.create({
      data: { tenantId, nombre: dto.nombre, keyHash },
    })

    const { keyHash: _h, ...rest } = apiKey
    return { ...rest, key: rawKey }
  }

  async findAll(tenantId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    const keys = await prisma.apiKey.findMany({ where: { tenantId, activo: true } })
    return keys.map(({ keyHash: _h, ...rest }) => rest)
  }

  async revoke(tenantId: string, id: string): Promise<void> {
    const key = await prisma.apiKey.findFirst({ where: { id, tenantId } })
    if (!key) throw new NotFoundException(`API key ${id} no encontrada`)
    await prisma.apiKey.update({ where: { id }, data: { activo: false } })
  }
}
