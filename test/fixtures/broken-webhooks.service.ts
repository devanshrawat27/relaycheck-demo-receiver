import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DemoEventDto } from '../../src/webhooks/webhooks.controller';
import { DemoEventResult } from '../../src/webhooks/webhooks.service';

/**
 * Deliberately broken webhook processor used ONLY by the regression suite
 * (test/fixtures/). It never records a processed event and applies the
 * business effect on every single delivery — exactly the bug RelayCheck
 * exists to catch. It must never ship in src/ or behind a runtime switch;
 * it is injected via Nest's `overrideProvider` in tests.
 */
@Injectable()
export class BrokenWebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async processDemoEvent(event: DemoEventDto): Promise<DemoEventResult> {
    const existing = await this.prisma.demoOrder.findUnique({
      where: { id: event.orderId },
    });
    if (!existing) {
      await this.prisma.demoOrder.create({
        data: {
          id: event.orderId,
          status: 'PAID',
          amount: event.amount,
          currency: event.currency,
        },
      });
    }
    // The bug: one effect row per delivery, no idempotency guard anywhere.
    await this.prisma.businessEffect.create({
      data: { orderId: event.orderId, effect: 'ORDER_PAID' },
    });
    return { accepted: true, eventId: event.eventId, processed: true, duplicate: false };
  }
}
