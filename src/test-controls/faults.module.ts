import { Module } from '@nestjs/common';
import { FaultsService } from './faults.service';

/** Holds the test-only fault state. Always registered; settable only via test-gated routes. */
@Module({
  providers: [FaultsService],
  exports: [FaultsService],
})
export class FaultsModule {}
