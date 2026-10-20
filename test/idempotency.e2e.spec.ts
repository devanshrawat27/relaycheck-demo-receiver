import 'dotenv/config';
import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Persistent idempotency (e2e)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let prisma: PrismaClient;

  const eventId = `evt_idem_${randomUUID()}`;
  const orderId = `ord_idem_${randomUUID()}`;
  const event = {
    eventId,
    eventType: 'payment.succeeded',
    orderId,
    amount: 5000,
    currency: 'USD',
    occurredAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.root()] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await prisma.businessEffect.deleteMany({ where: { orderId } });
    await prisma.demoOrder.deleteMany({ where: { id: orderId } });
    await prisma.processedEvent.deleteMany({ where: { eventId } });
    await prisma.$disconnect();
    await app.close();
  });

  it('three sequential deliveries of one event ID apply the business effect once', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    const first = await request(server).post('/api/webhooks/demo').send(event).expect(201);
    const second = await request(server).post('/api/webhooks/demo').send(event).expect(201);
    const third = await request(server).post('/api/webhooks/demo').send(event).expect(201);

    expect(first.body).toMatchObject({ processed: true, duplicate: false });
    expect(second.body).toMatchObject({ processed: false, duplicate: true });
    expect(third.body).toMatchObject({ processed: false, duplicate: true });

    const processedEvents = await prisma.processedEvent.findMany({ where: { eventId } });
    const effects = await prisma.businessEffect.findMany({ where: { orderId } });
    const orders = await prisma.demoOrder.findMany({ where: { id: orderId } });

    expect(processedEvents).toHaveLength(1);
    expect(effects).toHaveLength(1);
    expect(orders).toHaveLength(1);
  });

  it('five concurrent deliveries of one event ID apply the business effect once', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const concurrentEventId = `evt_conc_${randomUUID()}`;
    const concurrentOrderId = `ord_conc_${randomUUID()}`;
    const concurrentEvent = { ...event, eventId: concurrentEventId, orderId: concurrentOrderId };

    try {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(server).post('/api/webhooks/demo').send(concurrentEvent),
        ),
      );

      const bodies = responses.map((r) => r.body as { processed: boolean; duplicate: boolean });
      expect(bodies.filter((b) => b.processed)).toHaveLength(1);
      expect(bodies.filter((b) => b.duplicate)).toHaveLength(4);

      const processedEvents = await prisma.processedEvent.findMany({
        where: { eventId: concurrentEventId },
      });
      const effects = await prisma.businessEffect.findMany({
        where: { orderId: concurrentOrderId },
      });

      expect(processedEvents).toHaveLength(1);
      expect(effects).toHaveLength(1);
    } finally {
      await prisma.businessEffect.deleteMany({ where: { orderId: concurrentOrderId } });
      await prisma.demoOrder.deleteMany({ where: { id: concurrentOrderId } });
      await prisma.processedEvent.deleteMany({ where: { eventId: concurrentEventId } });
    }
  });
});
