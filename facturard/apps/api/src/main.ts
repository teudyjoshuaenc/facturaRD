import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { writeFileSync } from 'fs'
import type { Request, Response, NextFunction } from 'express'
import { AppModule } from './app.module'
import { RUTAS_RECEPTOR_SIN_PREFIJO } from './modules/receptor/receptor.rutas'

async function bootstrap(): Promise<void> {
  // rawBody: true — necesario para validar firmas HMAC del body crudo (webhooks GHL)
  const app = await NestFactory.create(AppModule, { rawBody: true })

  // ── Registro de peticiones al receptor DGII (/fe/*) ──────────────────────
  // Una línea por petición. NO se registran encabezados (llevan el token Bearer)
  // ni el cuerpo (lleva XML fiscal de terceros).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url.toLowerCase().startsWith('/fe/')) {
      console.log(
        `[Receptor DGII] ${req.method} ${req.url} | ip=${req.ip ?? req.socket.remoteAddress ?? '?'} ` +
          `| content-type=${req.headers['content-type'] ?? '-'} | length=${req.headers['content-length'] ?? '-'}`,
      )
    }
    next()
  })

  // ── Bypass ngrok browser-warning ─────────────────────────────────────────
  // ngrok activa su página HTML de advertencia cuando detecta un User-Agent
  // con "Mozilla/" en el string (browser-like). El servidor de la DGII usa
  // ese tipo de User-Agent y recibe HTML en lugar de XML → falla la auth.
  //
  // Este response header no previene el interstitial por sí solo.
  // LA SOLUCIÓN REAL es reiniciar ngrok con:
  //   ngrok http 3000 --request-header-add "ngrok-skip-browser-warning: 1"
  // Eso inyecta el header en TODOS los requests entrantes antes de que ngrok
  // decida si mostrar el interstitial.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('ngrok-skip-browser-warning', 'true')
    next()
  })

  // ── TAREA 4: Helmet — configuración permisiva para DGII ───────────────────
  // Por defecto helmet agrega Cross-Origin-Resource-Policy: same-origin, que
  // puede causar problemas con clientes que respetan este header.
  // También relajamos CSP para los endpoints /fe/* que usan XML puro.
  app.use(helmet({
    // Permitir que la DGII (cross-origin) lea los recursos de nuestro API
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Relajar COOP para no interferir con el flujo de autenticación DGII
    crossOriginOpenerPolicy: false,
    // CSP mínimo — nuestro API es puro JSON/XML, no sirve HTML con scripts
    contentSecurityPolicy: false,
  }))

  // ── CORS permisivo para DGII ──────────────────────────────────────────────
  // El servidor de la DGII necesita poder hacer requests desde su dominio.
  // Abrimos CORS a todos los orígenes (los endpoints /fe/* son públicos por
  // diseño del estándar técnico DGII). Los endpoints api/v1/* siguen
  // protegidos por JWT + API keys — CORS no es el control de acceso.
  app.enableCors({
    origin: true,           // Acepta cualquier Origin (incluye dgii.gov.do)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-2fa', // confirmación 2FA de las secciones Empresa / Configuración
      'x-2fa-admin', // confirmación 2FA del panel DMAIA para datos sensibles
      'ngrok-skip-browser-warning',
      'Accept',
    ],
  })

  // ── Logging global — captura TODOS los requests antes de que NestJS rutee ──
  app.use((req: any, res: any, next: any) => {
    console.log(`[ALL-REQUESTS] ${req.method} ${req.url} | host: ${req.headers.host} | ip: ${req.ip}`)
    next()
  })

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )

  // Excluir los endpoints del receptor DGII (Paso 7) del prefijo global.
  // Estos viven en /fe/* siguiendo el estándar técnico de la DGII.
  app.setGlobalPrefix('api/v1', { exclude: RUTAS_RECEPTOR_SIN_PREFIJO })

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('FacturaRD API')
    .setDescription('API de facturación electrónica para PYMEs dominicanas')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' })
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs', app, document)

  if (process.env['NODE_ENV'] !== 'production') {
    writeFileSync('./openapi.json', JSON.stringify(document, null, 2))
  }

  const port = process.env['PORT'] ?? 3000
  await app.listen(port)
  console.log(`FacturaRD API running on port ${port}`)
  console.log(`Swagger: http://localhost:${port}/docs`)
}

void bootstrap()
