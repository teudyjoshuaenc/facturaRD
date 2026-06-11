import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TenantsModule } from '../tenants/tenants.module'
import { SecuenciasModule } from '../secuencias/secuencias.module'
import { GhlAuthController } from './ghl-auth.controller'
import { GhlAuthService } from './ghl-auth.service'

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: { expiresIn: config.getOrThrow<string>('jwt.accessExpiresIn') },
      }),
    }),
    TenantsModule,
    SecuenciasModule,
  ],
  controllers: [GhlAuthController],
  providers: [GhlAuthService],
})
export class GhlAuthModule {}
