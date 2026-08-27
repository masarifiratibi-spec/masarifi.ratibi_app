import { Injectable } from '@nestjs/common';

import { PlatformConfigService } from '../config/platform-config.service';
import type { MetaResponseDto } from './meta.dto';

@Injectable()
export class MetaService {
  constructor(private readonly config: PlatformConfigService) {}

  get(): MetaResponseDto {
    return {
      apiVersion: 'v1',
      serverTime: new Date().toISOString(),
      minMobileVersion: this.config.get('MASARIFI_META_MIN_MOBILE_VERSION') ?? null,
      minAdminVersion: this.config.get('MASARIFI_META_MIN_ADMIN_VERSION') ?? null,
    };
  }
}
