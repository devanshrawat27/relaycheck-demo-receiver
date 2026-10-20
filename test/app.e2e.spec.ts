import 'dotenv/config';
import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Demo receiver skeleton (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const eventId = `evt_val_${randomUUID()}`;
  const orderId = `ord_val_${randomUUID()}`;
  const validEvent = {
    eventId,
    eventType: 'payment.succeeded',
    orderId,
    amount: 4200,
    currency: 'USD',
    occurredAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  it('GET /api/health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', service: 'demo-receiver' });
  });

  it('accepts a valid payment.succeeded event', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/webhooks/demo')
      .send(validEvent)
      .expect(201);

    expect(res.body).toEqual({
      accepted: true,
      eventId,
      processed: true,
      duplicate: false,
    });
  });

  it('rejects an unsupported event type', async () => {
    await request(app.getHttpServer())
      .post('/api/webhooks/demo')
      .send({ ...validEvent, eventType: 'charge.refunded' })
      .expect(400);
  });

  it('rejects a missing eventId', async () => {
    const { eventId: _omitted, ...rest } = validEvent;
    await request(app.getHttpServer()).post('/api/webhooks/demo').send(rest).expect(400);
  });

  it('rejects a non-positive amount', async () => {
    await request(app.getHttpServer())
      .post('/api/webhooks/demo')
      .send({ ...validEvent, amount: 0 })
      .expect(400);
  });

  it('rejects unexpected extra fields', async () => {
    await request(app.getHttpServer())
      .post('/api/webhooks/demo')
      .send({ ...validEvent, destinationUrl: 'https://evil.example.com/' })
      .expect(400);
  });
});
