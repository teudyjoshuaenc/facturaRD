import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { ReceptorService, REDIS_CLIENT } from './receptor.service'
import { ReceptorAuthController } from './receptor-auth.controller'
import { ReceptorEcfController } from './receptor-ecf.controller'
import { ReceptorJwtGuard } from './receptor-jwt.guard'
import { CertificadosModule } from '../certificados/certificados.module'

/**
 * ReceptorModule
 *
 * Implementa el Paso 7 del proceso de certificación DGII:
 * expone los endpoints de receptor de e-CF bajo /fe/* (fuera del prefijo api/v1).
 *
 * Endpoints registrados en el portal DGII:
 *   GET  /fe/autenticacion/api/semilla
 *   POST /fe/autenticacion/api/validacioncertificado
 *   POST /fe/recepcion/api/ecf
 *   POST /fe/aprobacioncomercial/api/ecf
 */
@Module({
  imports: [
    ConfigModule,
    CertificadosModule,
    // JWT independiente para las sesiones de receptor
    // Usa JWT_SECRET con sufijo ':receptor-ecf' para diferenciarlo del auth normal
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET') + ':receptor-ecf',
        signOptions: {
          expiresIn: '1h',
          issuer: 'facturard-receptor-ecf',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ReceptorAuthController, ReceptorEcfController],
  providers: [
    ReceptorService,
    ReceptorJwtGuard,
    // Provider de Redis para almacenar semillas con TTL
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService): Redis => {
        return new Redis({
          host: config.get<string>('redis.host') ?? 'localhost',
          port: config.get<number>('redis.port') ?? 6379,
          password: config.get<string>('redis.password'),
          tls: config.get<boolean>('redis.tls') ? {} : undefined,
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
          commandTimeout: 3000,
        })
      },
      inject: [ConfigService],
    },
  ],
})
export class ReceptorModule {}
