import 'dotenv/config';
import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { WebhooksService } from '../src/webhooks/webhooks.service';
import { BrokenWebhooksService } from './fixtures/broken-webhooks.service';
import { evaluateBusinessEffectCount } from './helpers/assertions';

/**
 * Regression proof: the business-effect assertion must FAIL for a
 * deliberately non-idempotent implementation and PASS for the real one.
 * The broken implementation exists only under test/ and is injected via
 * Nest provider override — there is no runtime switch that disables
 * idempotency in production paths.
 */
describe('Regression proof: duplicate deliveries apply one business effect (e2e)', () => {
  jest.setTimeout(30000);

  const prisma = new PrismaClient();
  const createdOrderIds: string[] = [];
  const createdEventIds: string[] = [];

  beforeAll(() => {
    process.env.RELAYCHECK_TEST_MODE = 'true';
  });

  afterAll(async () => {
    await prisma.businessEffect.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.demoOrder.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.processedEvent.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.$disconnect();
  });

  async function boot(broken: boolean): Promise<INestApplication> {
    let builder = Test.createTestingModule({ imports: [AppModule.root()] });
    if (broken) {
      builder = builder.overrideProvider(WebhooksService).useClass(BrokenWebhooksService);
    }
    const moduleRef = await builder.compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    return app;
  }

  function makeEvent(prefix: string) {
    const eventId = `evt_reg_${prefix}_${randomUUID()}`;
    const orderId = `ord_reg_${prefix}_${randomUUID()}`;
    createdEventIds.push(eventId);
    createdOrderIds.push(orderId);
    return {
      eventId,
      eventType: 'payment.succeeded',
      orderId,
      amount: 2500,
      currency: 'USD',
      occurredAt: new Date().toISOString(),
    };
  }

  async function deliverThreeTimes(server: Parameters<typeof request>[0], event: ReturnType<typeof makeEvent>) {
    for (let i = 0; i < 3; i++) {
      await request(server).post('/api/webhooks/demo').send(event).expect(201);
    }
  }

  async function oracleCount(server: Parameters<typeof request>[0], orderId: string): Promise<number> {
    const res = await request(server).get(`/api/__test__/orders/${orderId}`).expect(200);
    return (res.body as { businessEffectCount: number }).businessEffectCount;
  }

  it('passes for the real idempotent implementation', async () => {
    const app = await boot(false);
    try {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const event = makeEvent('good');

      await deliverThreeTimes(server, event);
      const count = await oracleCount(server, event.orderId);

      const result = evaluateBusinessEffectCount(count);
      expect(count).toBe(1);
      expect(result).toEqual({
        name: 'business_effect_applied_once',
        expected: 1,
        actual: 1,
        passed: true,
      });
    } finally {
      await app.close();
    }
  });

  it('fails for the deliberately non-idempotent fixture', async () => {
    const app = await boot(true);
    try {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const event = makeEvent('broken');

      await deliverThreeTimes(server, event);
      const count = await oracleCount(server, event.orderId);

      // Sanity: the fixture really did misbehave.
      expect(count).toBe(3);

      const result = evaluateBusinessEffectCount(count);
      expect(result.passed).toBe(false);
      expect(result).toEqual({
        name: 'business_effect_applied_once',
        expected: 1,
        actual: 3,
        passed: false,
      });
    } finally {
      await app.close();
    }
  });
});
