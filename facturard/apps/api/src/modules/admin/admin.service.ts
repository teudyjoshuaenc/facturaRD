import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import * as bcrypt from 'bcrypt'
import * as QRCode from 'qrcode'
import { prisma, Prisma } from '@facturard/database'
import type { AdminUsuario, AmbienteDgii, RolAdmin, TenantEstado } from '@facturard/database'
import { CryptoService } from '../../common/services/crypto.service'
import { generarSecretoTotp, urlOtpauth, verificarTotp } from '../../common/services/totp'
import { CertificadosService } from '../certificados/certificados.service'
import type { PayloadAdmin } from './admin-auth.guard'

const MAX_INTENTOS = 5
const BLOQUEO_MINUTOS = 15
const POR_PAGINA = 25

export interface Contexto {
  admin: AdminUsuario
  ip?: string | undefined
}

/** Panel de administración DMAIA: clientes, acciones y datos sensibles (con 2FA y auditoría). */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name)

  constructor(
    private readonly jwt: JwtService,
    private readonly crypto: CryptoService,
    private readonly certificados: CertificadosService,
    @InjectQueue('ecf-emission') private readonly ecfQueue: Queue,
  ) {}

  // ── Acceso: contraseña → 2FA (obligatorio) ─────────────────────────────────

  async login(emailCrudo: string, password: string, ip?: string) {
    const admin = await prisma.adminUsuario.findUnique({ where: { email: emailCrudo.trim().toLowerCase() } })
    const bloqueado = admin?.bloqueadoHasta && admin.bloqueadoHasta > new Date()
    if (!admin?.activo || bloqueado || !(await bcrypt.compare(password, admin.passwordHash))) {
      if (admin && !bloqueado) await this.registrarFallo(admin)
      await this.auditar(null, 'ADMIN_LOGIN_FALLIDO', null, { email: emailCrudo }, ip)
      throw new UnauthorizedException(bloqueado ? `Demasiados intentos. Espera ${BLOQUEO_MINUTOS} minutos.` : 'Correo o contraseña incorrectos')
    }
    const siguiente = admin.totpActivo ? 'codigo' : 'configurar'
    const tokenPaso = this.jwt.sign({ sub: admin.id, type: 'admin-paso', siguiente } satisfies PayloadAdmin, { expiresIn: '10m' })
    return { siguiente, tokenPaso }
  }

  async configurarDosPasos(admin: AdminUsuario) {
    if (admin.totpActivo) throw new ConflictException('La verificación en dos pasos ya está activa')
    const secreto = admin.totpSecretCifrado ? this.crypto.decryptString(admin.totpSecretCifrado) : generarSecretoTotp()
    if (!admin.totpSecretCifrado) {
      await prisma.adminUsuario.update({ where: { id: admin.id }, data: { totpSecretCifrado: this.crypto.encryptString(secreto) } })
    }
    const otpauthUrl = urlOtpauth(secreto, admin.email, 'FacturaRD Admin')
    return { otpauthUrl, qrDataUrl: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 }), secreto }
  }

  async activarDosPasos(admin: AdminUsuario, codigo: string, ip?: string) {
    if (!admin.totpSecretCifrado) throw new BadRequestException('Primero genera el código QR')
    if (!verificarTotp(this.crypto.decryptString(admin.totpSecretCifrado), codigo)) {
      throw new BadRequestException('El código no coincide')
    }
    await prisma.adminUsuario.update({ where: { id: admin.id }, data: { totpActivo: true } })
    await this.auditar(admin.id, 'ADMIN_2FA_ACTIVADO', null, {}, ip)
    return this.sesion(admin, ip)
  }

  async verificarCodigoLogin(admin: AdminUsuario, codigo: string, ip?: string) {
    await this.verificarCodigo(admin, codigo, (m) => new UnauthorizedException(m))
    return this.sesion(admin, ip)
  }

  /** Código reciente para datos sensibles (5 min). */
  async confirmar(ctx: Contexto, codigo: string) {
    await this.verificarCodigo(ctx.admin, codigo, (m) => new ForbiddenException(m))
    const token = this.jwt.sign({ sub: ctx.admin.id, type: 'admin-confirmado' } satisfies PayloadAdmin, { expiresIn: '5m' })
    return { token, minutos: 5 }
  }

  exigirConfirmacion(ctx: Contexto, token: string | undefined): void {
    try {
      const p = this.jwt.verify<PayloadAdmin>(token ?? '')
      if (p.type === 'admin-confirmado' && p.sub === ctx.admin.id) return
    } catch {
      // 403 abajo
    }
    throw new ForbiddenException({ statusCode: 403, codigo: 'REQUIERE_2FA', message: 'Confirma con tu código de Google Authenticator' })
  }

  // ── Clientes ───────────────────────────────────────────────────────────────

  async listarClientes(buscar?: string, pagina = 1, filtro?: 'conErrores' | 'sinCertificado' | 'registroIncompleto') {
    const and: Prisma.TenantWhereInput[] = []
    if (buscar?.trim()) {
      const q = buscar.trim()
      and.push({
        OR: [
          { rnc: { contains: q } },
          { razonSocial: { contains: q, mode: 'insensitive' } },
          { nombreComercial: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { cuentaRegistro: { email: { contains: q, mode: 'insensitive' } } },
        ],
      })
    }
    if (filtro === 'conErrores') and.push({ comprobantes: { some: { estado: { in: ['ERROR', 'RECHAZADO'] } } } })
    if (filtro === 'sinCertificado') and.push({ certificados: { none: { activo: true } } })
    if (filtro === 'registroIncompleto') and.push({ cuentaRegistro: { completadoEn: null } })
    const where: Prisma.TenantWhereInput = and.length ? { AND: and } : {}

    const [total, tenants] = await Promise.all([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        include: {
          cuentaRegistro: { select: { email: true, totpActivo: true, completadoEn: true } },
          certificados: { where: { activo: true }, select: { validoHasta: true }, take: 1 },
          credencialOfv: { select: { tenantId: true } },
          ghlLocations: { select: { locationId: true } },
        },
      }),
    ])
    const conteos = await prisma.comprobante.groupBy({
      by: ['tenantId', 'estado'],
      where: { tenantId: { in: tenants.map((t) => t.id) }, estado: { in: ['ERROR', 'RECHAZADO'] } },
      _count: { _all: true },
    })
    const cuenta = (tenantId: string, estado: string) =>
      conteos.find((c) => c.tenantId === tenantId && c.estado === estado)?._count._all ?? 0

    return {
      total,
      pagina,
      porPagina: POR_PAGINA,
      clientes: tenants.map((t) => ({
        id: t.id,
        rnc: t.rnc,
        razonSocial: t.razonSocial,
        nombreComercial: t.nombreComercial,
        estado: t.estado,
        plan: t.plan,
        ambienteDgii: t.ambienteDgii,
        creado: t.createdAt,
        registro: t.cuentaRegistro
          ? { email: t.cuentaRegistro.email, dosPasos: t.cuentaRegistro.totpActivo, completo: Boolean(t.cuentaRegistro.completadoEn) }
          : null,
        certificadoVence: t.certificados[0]?.validoHasta ?? null,
        ofv: Boolean(t.credencialOfv),
        crm: t.ghlLocations.length > 0,
        errores: cuenta(t.id, 'ERROR'),
        rechazados: cuenta(t.id, 'RECHAZADO'),
      })),
    }
  }

  async detalleCliente(tenantId: string) {
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        perfilFiscal: true,
        representante: true,
        cuentaRegistro: { select: { email: true, totpActivo: true, completadoEn: true, bloqueadoHasta: true, createdAt: true } },
        credencialOfv: { select: { updatedAt: true } },
        certificados: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, titular: true, rnc: true, emitidoPor: true, validoDesde: true, validoHasta: true, activo: true, createdAt: true },
        },
        secuencias: { orderBy: { tipoECF: 'asc' }, select: { tipoECF: true, ultimaSecuencia: true, fechaVencimiento: true, activo: true } },
        ghlLocations: { select: { locationId: true, createdAt: true } },
        users: { select: { email: true, nombre: true, role: true, activo: true } },
      },
    })
    if (!t) throw new NotFoundException('Cliente no encontrado')
    const [problemas, conteo, auditoria] = await Promise.all([
      prisma.comprobante.findMany({
        where: { tenantId, estado: { in: ['ERROR', 'RECHAZADO'] } },
        orderBy: { updatedAt: 'desc' },
        take: 25,
        select: { id: true, eNCF: true, tipoECF: true, estado: true, mensajeDGII: true, intentos: true, updatedAt: true },
      }),
      prisma.comprobante.groupBy({ by: ['estado'], where: { tenantId }, _count: { _all: true } }),
      prisma.adminAuditoria.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { admin: { select: { nombre: true, email: true } } },
      }),
    ])
    const { ghlAccessToken: _token, ...tenant } = t
    return {
      ...tenant,
      ghlConectado: Boolean(_token),
      comprobantesPorEstado: Object.fromEntries(conteo.map((c) => [c.estado, c._count._all])),
      comprobantesConProblemas: problemas,
      auditoria,
    }
  }

  async actualizarCliente(ctx: Contexto, tenantId: string, cambios: { estado?: TenantEstado; ambienteDgii?: AmbienteDgii | null }) {
    const antes = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { estado: true, ambienteDgii: true } })
    if (!antes) throw new NotFoundException('Cliente no encontrado')
    const data: Prisma.TenantUpdateInput = {}
    if (cambios.estado !== undefined) data.estado = cambios.estado
    if (cambios.ambienteDgii !== undefined) data.ambienteDgii = cambios.ambienteDgii
    const t = await prisma.tenant.update({ where: { id: tenantId }, data, select: { id: true, estado: true, ambienteDgii: true } })
    await this.auditar(ctx.admin.id, 'CLIENTE_ACTUALIZADO', tenantId, { antes, despues: t }, ctx.ip)
    return t
  }

  /** El cliente vuelve a configurar su Google Authenticator (perdió el teléfono, etc.). */
  async reiniciarDosPasosCliente(ctx: Contexto, tenantId: string) {
    const cuenta = await prisma.cuentaRegistro.findUnique({ where: { tenantId } })
    if (!cuenta) throw new NotFoundException('El cliente no tiene cuenta con verificación en dos pasos')
    await prisma.cuentaRegistro.update({
      where: { id: cuenta.id },
      data: { totpActivo: false, totpSecretCifrado: null, intentosFallidos: 0, bloqueadoHasta: null },
    })
    await this.auditar(ctx.admin.id, 'CLIENTE_2FA_REINICIADO', tenantId, { email: cuenta.email }, ctx.ip)
    return { reiniciado: true }
  }

  /** Reintenta un comprobante en ERROR (falla técnica): mismo e-NCF, igual que los reintentos automáticos. */
  async reintentarComprobante(ctx: Contexto, comprobanteId: string) {
    const c = await prisma.comprobante.findUnique({ where: { id: comprobanteId } })
    if (!c) throw new NotFoundException('Comprobante no encontrado')
    if (c.estado !== 'ERROR') {
      throw new BadRequestException(
        c.estado === 'RECHAZADO'
          ? 'Un comprobante RECHAZADO por la DGII no se reintenta: hay que emitir uno nuevo'
          : `Sólo se reintentan comprobantes en ERROR (está en ${c.estado})`,
      )
    }
    if (!c.eNCF) throw new BadRequestException('El comprobante no tiene e-NCF asignado')
    await prisma.comprobante.update({ where: { id: c.id }, data: { estado: 'PENDIENTE', mensajeDGII: null } })
    await this.ecfQueue.add('emit', { comprobanteId: c.id, tenantId: c.tenantId })
    await this.auditar(ctx.admin.id, 'COMPROBANTE_REINTENTADO', c.tenantId, { comprobanteId: c.id, eNCF: c.eNCF }, ctx.ip)
    return { encolado: true, eNCF: c.eNCF }
  }

  // ── Datos sensibles (código 2FA reciente + auditoría) ──────────────────────

  async sensibles(ctx: Contexto, tenantId: string) {
    await this.existeCliente(tenantId)
    const ofv = await prisma.credencialOfv.findUnique({ where: { tenantId } })
    let claveP12: string | null = null
    try {
      claveP12 = (await this.certificados.getCertificadoParaFirmar(tenantId)).passphrase
    } catch {
      claveP12 = null
    }
    await this.auditar(ctx.admin.id, 'DATOS_SENSIBLES_CONSULTADOS', tenantId, { ofv: Boolean(ofv), certificado: claveP12 !== null }, ctx.ip)
    return {
      ofv: ofv ? { usuario: this.crypto.decryptString(ofv.usuarioCifrado), clave: this.crypto.decryptString(ofv.claveCifrada) } : null,
      claveCertificado: claveP12,
    }
  }

  async descargarCertificado(ctx: Contexto, tenantId: string): Promise<{ archivo: Buffer; nombre: string }> {
    const t = await this.existeCliente(tenantId)
    let p12: Buffer
    try {
      p12 = (await this.certificados.getCertificadoParaFirmar(tenantId)).p12Buffer
    } catch {
      throw new NotFoundException('El cliente no tiene un certificado activo')
    }
    await this.auditar(ctx.admin.id, 'CERTIFICADO_DESCARGADO', tenantId, { rnc: t.rnc }, ctx.ip)
    return { archivo: p12, nombre: `${t.rnc}.p12` }
  }

  // ── Usuarios del panel ─────────────────────────────────────────────────────

  async listarAdmins() {
    return prisma.adminUsuario.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, nombre: true, rol: true, activo: true, totpActivo: true, ultimoAcceso: true, createdAt: true },
    })
  }

  async crearAdmin(ctx: Contexto, datos: { email: string; nombre: string; rol: RolAdmin; password: string }) {
    const email = datos.email.trim().toLowerCase()
    if (await prisma.adminUsuario.findUnique({ where: { email } })) throw new ConflictException('Ya existe un usuario del panel con ese correo')
    const nuevo = await prisma.adminUsuario.create({
      data: { email, nombre: datos.nombre.trim(), rol: datos.rol, passwordHash: await bcrypt.hash(datos.password, 12) },
      select: { id: true, email: true, nombre: true, rol: true, activo: true, totpActivo: true },
    })
    await this.auditar(ctx.admin.id, 'ADMIN_CREADO', null, { email, rol: datos.rol }, ctx.ip)
    return nuevo
  }

  async actualizarAdmin(ctx: Contexto, id: string, cambios: { activo?: boolean; rol?: RolAdmin }) {
    if (id === ctx.admin.id) throw new BadRequestException('No puedes cambiar tu propio acceso')
    const actualizado = await prisma.adminUsuario.update({
      where: { id },
      data: { ...(cambios.activo !== undefined ? { activo: cambios.activo } : {}), ...(cambios.rol ? { rol: cambios.rol } : {}) },
      select: { id: true, email: true, nombre: true, rol: true, activo: true, totpActivo: true },
    })
    await this.auditar(ctx.admin.id, 'ADMIN_ACTUALIZADO', null, { id, ...cambios }, ctx.ip)
    return actualizado
  }

  async auditoria(tenantId?: string, limite = 50) {
    return prisma.adminAuditoria.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
      take: limite,
      include: { admin: { select: { nombre: true, email: true } } },
    })
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async sesion(admin: AdminUsuario, ip?: string) {
    await prisma.adminUsuario.update({ where: { id: admin.id }, data: { ultimoAcceso: new Date(), intentosFallidos: 0, bloqueadoHasta: null } })
    await this.auditar(admin.id, 'ADMIN_LOGIN', null, {}, ip)
    const token = this.jwt.sign({ sub: admin.id, type: 'admin' } satisfies PayloadAdmin, { expiresIn: '8h' })
    return { token, admin: { id: admin.id, email: admin.email, nombre: admin.nombre, rol: admin.rol } }
  }

  private async verificarCodigo(admin: AdminUsuario, codigo: string, error: (m: string) => Error): Promise<void> {
    if (!admin.totpActivo || !admin.totpSecretCifrado) throw error('La verificación en dos pasos no está activa')
    if (admin.bloqueadoHasta && admin.bloqueadoHasta > new Date()) throw error(`Demasiados intentos. Espera ${BLOQUEO_MINUTOS} minutos.`)
    if (!verificarTotp(this.crypto.decryptString(admin.totpSecretCifrado), codigo)) {
      await this.registrarFallo(admin)
      throw error('Código incorrecto')
    }
  }

  private async registrarFallo(admin: AdminUsuario): Promise<void> {
    const intentos = admin.intentosFallidos + 1
    await prisma.adminUsuario.update({
      where: { id: admin.id },
      data: intentos >= MAX_INTENTOS
        ? { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MINUTOS * 60_000) }
        : { intentosFallidos: intentos },
    })
  }

  private async existeCliente(tenantId: string) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, rnc: true } })
    if (!t) throw new NotFoundException('Cliente no encontrado')
    return t
  }

  private async auditar(adminId: string | null, accion: string, tenantId: string | null, detalle: object, ip?: string): Promise<void> {
    await prisma.adminAuditoria
      .create({
        data: {
          adminId,
          accion,
          tenantId,
          detalle: JSON.parse(JSON.stringify(detalle)) as Prisma.InputJsonValue,
          ip: ip ?? null,
        },
      })
      .catch((e) => this.logger.warn(`[Admin] Auditoría no registrada: ${String(e)}`))
  }
}
