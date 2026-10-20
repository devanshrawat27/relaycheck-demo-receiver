import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { WebhooksController } from './webhooks/webhooks.controller';

@Module({
  imports: [],
  controllers: [HealthController, WebhooksController],
  providers: [],
})
export class AppModule {}
