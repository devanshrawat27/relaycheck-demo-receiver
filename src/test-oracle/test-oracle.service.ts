import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OrderTestState {
  orderId: string;
  orderStatus: string;
  businessEffectCount: number;
}

/**
 * Test-oracle read model. Returns only the minimum business state the
 * RelayCheck assertions need: the order's status and how many business
 * effects were applied for it. Never exposed outside explicit test mode
 * (the module is only registered when RELAYCHECK_TEST_MODE=true).
 */
@Injectable()
export class TestOracleService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrderState(orderId: string): Promise<OrderTestState | null> {
    const order = await this.prisma.demoOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return null;
    }
    const businessEffectCount = await this.prisma.businessEffect.count({
      where: { orderId },
    });
    return {
      orderId: order.id,
      orderStatus: order.status,
      businessEffectCount,
    };
  }
}
