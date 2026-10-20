import 'dotenv/config';
import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

async function bootModule(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.root()] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return app;
}

describe('Test oracle behind explicit test mode (e2e)', () => {
  jest.setTimeout(30000);

  const prisma = new PrismaClient();
  const orderId = `ord_oracle_${randomUUID()}`;
  const eventId = `evt_oracle_${randomUUID()}`;
  const event = {
    eventId,
    eventType: 'payment.succeeded',
    orderId,
    amount: 9000,
    currency: 'USD',
    occurredAt: new Date().toISOString(),
  };

  afterAll(async () => {
    await prisma.businessEffect.deleteMany({ where: { orderId } });
    await prisma.demoOrder.deleteMany({ where: { id: orderId } });
    await prisma.processedEvent.deleteMany({ where: { eventId } });
    await prisma.$disconnect();
  });

  describe('when RELAYCHECK_TEST_MODE=true', () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.RELAYCHECK_TEST_MODE = 'true';
      app = await bootModule();
    });

    afterAll(async () => {
      await app.close();
    });

    it('creates the order through the webhook and reads minimum state from the oracle', async () => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];

      await request(server).post('/api/webhooks/demo').send(event).expect(201);

      const res = await request(server)
        .get(`/api/__test__/orders/${orderId}`)
        .expect(200);

      expect(res.body).toEqual({
        orderId,
        orderStatus: 'PAID',
        businessEffectCount: 1,
      });
    });

    it('rejects unknown order ids with 404', async () => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const res = await request(server)
        .get('/api/__test__/orders/ord_missing_0000')
        .expect(404);
      expect(res.body.message).toContain('ord_missing_0000');
    });
  });

  describe('when RELAYCHECK_TEST_MODE is not enabled', () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.RELAYCHECK_TEST_MODE = 'false';
      app = await bootModule();
    });

    afterAll(async () => {
      await app.close();
    });

    it('fails closed: the oracle endpoint does not exist', async () => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      await request(server).get(`/api/__test__/orders/${orderId}`).expect(404);
    });

    it('regular endpoints still work', async () => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      await request(server).get('/api/health').expect(200);
    });
  });

  describe('when RELAYCHECK_TEST_MODE is unset entirely', () => {
    let app: INestApplication;

    beforeAll(async () => {
      delete process.env.RELAYCHECK_TEST_MODE;
      app = await bootModule();
    });

    afterAll(async () => {
      await app.close();
    });

    it('fails closed: the oracle endpoint does not exist', async () => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      await request(server).get(`/api/__test__/orders/${orderId}`).expect(404);
    });
  });
});
