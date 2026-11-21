import { Injectable } from '@nestjs/common';

import { PlatformConfigService } from '../config/platform-config.service';
import { ReadinessDependencies, type DependencyChecks } from './readiness-dependencies';
import { ReadinessCache } from './readiness-cache';

export interface LivenessResponse {
  status: 'ok';
  version: string;
  startedAt: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  checks: DependencyChecks;
}

@Injectable()
export class HealthService {
  private readonly startedAt = new Date().toISOString();
  private readonly cache: ReadinessCache<ReadinessResponse>;
  private inFlight?: Promise<ReadinessResponse>;
  private shuttingDown = false;

  constructor(
    private readonly config: PlatformConfigService,
    private readonly dependencies: ReadinessDependencies,
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

    this.inFlight ??= this.checkDependencies().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async checkDependencies(): Promise<ReadinessResponse> {
    const checks = await this.dependencies.check(this.config.get('MASARIFI_READINESS_TIMEOUT_MS'));
    if (this.shuttingDown) {
      return { status: 'not_ready', checks: { database: 'down', queue: 'down' } };
    }
    const result: ReadinessResponse = {
      status: checks.database === 'up' && checks.queue === 'up' ? 'ready' : 'not_ready',
      checks,
    };
    this.cache.set(result);
    return result;
  }

  beginShutdown(): void {
    this.shuttingDown = true;
    this.cache.clear();
  }
}
