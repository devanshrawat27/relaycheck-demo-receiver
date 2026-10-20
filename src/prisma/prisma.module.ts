import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Shared database access. Global so feature modules (webhooks, oracle) can inject PrismaService. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
