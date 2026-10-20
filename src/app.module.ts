import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaService } from './prisma/prisma.service';
import { WebhooksController } from './webhooks/webhooks.controller';
import { WebhooksService } from './webhooks/webhooks.service';

@Module({
  imports: [],
  controllers: [HealthController, WebhooksController],
  providers: [PrismaService, WebhooksService],
})
export class AppModule {}
