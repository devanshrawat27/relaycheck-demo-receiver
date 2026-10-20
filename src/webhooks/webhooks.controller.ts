import { Body, Controller, Post } from '@nestjs/common';
import { IsIn, IsInt, IsNotEmpty, IsISO8601, IsPositive, IsString, Length } from 'class-validator';
import { DemoEventResult, WebhooksService } from './webhooks.service';

/** `payment.succeeded` event delivered to the demo webhook receiver. */
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

export type { DemoEventResult };

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('demo')
  handleDemo(@Body() event: DemoEventDto): Promise<DemoEventResult> {
    return this.webhooks.processDemoEvent(event);
  }
}
