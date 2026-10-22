import 'dotenv/config';
import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

async function boot(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.root()] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return app;
}

function makeEvent(): { eventId: string; orderId: string; payload: Record<string, unknown> } {
  const eventId = `evt_fault_${randomUUID()}`;
  const orderId = `ord_fault_${randomUUID()}`;
  return {
    eventId,
    orderId,
    payload: {
      eventId,
      eventType: 'payment.succeeded',
      orderId,
      amount: 1500,
      currency: 'USD',
      occurredAt: new Date().toISOString(),
    },
  };
}

describe('Controlled receiver faults, test-mode gated (e2e)', () => {
  jest.setTimeout(30000);

  const prisma = new PrismaClient();
  const createdOrders: string[] = [];
  const createdEvents: string[] = [];

  afterAll(async () => {
    await prisma.businessEffect.deleteMany({ where: { orderId: { in: createdOrders } } });
    await prisma.demoOrder.deleteMany({ where: { id: { in: createdOrders } } });
    await prisma.processedEvent.deleteMany({ where: { eventId: { in: createdEvents } } });
    await prisma.$disconnect();
  });

  describe('when RELAYCHECK_TEST_MODE=true', () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.RELAYCHECK_TEST_MODE = 'true';
      app = await boot();
    });

    afterEach(async () => {
      await request(app.getHttpServer()).delete('/api/__test__/faults').expect(200);
    });

    afterAll(async () => {
      await app.close();
    });

    it('injects a controlled error without applying the business effect', async () => {
      const { orderId, payload } = makeEvent();
      createdOrders.push(orderId);
      createdEvents.push(String(payload.eventId));

      await request(app.getHttpServer())
        .post('/api/__test__/faults')
        .send({ mode: 'error', httpStatus: 503 })
        .expect(201);

      await request(app.getHttpServer()).post('/api/webhooks/demo').send(payload).expect(503);

      await request(app.getHttpServer())
        .get(`/api/__test__/orders/${orderId}`)
        .expect(404);
    });

    it('injects a bounded delay and still applies the effect once', async () => {
      const { orderId, payload } = makeEvent();
      createdOrders.push(orderId);
      createdEvents.push(String(payload.eventId));

      await request(app.getHttpServer())
        .post('/api/__test__/faults')
        .send({ mode: 'delay', delayMs: 300 })
        .expect(201);

      const startedAt = Date.now();
      await request(app.getHttpServer()).post('/api/webhooks/demo').send(payload).expect(201);
      const elapsed = Date.now() - startedAt;
      expect(elapsed).toBeGreaterThanOrEqual(280);

      const oracle = await request(app.getHttpServer())
        .get(`/api/__test__/orders/${orderId}`)
        .expect(200);
      expect(oracle.body.businessEffectCount).toBe(1);
    });

    it('clears faults on reset', async () => {
      const { orderId, payload } = makeEvent();
      createdOrders.push(orderId);
      createdEvents.push(String(payload.eventId));

      await request(app.getHttpServer())
        .post('/api/__test__/faults')
        .send({ mode: 'error', httpStatus: 500 })
        .expect(201);
      await request(app.getHttpServer()).delete('/api/__test__/faults').expect(200);

      await request(app.getHttpServer()).post('/api/webhooks/demo').send(payload).expect(201);
    });

    it('restores a persisted fault after a restart', async () => {
      await request(app.getHttpServer())
        .post('/api/__test__/faults')
        .send({ mode: 'error', httpStatus: 500 })
        .expect(201);

      const restarted = await boot();
      try {
        const res = await request(restarted.getHttpServer())
          .get('/api/__test__/faults')
          .expect(200);
        expect(res.body.mode).toBe('error');
        expect(res.body.httpStatus).toBe(500);
      } finally {
        await restarted.close();
      }
    });

    it('auto-expires a persisted fault', async () => {
      await request(app.getHttpServer())
        .post('/api/__test__/faults')
        .send({ mode: 'error', httpStatus: 500 })
        .expect(201);

      // Simulate a fault whose TTL elapsed while the receiver was down.
      await prisma.faultConfig.update({
        where: { id: 1 },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const restarted = await boot();
      try {
        const res = await request(restarted.getHttpServer())
          .get('/api/__test__/faults')
          .expect(200);
        expect(res.body.mode).toBe('off');
      } finally {
        await restarted.close();
      }
    });

    it('rejects out-of-range fault parameters', async () => {
      await request(app.getHttpServer())
        .post('/api/__test__/faults')
        .send({ mode: 'delay', delayMs: 600000 })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/__test__/faults')
        .send({ mode: 'error', httpStatus: 200 })
        .expect(400);
    });
  });

  describe('when RELAYCHECK_TEST_MODE is not enabled', () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.RELAYCHECK_TEST_MODE = 'false';
      app = await boot();
    });

    afterAll(async () => {
      await app.close();
    });

    it('fails closed: fault controls do not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/__test__/faults')
        .send({ mode: 'error', httpStatus: 500 })
        .expect(404);
    });

    it('the webhook still works normally', async () => {
      const { orderId, payload } = makeEvent();
      createdOrders.push(orderId);
      createdEvents.push(String(payload.eventId));

      const res = await request(app.getHttpServer())
        .post('/api/webhooks/demo')
        .send(payload)
        .expect(201);
      expect(res.body).toMatchObject({ processed: true, duplicate: false });
    });
  });
});
