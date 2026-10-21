import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { FaultConfig, FaultsService } from './faults.service';
import { SetFaultDto } from './set-fault.dto';

/**
 * Test-only fault controls. Registered ONLY when RELAYCHECK_TEST_MODE=true;
 * outside test mode these routes do not exist (404, fail closed).
 */
@Controller('__test__/faults')
export class FaultsController {
  constructor(private readonly faults: FaultsService) {}

  @Get()
  get(): FaultConfig {
    return this.faults.current();
  }

  @Post()
  set(@Body() dto: SetFaultDto): FaultConfig {
    return this.faults.set(dto);
  }

  @Delete()
  reset(): FaultConfig {
    return this.faults.reset();
  }
}
