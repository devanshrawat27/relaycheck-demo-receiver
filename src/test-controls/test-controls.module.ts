import { Module } from '@nestjs/common';
import { FaultsController } from './faults.controller';
import { FaultsModule } from './faults.module';

@Module({
  imports: [FaultsModule],
  controllers: [FaultsController],
})
export class TestControlsModule {}
