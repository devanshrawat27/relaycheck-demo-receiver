import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Demo receiver skeleton (e2e)', () => {
  let app: INestApplication;

  const validEvent = {
    eventId: 'evt_01TEST0000000000000000000001',
    eventType: 'payment.succeeded',
    orderId: 'order_test_0001',
    amount: 4200,
    currency: 'USD',
    occurredAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
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
      eventId: validEvent.eventId,
      processed: false,
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
