import { DynamicModule, Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { FaultsModule } from './test-controls/faults.module';
import { TestControlsModule } from './test-controls/test-controls.module';
import { TestOracleModule } from './test-oracle/test-oracle.module';
import { WebhooksController } from './webhooks/webhooks.controller';
import { WebhooksService } from './webhooks/webhooks.service';

/** Test mode is enabled only by an explicit RELAYCHECK_TEST_MODE=true. */
export function isTestModeEnabled(): boolean {
  return process.env.RELAYCHECK_TEST_MODE === 'true';
}

@Module({})
export class AppModule {
  /**
   * Assembled at call time so test-mode gating is re-read every time the
   * application (or a test module) is created — the oracle and fault-control
   * modules are included only when test mode is explicitly enabled.
   */
  static root(): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PrismaModule,
        FaultsModule,
        ...(isTestModeEnabled() ? [TestOracleModule, TestControlsModule] : []),
      ],
      controllers: [HealthController, WebhooksController],
      providers: [WebhooksService],
    };
  }
}
