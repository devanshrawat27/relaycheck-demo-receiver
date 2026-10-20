import { Module } from '@nestjs/common';
import { TestOracleController } from './test-oracle.controller';
import { TestOracleService } from './test-oracle.service';

@Module({
  controllers: [TestOracleController],
  providers: [TestOracleService],
})
export class TestOracleModule {}
