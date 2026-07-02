import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { AuthModule } from './modules/auth/auth.module'
import { TenantsModule } from './modules/tenants/tenants.module'
import { UsersModule } from './modules/users/users.module'
import { ComprobantesModule } from './modules/comprobantes/comprobantes.module'
import { CertificadosModule } from './modules/certificados/certificados.module'
import { WebhooksModule } from './modules/webhooks/webhooks.module'
import { ApiKeysModule } from './modules/api-keys/api-keys.module'
import { HealthModule } from './modules/health/health.module'
import { SecuenciasModule } from './modules/secuencias/secuencias.module'
import { ReceptorModule } from './modules/receptor/receptor.module'
import { GhlAuthModule } from './modules/ghl-auth/ghl-auth.module'
import { ProductosModule } from './modules/productos/productos.module'
import { ContactosModule } from './modules/contactos/contactos.module'
import { CotizacionesModule } from './modules/cotizaciones/cotizaciones.module'
import { ComprasModule } from './modules/compras/compras.module'
import { ReportesModule } from './modules/reportes/reportes.module'
import { CumplimientoModule } from './modules/cumplimiento/cumplimiento.module'
import appConfig from './config/app.config'
import databaseConfig from './config/database.config'
import redisConfig from './config/redis.config'
import jwtConfig from './config/jwt.config'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('redis.host'),
          port: config.getOrThrow<number>('redis.port'),
          password: config.get<string>('redis.password'),
          tls: config.get<boolean>('redis.tls') ? {} : undefined,
          maxRetriesPerRequest: null,
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    TenantsModule,
    UsersModule,
    ComprobantesModule,
    CertificadosModule,
    WebhooksModule,
    ApiKeysModule,
    HealthModule,
    SecuenciasModule,
    ReceptorModule,  // Paso 7 certificación DGII — /fe/* sin prefijo api/v1
    GhlAuthModule,
    ProductosModule,
    ContactosModule,
    CotizacionesModule,
    ComprasModule,
    ReportesModule,
    CumplimientoModule,
  ],
})
export class AppModule {}
