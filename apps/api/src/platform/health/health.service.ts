import { Injectable, Optional } from '@nestjs/common';

import { PlatformConfigService } from '../config/platform-config.service';
import { PoolService } from '../database/pool.service';
import { SchemaCompatibilityService } from '../database/schema-compatibility';
import { QueueHealthIndicator, type DependencyState } from './queue-health.indicator';
import { ReadinessCache } from './readiness-cache';

export interface LivenessResponse {
  status: 'ok';
  version: string;
  startedAt: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  checks: { database: DependencyState; queue: DependencyState };
}

@Injectable()
export class HealthService {
  private readonly startedAt = new Date().toISOString();
  private readonly cache: ReadinessCache<ReadinessResponse>;
  private shuttingDown = false;

  constructor(
    private readonly config: PlatformConfigService,
    private readonly database: PoolService,
    private readonly queue: QueueHealthIndicator,
    @Optional() private readonly schema?: SchemaCompatibilityService,
  ) {
    this.cache = new ReadinessCache(config.get('MASARIFI_READINESS_CACHE_TTL_MS'));
  }

  live(): LivenessResponse {
    return {
      status: 'ok',
      version: this.config.get('MASARIFI_RELEASE_VERSION'),
      startedAt: this.startedAt,
    };
  }

  async ready(): Promise<ReadinessResponse> {
    if (this.shuttingDown) {
      return {
        status: 'not_ready',
        checks: { database: 'down', queue: 'down' },
      };
    }
    const cached = this.cache.get();
    if (cached) return cached;

    const timeoutMs = this.config.get('MASARIFI_READINESS_TIMEOUT_MS');
    const [database, queue] = await Promise.all([
      this.database
        .ping(timeoutMs)
        .then(() => this.schema?.check(timeoutMs))
        .then<DependencyState>(() => 'up')
        .catch<DependencyState>(() => 'down'),
      this.queue.check(timeoutMs),
    ]);
    const result: ReadinessResponse = {
      status: database === 'up' && queue === 'up' ? 'ready' : 'not_ready',
      checks: { database, queue },
    };
    this.cache.set(result);
    return result;
  }

  beginShutdown(): void {
    this.shuttingDown = true;
    this.cache.clear();
  }
}
