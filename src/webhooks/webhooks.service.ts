import { HttpException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FaultsService } from '../test-controls/faults.service';
import { DemoEventDto } from './webhooks.controller';

export interface DemoEventResult {
  accepted: boolean;
  eventId: string;
  /** true when this delivery applied the business effect, false for a duplicate */
  processed: boolean;
  duplicate: boolean;
}

/** Fixed demo consumer name used in the (consumerName, eventId) idempotency key. */
export const DEMO_CONSUMER_NAME = 'relaycheck-demo';

/**
 * Applies a `payment.succeeded` demo event idempotently.
 *
 * The processed-event row and the business effect are committed inside one
 * database transaction. A duplicate delivery hits the unique
 * (consumerName, eventId) constraint, rolls back the effect, and is reported
 * as `duplicate: true` — so repeated delivery never duplicates the effect.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faults: FaultsService,
  ) {}

  async processDemoEvent(event: DemoEventDto): Promise<DemoEventResult> {
    // Test-only fault injection. Defaults to off; only settable through the
    // test-gated control endpoints. An `error` fault must not apply the
    // business effect at all; a `delay` fault applies it after the delay.
    const fault = this.faults.current();
    if (fault.mode === 'error') {
      throw new HttpException(
        'Injected fault: controlled receiver failure',
        fault.httpStatus ?? 503,
      );
    }
    if (fault.mode === 'delay') {
      await new Promise((resolve) => setTimeout(resolve, fault.delayMs ?? 1000));
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedEvent.create({
          data: { consumerName: DEMO_CONSUMER_NAME, eventId: event.eventId },
        });
        await tx.demoOrder.create({
          data: {
            id: event.orderId,
            status: 'PAID',
            amount: event.amount,
            currency: event.currency,
          },
        });
        await tx.businessEffect.create({
          data: { orderId: event.orderId, effect: 'ORDER_PAID' },
        });
      });

      return { accepted: true, eventId: event.eventId, processed: true, duplicate: false };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Unique constraint on (consumerName, eventId) — duplicate delivery.
        this.logger.debug(`Duplicate event ignored: ${event.eventId}`);
        return { accepted: true, eventId: event.eventId, processed: false, duplicate: true };
      }
      throw error;
    }
  }
}
