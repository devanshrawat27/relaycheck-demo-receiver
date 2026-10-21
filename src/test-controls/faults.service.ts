import { Injectable } from '@nestjs/common';

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

/**
 * In-memory fault injection for the demo receiver (local/test only).
 *
 * The service always exists so the webhook path stays simple, but its
 * behavior can only be changed through the test-gated control endpoints —
 * which do not exist unless RELAYCHECK_TEST_MODE=true. State resets to
 * `off` on restart by design: test controls are never persisted.
 */
@Injectable()
export class FaultsService {
  private config: FaultConfig = { mode: 'off' };

  current(): FaultConfig {
    return this.config;
  }

  set(config: FaultConfig): FaultConfig {
    this.config = this.normalize(config);
    return this.config;
  }

  reset(): FaultConfig {
    this.config = { mode: 'off' };
    return this.config;
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
