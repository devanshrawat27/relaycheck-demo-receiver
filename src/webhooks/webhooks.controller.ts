import { Body, Controller, Post } from '@nestjs/common';
import { IsIn, IsInt, IsNotEmpty, IsISO8601, IsPositive, IsString, Length } from 'class-validator';

/**
 * `payment.succeeded` event delivered to the demo webhook receiver.
 * `eventId` is the stable idempotency key source used in the next task;
 * this skeleton only validates the payload (no persistence yet).
 */
export class DemoEventDto {
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @IsIn(['payment.succeeded'])
  eventType!: 'payment.succeeded';

  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsInt()
  @IsPositive()
  amount!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsISO8601()
  occurredAt!: string;
}

export interface DemoEventResult {
  accepted: boolean;
  eventId: string;
  processed: boolean;
}

@Controller('webhooks')
export class WebhooksController {
  @Post('demo')
  handleDemo(@Body() event: DemoEventDto): DemoEventResult {
    // No persistence here yet — idempotent processing lands with the
    // unique (consumerName, eventId) constraint in the following task.
    return { accepted: true, eventId: event.eventId, processed: false };
  }
}
