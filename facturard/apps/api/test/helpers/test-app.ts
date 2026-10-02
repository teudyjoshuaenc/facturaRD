import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { prisma } from '@facturard/database'
import { AppModule } from '../../src/app.module'
import { EcfEmissionProcessor } from '../../src/modules/comprobantes/ecf-emission.processor'
import { DgiiTrackIdsClient } from '../../src/modules/secuencias/dgii-trackids.client'
import { resetDatabase } from './reset-db'

export interface TestContext {
  app: INestApplication
  // Espía sobre la cola BullMQ: cada emisión real llama queueAdd exactamente
  // una vez. Nunca se instancia el worker, así que la DGII jamás es contactada.
  queueAdd: jest.Mock
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ProviderOverride { provide: any; useValue: any }

/**
 * Construye la app Nest para e2e con la cola de emisión y el worker MOCKEADOS.
 * Con esto los tests verifican el pipeline sin encolar jobs reales ni tocar la
 * DGII: basta con aseverar cuántas veces se llamó a `queueAdd`.
 * `overrides` permite mockear servicios adicionales (p.ej. DgiiContribuyentesService).
 */
export async function createTestApp(overrides: ProviderOverride[] = []): Promise<TestContext> {
  // Limpia la base al arrancar cada archivo de test (aislamiento entre specs en
  // la corrida in-band con base compartida). Los fixtures que cada spec crea
  // después en su beforeAll sobreviven, porque esto corre primero.
  await resetDatabase(prisma)

  const queueAdd = jest.fn().mockResolvedValue({ id: 'test-job' })

  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(getQueueToken('ecf-emission'))
    .useValue({ add: queueAdd })
    .overrideProvider(EcfEmissionProcessor)
    .useValue({})
  // La detección de secuencias consulta a la DGII: por defecto falla en voz alta
  // (nunca red real). Los specs que la prueban pasan su propio DgiiTrackIdsClient.
  if (!overrides.some((o) => o.provide === DgiiTrackIdsClient)) {
    const sinRed = () => Promise.reject(new Error('DGII deshabilitada en e2e'))
    builder = builder.overrideProvider(DgiiTrackIdsClient).useValue({ autenticar: sinRed, recibido: sinRed })
  }
  for (const o of overrides) {
    builder = builder.overrideProvider(o.provide).useValue(o.useValue)
  }
  const moduleRef = await builder.compile()

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
