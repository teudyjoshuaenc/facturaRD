import { Module, forwardRef } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ComprobantesController } from './comprobantes.controller'
import { ComprobantesService } from './comprobantes.service'
import { EcfEmissionProcessor } from './ecf-emission.processor'
import { CertificadosModule } from '../certificados/certificados.module'
import { SecuenciasModule } from '../secuencias/secuencias.module'
import { WebhooksModule } from '../webhooks/webhooks.module'

@Module({
  imports: [
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
    SecuenciasModule,
    // forwardRef resuelve la dependencia circular con WebhooksModule
    forwardRef(() => WebhooksModule),
  ],
  controllers: [ComprobantesController],
  providers: [ComprobantesService, EcfEmissionProcessor],
  exports: [ComprobantesService], // GhlReceiverController en WebhooksModule lo necesita
})
export class ComprobantesModule {}
