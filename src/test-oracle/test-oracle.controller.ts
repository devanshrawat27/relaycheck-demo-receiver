import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { OrderTestState, TestOracleService } from './test-oracle.service';

/**
 * Test-only oracle. Registered by AppModule ONLY when
 * RELAYCHECK_TEST_MODE=true — it fails closed (module missing → 404)
 * otherwise.
 */
@Controller('__test__')
export class TestOracleController {
  constructor(private readonly oracle: TestOracleService) {}

  @Get('orders/:orderId')
  async getOrder(@Param('orderId') orderId: string): Promise<OrderTestState> {
    const state = await this.oracle.getOrderState(orderId);
    if (!state) {
      throw new NotFoundException(`No demo order with id ${orderId}`);
    }
    return state;
  }
}
