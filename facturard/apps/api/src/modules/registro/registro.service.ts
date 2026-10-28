import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import * as QRCode from 'qrcode'
import { prisma, UserRole } from '@facturard/database'
import type { CuentaRegistro } from '@facturard/database'
import { CryptoService } from '../../common/services/crypto.service'
import { generarSecretoTotp, urlOtpauth, verificarTotp } from '../../common/services/totp'
import { firmadorConfirmacion, MINUTOS_CONFIRMACION_2FA } from '../../common/guards/requiere-2fa.guard'
import { DgiiContribuyentesService } from '../tenants/dgii-contribuyentes.service'
import { SecuenciasService } from '../secuencias/secuencias.service'
import { CertificadosService } from '../certificados/certificados.service'
import { AuthService, type AuthTokens } from '../auth/auth.service'
import { municipioValido } from './geo-dgii'
import type { ContribuyenteDto, DatosRegistroDto, OfvDto, RepresentanteDto } from './dto/registro.dto'

const MAX_INTENTOS = 5
const BLOQUEO_MINUTOS = 15

const normalizarEmail = (e: string): string => e.trim().toLowerCase()

export interface EstadoRegistro {
  email: string
  dosPasosActivo: boolean
  datosCompletos: boolean
  certificadoCargado: boolean
  ofvCargada: boolean
  completo: boolean
  tenant: { id: string; rnc: string; razonSocial: string } | null
}

export interface SesionTenant extends AuthTokens {
  tenant: { id: string; rnc: string; razonSocial: string; plan: string }
}

/**
 * Registro directo en FacturaRD (Fase 1): correo → 2FA → datos del contribuyente
 * y representante → certificado → acceso OFV → completar.
 * FacturaRD no maneja contraseñas ni correos de confirmación: la llave de la
 * cuenta es el código de Google Authenticator, y la contraseña del CRM la
 * configura GoHighLevel con su propio correo al crear el usuario (Fase 4).
 */
@Injectable()
export class RegistroService {
  private readonly logger = new Logger(RegistroService.name)

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly dgii: DgiiContribuyentesService,
    private readonly secuencias: SecuenciasService,
    private readonly certificados: CertificadosService,
    private readonly auth: AuthService,
  ) {}

  // ── Entrada: correo, y después correo + código 2FA ─────────────────────────

  /**
   * Abre (o retoma) el registro con sólo el correo. Mientras no tenga 2FA activo
   * se puede retomar con el correo; una vez activo, sólo con el código.
   */
  async iniciar(emailCrudo: string): Promise<{ tokenRegistro: string }> {
    const email = normalizarEmail(emailCrudo)
    const existente = await prisma.cuentaRegistro.findUnique({ where: { email } })
    if (existente?.totpActivo) {
      throw new ConflictException('Ya existe una cuenta con ese correo. Entra con tu código de Google Authenticator.')
    }
    const cuenta = existente ?? (await prisma.cuentaRegistro.create({ data: { email } }))
    return { tokenRegistro: this.firmarRegistro(cuenta.id) }
  }

  /**
   * Entrar con código de Google Authenticator. Desde el CRM se identifica la
   * cuenta por la subcuenta (location) y sólo se pide el código; fuera del CRM,
   * por correo. Bloqueo de 15 min tras 5 códigos incorrectos.
   */
  async login(
    quien: { email?: string | undefined; locationId?: string | undefined },
    codigo: string,
  ): Promise<{ tokenRegistro: string; sesion: SesionTenant | null }> {
    let cuenta: CuentaRegistro | null = null
    if (quien.locationId) {
      const loc = await prisma.ghlLocation.findUnique({
        where: { locationId: quien.locationId },
        include: { tenant: { include: { cuentaRegistro: true } } },
      })
      cuenta = loc?.tenant.cuentaRegistro ?? null
    } else if (quien.email) {
      cuenta = await prisma.cuentaRegistro.findUnique({ where: { email: normalizarEmail(quien.email) } })
    }
    if (!cuenta) throw new UnauthorizedException('Correo o código incorrectos')
    await this.verificarCodigo(cuenta, codigo, 'Correo o código incorrectos')
    const sesion = cuenta.completadoEn && cuenta.tenantId ? await this.sesionTenant(cuenta) : null
    return { tokenRegistro: this.firmarRegistro(cuenta.id), sesion }
  }

  // ── 2FA desde la sesión de la empresa (secciones Empresa y Configuración) ──

  async estadoDosPasosTenant(tenantId: string): Promise<{ activo: boolean; email: string | null }> {
    const cuenta = await prisma.cuentaRegistro.findUnique({ where: { tenantId } })
    return { activo: Boolean(cuenta?.totpActivo), email: cuenta?.email ?? null }
  }

  /**
   * Empresas creadas antes del registro directo no tienen cuenta: se crea aquí
   * (ya completa) con el correo que indiquen, y se genera su QR.
   */
  async configurarDosPasosTenant(tenantId: string, emailCrudo: string | undefined) {
    let cuenta = await prisma.cuentaRegistro.findUnique({ where: { tenantId } })
    if (!cuenta) {
      if (!emailCrudo) throw new BadRequestException('Indica el correo de la cuenta')
      const email = normalizarEmail(emailCrudo)
      if (await prisma.cuentaRegistro.findUnique({ where: { email } })) {
        throw new ConflictException('Ese correo ya está en uso por otra cuenta')
      }
      // Las empresas del onboarding por GHL no tienen User: se crea el ADMIN con ese
      // correo para poder abrirle sesión al entrar con el código.
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12)
      cuenta = await prisma.$transaction(async (tx) => {
        const existente = await tx.user.findFirst({ where: { tenantId, email } })
        if (!existente) {
          await tx.user.create({ data: { tenantId, email, nombre: email, passwordHash, role: UserRole.ADMIN } })
        }
        return tx.cuentaRegistro.create({ data: { email, tenantId, completadoEn: new Date() } })
      })
    }
    return this.configurarDosPasos(cuenta.id)
  }

  async activarDosPasosTenant(tenantId: string, codigo: string): Promise<void> {
    const cuenta = await prisma.cuentaRegistro.findUnique({ where: { tenantId } })
    if (!cuenta) throw new BadRequestException('Primero genera el código QR')
    await this.activarDosPasos(cuenta.id, codigo)
    await this.auditar(tenantId, 'DOS_PASOS_ACTIVADO')
  }

  /** Confirma el código y devuelve el token corto que piden las operaciones sensibles. */
  async confirmarTenant(tenantId: string, codigo: string): Promise<{ token: string; minutos: number }> {
    const cuenta = await prisma.cuentaRegistro.findUnique({ where: { tenantId } })
    if (!cuenta?.totpActivo) throw new ForbiddenException('Activa primero la verificación en dos pasos')
    // 403 (no 401): la sesión sigue siendo válida, sólo el código es incorrecto.
    await this.verificarCodigo(cuenta, codigo, 'Código de verificación incorrecto', true)
    const token = firmadorConfirmacion(this.config).sign({ tenantId, type: 'confirmacion-2fa' })
    return { token, minutos: MINUTOS_CONFIRMACION_2FA }
  }

  // ── Verificación en dos pasos (Google Authenticator) ───────────────────────

  async configurarDosPasos(cuentaId: string): Promise<{ otpauthUrl: string; qrDataUrl: string; secreto: string }> {
    const cuenta = await this.cuenta(cuentaId)
    if (cuenta.totpActivo) {
      throw new ConflictException('La verificación en dos pasos ya está activa')
    }
    // Mientras no se active se reutiliza el mismo secreto: recargar la página no
    // invalida el QR que la persona ya escaneó.
    const secreto = cuenta.totpSecretCifrado
      ? this.crypto.decryptString(cuenta.totpSecretCifrado)
      : generarSecretoTotp()
    if (!cuenta.totpSecretCifrado) {
      await prisma.cuentaRegistro.update({
        where: { id: cuenta.id },
        data: { totpSecretCifrado: this.crypto.encryptString(secreto) },
      })
    }
    const otpauthUrl = urlOtpauth(secreto, cuenta.email)
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 })
    return { otpauthUrl, qrDataUrl, secreto }
  }

  async activarDosPasos(cuentaId: string, codigo: string): Promise<void> {
    const cuenta = await this.cuenta(cuentaId)
    if (cuenta.totpActivo) return
    if (!cuenta.totpSecretCifrado) throw new BadRequestException('Primero genera el código QR')
    if (!verificarTotp(this.crypto.decryptString(cuenta.totpSecretCifrado), codigo)) {
      throw new BadRequestException('El código no coincide. Revisa la hora de tu teléfono e intenta de nuevo.')
    }
    await prisma.cuentaRegistro.update({ where: { id: cuenta.id }, data: { totpActivo: true } })
  }

  // ── Estado y datos ─────────────────────────────────────────────────────────

  async estado(cuentaId: string): Promise<EstadoRegistro> {
    const cuenta = await this.cuenta(cuentaId)
    const t = cuenta.tenantId
      ? await prisma.tenant.findUnique({
          where: { id: cuenta.tenantId },
          select: {
            id: true,
            rnc: true,
            razonSocial: true,
            perfilFiscal: { select: { tenantId: true } },
            representante: { select: { tenantId: true } },
            credencialOfv: { select: { tenantId: true } },
            certificados: { where: { activo: true }, select: { id: true }, take: 1 },
          },
        })
      : null
    return {
      email: cuenta.email,
      dosPasosActivo: cuenta.totpActivo,
      datosCompletos: Boolean(t?.perfilFiscal && t?.representante),
      certificadoCargado: Boolean(t?.certificados.length),
      ofvCargada: Boolean(t?.credencialOfv),
      completo: Boolean(cuenta.completadoEn),
      tenant: t ? { id: t.id, rnc: t.rnc, razonSocial: t.razonSocial } : null,
    }
  }

  async obtenerDatos(cuentaId: string): Promise<{
    contribuyente: Record<string, unknown> | null
    representante: Record<string, unknown> | null
  }> {
    const cuenta = await this.cuenta(cuentaId)
    if (!cuenta.tenantId) return { contribuyente: null, representante: null }
    const t = await prisma.tenant.findUniqueOrThrow({
      where: { id: cuenta.tenantId },
      include: { perfilFiscal: true, representante: true },
    })
    const { tenantId: _a, createdAt: _b, updatedAt: _c, ...perfil } = t.perfilFiscal ?? ({} as never)
    const { tenantId: _d, createdAt: _e, updatedAt: _f, ...rep } = t.representante ?? ({} as never)
    return {
      contribuyente: {
        rnc: t.rnc,
        tipoIdentificacion: t.rnc.length === 11 ? 'CEDULA' : 'RNC',
        razonSocial: t.razonSocial,
        nombreComercial: t.nombreComercial,
        direccion: t.direccion,
        telefono: t.telefono,
        email: t.email,
        ...perfil,
      },
      representante: t.representante ? rep : null,
    }
  }

  /**
   * Guarda contribuyente + representante. La primera vez crea el Tenant con su
   * usuario ADMIN (mismo correo y contraseña de la cuenta) y las secuencias base,
   * todo en una transacción. Exige la verificación en dos pasos activa: aquí
   * empieza la información sensible.
   */
  async guardarDatos(cuentaId: string, dto: DatosRegistroDto): Promise<EstadoRegistro> {
    const cuenta = await this.cuenta(cuentaId)
    if (!cuenta.totpActivo) {
      throw new ForbiddenException('Activa primero la verificación en dos pasos')
    }
    const c = dto.contribuyente
    const r = dto.representante
    this.validarUbicacion('del contribuyente', c)
    this.validarUbicacion('del representante', r)

    const identidad = await this.resolverIdentidad(c)
    const perfil = {
      // Los clientes de FacturaRD siempre se certifican como emisor electrónico.
      tipoRegistro: 'EMISOR_ELECTRONICO',
      tiposComprobante: c.tiposComprobante,
      actividadEconomica: c.actividadEconomica.trim(),
      provincia: c.provincia,
      municipio: c.municipio,
      sector: c.sector.trim(),
    }
    const representante = this.datosRepresentante(r)
    const datosTenant = {
      razonSocial: identidad.razonSocial,
      nombreComercial: c.nombreComercial?.trim() || identidad.nombreComercial || null,
      direccion: c.direccion.trim(),
      telefono: c.telefono.trim(),
      email: normalizarEmail(c.email),
    }

    if (cuenta.tenantId) {
      const actual = await prisma.tenant.findUniqueOrThrow({ where: { id: cuenta.tenantId } })
      if (actual.rnc !== c.rnc) {
        throw new ConflictException('El RNC de la empresa no se puede cambiar después de creada')
      }
      await prisma.$transaction([
        prisma.tenant.update({ where: { id: actual.id }, data: datosTenant }),
        prisma.perfilFiscal.upsert({
          where: { tenantId: actual.id },
          create: { tenantId: actual.id, ...perfil },
          update: perfil,
        }),
        prisma.representante.upsert({
          where: { tenantId: actual.id },
          create: { tenantId: actual.id, ...representante },
          update: representante,
        }),
        prisma.user.updateMany({
          where: { tenantId: actual.id, email: cuenta.email },
          data: { nombre: representante.nombreCompleto },
        }),
      ])
      return this.estado(cuentaId)
    }

    if (await prisma.tenant.findUnique({ where: { rnc: c.rnc }, select: { id: true } })) {
      throw new ConflictException(
        'Este RNC ya tiene una cuenta en FacturaRD. Escríbenos a soporte@dmaia.io para vincularla.',
      )
    }
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { rnc: c.rnc, ...datosTenant } })
      await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: cuenta.email,
          nombre: representante.nombreCompleto,
          // Sin contraseña utilizable: se entra con correo + 2FA o desde el CRM.
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
          role: UserRole.ADMIN,
        },
      })
      await this.secuencias.inicializarTodosLosTiposTx(tx, tenant.id)
      await tx.perfilFiscal.create({ data: { tenantId: tenant.id, ...perfil } })
      await tx.representante.create({ data: { tenantId: tenant.id, ...representante } })
      await tx.cuentaRegistro.update({ where: { id: cuenta.id }, data: { tenantId: tenant.id } })
    })
    this.logger.log(`[Registro] Tenant creado para RNC ${c.rnc} desde la cuenta ${cuenta.email}`)
    return this.estado(cuentaId)
  }

  // ── Certificado y OFV ──────────────────────────────────────────────────────

  async subirCertificado(cuentaId: string, file: Buffer | undefined, passphrase: string | undefined) {
    const tenantId = await this.tenantDe(cuentaId)
    if (!file || !passphrase) throw new BadRequestException('Envía el archivo .p12 y su contraseña')
    return this.certificados.upload(tenantId, file, passphrase)
  }

  async guardarOfv(cuentaId: string, dto: OfvDto): Promise<void> {
    const cuenta = await this.cuentaConCodigo(cuentaId, dto.codigo)
    const tenantId = await this.tenantDe(cuenta.id)
    const data = {
      usuarioCifrado: this.crypto.encryptString(dto.usuario.trim()),
      claveCifrada: this.crypto.encryptString(dto.clave),
    }
    await prisma.credencialOfv.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data })
    await this.auditar(tenantId, 'OFV_GUARDADA')
  }

  /** Datos sensibles: sólo con un código 2FA válido, y queda en auditoría. */
  async verSensibles(cuentaId: string, codigo: string): Promise<{ ofv: { usuario: string; clave: string } | null }> {
    const cuenta = await this.cuentaConCodigo(cuentaId, codigo)
    const tenantId = await this.tenantDe(cuenta.id)
    const ofv = await prisma.credencialOfv.findUnique({ where: { tenantId } })
    await this.auditar(tenantId, 'OFV_CONSULTADA')
    return {
      ofv: ofv
        ? { usuario: this.crypto.decryptString(ofv.usuarioCifrado), clave: this.crypto.decryptString(ofv.claveCifrada) }
        : null,
    }
  }

  /** Cierra el registro y entrega la sesión normal de FacturaRD. */
  async completar(cuentaId: string): Promise<SesionTenant> {
    const e = await this.estado(cuentaId)
    const faltan = [
      !e.dosPasosActivo && 'la verificación en dos pasos',
      !e.datosCompletos && 'los datos del contribuyente y del representante',
      !e.certificadoCargado && 'el certificado digital (.p12)',
      !e.ofvCargada && 'el acceso a la Oficina Virtual',
    ].filter(Boolean)
    if (faltan.length) throw new BadRequestException(`Falta completar: ${faltan.join(', ')}`)

    const cuenta = await prisma.cuentaRegistro.update({
      where: { id: cuentaId },
      data: { completadoEn: new Date() },
    })
    await this.auditar(cuenta.tenantId!, 'REGISTRO_COMPLETADO')
    // Fase 4: aquí se crea la subcuenta y el usuario en DMAIA CRM.
    return this.sesionTenant(cuenta)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private firmarRegistro(cuentaId: string): string {
    return this.jwt.sign({ sub: cuentaId, type: 'registro' })
  }

  private async cuenta(cuentaId: string): Promise<CuentaRegistro> {
    const cuenta = await prisma.cuentaRegistro.findUnique({ where: { id: cuentaId } })
    if (!cuenta) throw new UnauthorizedException('Sesión de registro inválida')
    return cuenta
  }

  private async cuentaConCodigo(cuentaId: string, codigo: string): Promise<CuentaRegistro> {
    const cuenta = await this.cuenta(cuentaId)
    if (!cuenta.totpActivo || !cuenta.totpSecretCifrado) {
      throw new ForbiddenException('Activa primero la verificación en dos pasos')
    }
    await this.verificarCodigo(cuenta, codigo, 'Código de verificación incorrecto', true)
    return cuenta
  }

  /** Verifica un código TOTP con bloqueo de 15 min tras 5 fallos seguidos. */
  private async verificarCodigo(cuenta: CuentaRegistro, codigo: string, mensaje: string, prohibido = false): Promise<void> {
    const error = (m: string) => (prohibido ? new ForbiddenException(m) : new UnauthorizedException(m))
    if (!cuenta.totpActivo || !cuenta.totpSecretCifrado) throw error(mensaje)
    if (cuenta.bloqueadoHasta && cuenta.bloqueadoHasta > new Date()) {
      throw error(`Demasiados intentos. Intenta de nuevo en ${BLOQUEO_MINUTOS} minutos.`)
    }
    if (!verificarTotp(this.crypto.decryptString(cuenta.totpSecretCifrado), codigo)) {
      const intentos = cuenta.intentosFallidos + 1
      await prisma.cuentaRegistro.update({
        where: { id: cuenta.id },
        data: intentos >= MAX_INTENTOS
          ? { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MINUTOS * 60_000) }
          : { intentosFallidos: intentos },
      })
      throw error(mensaje)
    }
    if (cuenta.intentosFallidos || cuenta.bloqueadoHasta) {
      await prisma.cuentaRegistro.update({ where: { id: cuenta.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } })
    }
  }

  private async tenantDe(cuentaId: string): Promise<string> {
    const cuenta = await this.cuenta(cuentaId)
    if (!cuenta.tenantId) throw new BadRequestException('Primero guarda los datos del contribuyente')
    return cuenta.tenantId
  }

  private async sesionTenant(cuenta: CuentaRegistro): Promise<SesionTenant> {
    const user = await prisma.user.findFirst({
      where: { tenantId: cuenta.tenantId!, email: cuenta.email, activo: true },
      include: { tenant: { select: { id: true, rnc: true, razonSocial: true, plan: true } } },
    })
    if (!user) throw new NotFoundException('No se encontró el usuario de la empresa')
    const tokens = await this.auth.emitirSesion(user)
    return { ...tokens, tenant: user.tenant }
  }

  private validarUbicacion(quien: string, u: { provincia: string; municipio: string }): void {
    if (!municipioValido(u.provincia, u.municipio)) {
      throw new BadRequestException(`La provincia y el municipio ${quien} no corresponden`)
    }
  }

  private datosRepresentante(r: RepresentanteDto) {
    return {
      identificacion: r.identificacion,
      pasaporte: r.pasaporte?.trim() || null,
      nombreCompleto: r.nombreCompleto.trim(),
      telefono: r.telefono.trim(),
      celular: r.celular?.trim() || null,
      email: normalizarEmail(r.email),
      direccion: r.direccion.trim(),
      provincia: r.provincia,
      municipio: r.municipio,
      sector: r.sector.trim(),
    }
  }

  /**
   * Razón social desde el padrón de la DGII (autoritativo). Una CÉDULA fuera del
   * padrón puede continuar con el nombre escrito a mano; un RNC siempre debe validar.
   */
  private async resolverIdentidad(c: ContribuyenteDto): Promise<{ razonSocial: string; nombreComercial?: string | undefined }> {
    try {
      const d = await this.dgii.buscarPorRNC(c.rnc)
      return { razonSocial: d.razonSocial, nombreComercial: d.nombreComercial }
    } catch (err) {
      const respaldo = c.tipoIdentificacion === 'CEDULA' && c.razonSocial?.trim()
      if (respaldo && (err instanceof NotFoundException || err instanceof ServiceUnavailableException)) {
        this.logger.warn(`[Registro] Cédula ${c.rnc} sin validar en el padrón; se usa el nombre escrito`)
        return { razonSocial: respaldo }
      }
      if (c.tipoIdentificacion === 'CEDULA' && err instanceof NotFoundException) {
        throw new BadRequestException('Esa cédula no figura en el padrón de la DGII: escribe tu nombre completo en "Razón social"')
      }
      throw err
    }
  }

  private async auditar(tenantId: string, accion: string): Promise<void> {
    await prisma.auditLog
      .create({ data: { tenantId, accion, entidad: 'registro', detalle: {} } })
      .catch((e) => this.logger.warn(`[Registro] Audit log error: ${String(e)}`))
  }
}
