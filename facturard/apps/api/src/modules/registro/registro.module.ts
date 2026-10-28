import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { CryptoService } from '../../common/services/crypto.service'
import { AuthModule } from '../auth/auth.module'
import { TenantsModule } from '../tenants/tenants.module'
import { SecuenciasModule } from '../secuencias/secuencias.module'
import { CertificadosModule } from '../certificados/certificados.module'
import { RegistroService } from './registro.service'
import { RegistroJwtGuard } from './registro-jwt.guard'
import { CatalogosController, RegistroController, SeguridadController } from './registro.controller'

@Module({
  imports: [
    // Secreto propio: un token de registro nunca sirve como token de empresa (y viceversa).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: `${config.getOrThrow<string>('jwt.secret')}:registro`,
        signOptions: { expiresIn: '2h', issuer: 'facturard-registro' },
      }),
    }),
    AuthModule,
    TenantsModule,
    SecuenciasModule,
    CertificadosModule,
  ],
  controllers: [RegistroController, CatalogosController, SeguridadController],
  providers: [RegistroService, RegistroJwtGuard, CryptoService],
  exports: [RegistroService],
})
export class RegistroModule {}
