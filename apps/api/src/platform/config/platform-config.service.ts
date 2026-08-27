import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { PlatformEnvironment } from './environment.types';

@Injectable()
export class PlatformConfigService {
  constructor(private readonly config: ConfigService<PlatformEnvironment, true>) {}

  get<K extends keyof PlatformEnvironment>(key: K): PlatformEnvironment[K] {
    return this.config.get(key, { infer: true });
  }
}
