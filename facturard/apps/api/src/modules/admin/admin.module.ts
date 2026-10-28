import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { CryptoService } from '../../common/services/crypto.service'
import { CertificadosModule } from '../certificados/certificados.module'
import { AdminService } from './admin.service'
import { AdminGuard, AdminPasoGuard } from './admin-auth.guard'
import { AdminAuthController, AdminController } from './admin.controller'

/**
 * Panel de administración DMAIA. Usuarios propios (AdminUsuario), sin tenant ni GHL;
 * secreto JWT propio: un token del panel nunca sirve en la app de clientes ni al revés.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: `${config.getOrThrow<string>('jwt.secret')}:admin`,
        signOptions: { issuer: 'facturard-admin' },
      }),
    }),
    // Misma cola de emisión que comprobantes (para reintentar envíos en ERROR).
    BullModule.registerQueue({
      name: 'ecf-emission',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }),
    CertificadosModule,
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminService, AdminGuard, AdminPasoGuard, CryptoService],
})
export class AdminModule {}
