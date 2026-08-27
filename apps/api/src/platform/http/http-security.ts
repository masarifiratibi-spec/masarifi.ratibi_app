import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

import { PlatformConfigService } from '../config/platform-config.service';

export function configureHttpSecurity(app: INestApplication, config: PlatformConfigService): void {
  const origins = new Set(
    config
      .get('MASARIFI_CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  if (origins.has('*')) throw new Error('CORS_ORIGIN_INVALID');
  app.use(helmet());
  app.enableCors({
    credentials: true,
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || origins.has(origin)) callback(null, true);
      else callback(null, false);
    },
  });
}
