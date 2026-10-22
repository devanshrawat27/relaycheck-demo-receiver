import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type FaultMode = 'off' | 'error' | 'delay';

export interface FaultConfig {
  mode: FaultMode;
  httpStatus?: number;
  delayMs?: number;
}

/** Hard bounds even if a caller bypasses DTO validation. */
const MAX_DELAY_MS = 10000;
const DEFAULT_STATUS = 503;
const DEFAULT_DELAY_MS = 1000;
/** A configured fault always heals, even if the scenario crashes before clearing it. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Test-only fault injection for the demo receiver (local/test only).
 *
 * Faults are persisted (single row) so a receiver restart does not silently
 * lose them, and they carry a time-to-live so a forgotten fault cannot poison
 * the receiver forever. Behavior can only be changed through the test-gated
 * control endpoints, which do not exist unless RELAYCHECK_TEST_MODE=true.
 */
@Injectable()
export class FaultsService implements OnModuleInit {
  private readonly logger = new Logger(FaultsService.name);
  private config: FaultConfig = { mode: 'off' };
  private expiresAtMs: number | null = null;
  private readonly ttlMs = Number(process.env.FAULT_TTL_MS ?? DEFAULT_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      const row = await this.prisma.faultConfig.findUnique({ where: { id: 1 } });
      if (!row) {
        return;
      }
      if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
        await this.prisma.faultConfig.deleteMany({ where: { id: 1 } });
        return;
      }
      this.config = {
        mode: row.mode as FaultMode,
        httpStatus: row.httpStatus ?? undefined,
        delayMs: row.delayMs ?? undefined,
      };
      this.expiresAtMs = row.expiresAt ? row.expiresAt.getTime() : null;
      this.logger.warn(`Restored persisted fault: ${this.config.mode}`);
    } catch (error) {
      this.logger.error(
        `Could not restore persisted fault: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  current(): FaultConfig {
    if (this.expiresAtMs !== null && this.expiresAtMs <= Date.now()) {
      this.logger.warn('Injected fault expired; clearing');
      this.config = { mode: 'off' };
      this.expiresAtMs = null;
      void this.prisma.faultConfig
        .deleteMany({ where: { id: 1 } })
        .catch(() => undefined);
      return { mode: 'off' };
    }
    return this.config;
  }

  async set(input: FaultConfig): Promise<FaultConfig> {
    const normalized = this.normalize(input);
    this.config = normalized;
    this.expiresAtMs = normalized.mode === 'off' ? null : Date.now() + this.ttlMs;

    if (normalized.mode === 'off') {
      await this.prisma.faultConfig.deleteMany({ where: { id: 1 } });
      return normalized;
    }

    const expiresAt = new Date(this.expiresAtMs as number);
    await this.prisma.faultConfig.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        mode: normalized.mode,
        httpStatus: normalized.httpStatus ?? null,
        delayMs: normalized.delayMs ?? null,
        expiresAt,
      },
      update: {
        mode: normalized.mode,
        httpStatus: normalized.httpStatus ?? null,
        delayMs: normalized.delayMs ?? null,
        expiresAt,
      },
    });
    return normalized;
  }

  async reset(): Promise<FaultConfig> {
    return this.set({ mode: 'off' });
  }

  private normalize(config: FaultConfig): FaultConfig {
    if (config.mode === 'error') {
      const status = config.httpStatus ?? DEFAULT_STATUS;
      return {
        mode: 'error',
        httpStatus: Math.min(599, Math.max(400, status)),
      };
    }
    if (config.mode === 'delay') {
      const delay = config.delayMs ?? DEFAULT_DELAY_MS;
      return {
        mode: 'delay',
        delayMs: Math.min(MAX_DELAY_MS, Math.max(0, delay)),
      };
    }
    return { mode: 'off' };
  }
}
