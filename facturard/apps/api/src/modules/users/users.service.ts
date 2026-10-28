import { Injectable, ConflictException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { prisma } from '@facturard/database'
import type { User } from '@facturard/database'
import type { CreateUserDto } from './dto/create-user.dto'

@Injectable()
export class UsersService {
  async create(tenantId: string, dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await prisma.user.findUnique({ where: { tenantId_email: { tenantId, email: dto.email } } })
    if (existing) throw new ConflictException('Email ya registrado en este tenant')

    const passwordHash = await bcrypt.hash(dto.password, 12)
    // Campos explícitos: nunca se esparce el DTO (evita colar role/tenantId/activo).
    const user = await prisma.user.create({
      data: { tenantId, email: dto.email, nombre: dto.nombre, passwordHash, ...(dto.role ? { role: dto.role } : {}) },
    })
    const { passwordHash: _hash, ...rest } = user
    return rest
  }

  async findAll(tenantId: string): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await prisma.user.findMany({ where: { tenantId, activo: true } })
    return users.map(({ passwordHash: _h, ...u }) => u)
  }
}
