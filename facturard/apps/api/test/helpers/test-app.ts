import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { AppModule } from '../../src/app.module'
import { EcfEmissionProcessor } from '../../src/modules/comprobantes/ecf-emission.processor'

export interface TestContext {
  app: INestApplication
  // Espía sobre la cola BullMQ: cada emisión real llama queueAdd exactamente
  // una vez. Nunca se instancia el worker, así que la DGII jamás es contactada.
  queueAdd: jest.Mock
}

/**
 * Construye la app Nest para e2e con la cola de emisión y el worker MOCKEADOS.
 * Con esto los tests verifican el pipeline sin encolar jobs reales ni tocar la
 * DGII: basta con aseverar cuántas veces se llamó a `queueAdd`.
 */
export async function createTestApp(): Promise<TestContext> {
  const queueAdd = jest.fn().mockResolvedValue({ id: 'test-job' })

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getQueueToken('ecf-emission'))
    .useValue({ add: queueAdd })
    .overrideProvider(EcfEmissionProcessor)
    .useValue({})
    .compile()

  const app = moduleRef.createNestApplication()
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )
  app.setGlobalPrefix('api/v1')
  await app.init()

  return { app, queueAdd }
}
