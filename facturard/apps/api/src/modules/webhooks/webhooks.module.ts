import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { WebhooksController } from './webhooks.controller'
import { WebhooksService } from './webhooks.service'
import { GhlReceiverController } from './ghl-receiver.controller'
import { WebhookSenderService } from './webhook-sender.service'
import { ComprobantesModule } from '../comprobantes/comprobantes.module'

@Module({
  imports: [
    ConfigModule,
    // forwardRef resuelve la dependencia circular:
    //   WebhooksModule  → ComprobantesModule (GhlReceiverController usa ComprobantesService)
    //   ComprobantesModule → WebhooksModule  (EcfEmissionProcessor usa WebhookSenderService)
    forwardRef(() => ComprobantesModule),
  ],
  controllers: [
    WebhooksController,
    GhlReceiverController, // endpoint público — sin JWT
  ],
  providers: [WebhooksService, WebhookSenderService],
  exports: [WebhookSenderService], // ComprobantesModule lo importa desde aquí
})
export class WebhooksModule {}
