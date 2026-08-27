import Joi from 'joi';

import type { PlatformEnvironment } from './environment.types';

const applicationKeys = new Set([
  'MASARIFI_PROCESS_KIND',
  'MASARIFI_RELEASE_VERSION',
  'MASARIFI_HTTP_PORT',
  'MASARIFI_CORS_ORIGINS',
  'MASARIFI_HTTP_BODY_LIMIT_BYTES',
  'MASARIFI_REQUEST_TIMEOUT_MS',
  'MASARIFI_READINESS_TIMEOUT_MS',
  'MASARIFI_READINESS_CACHE_TTL_MS',
  'MASARIFI_DATABASE_POOL_MAX',
  'MASARIFI_SHUTDOWN_TIMEOUT_MS',
  'MASARIFI_OUTBOX_BATCH_SIZE',
  'MASARIFI_WORKER_ID',
  'MASARIFI_OUTBOX_LEASE_SECONDS',
  'MASARIFI_OUTBOX_POLL_MS',
  'MASARIFI_OUTBOX_MAX_ATTEMPTS',
  'MASARIFI_OUTBOX_RETRY_BASE_SECONDS',
  'MASARIFI_OUTBOX_RETRY_MAX_SECONDS',
  'MASARIFI_OUTBOX_RETRY_JITTER_MS',
  'MASARIFI_LOG_LEVEL',
  'MASARIFI_META_MIN_MOBILE_VERSION',
  'MASARIFI_META_MIN_ADMIN_VERSION',
  'MASARIFI_MIGRATION_CHECKSUM_FILE',
  'MASARIFI_MIGRATION_STATEMENT_TIMEOUT_MS',
]);

const schema = Joi.object<PlatformEnvironment>({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  MASARIFI_PROCESS_KIND: Joi.string().valid('api', 'worker', 'migration').required(),
  MASARIFI_RELEASE_VERSION: Joi.string().trim().min(1).max(64).required(),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  MASARIFI_HTTP_PORT: Joi.number().integer().min(1024).max(65535).default(3000),
  MASARIFI_CORS_ORIGINS: Joi.string().allow('').default(''),
  MASARIFI_HTTP_BODY_LIMIT_BYTES: Joi.number().integer().min(1024).max(1_048_576).default(262_144),
  MASARIFI_REQUEST_TIMEOUT_MS: Joi.number().integer().min(100).max(10_000).default(10_000),
  MASARIFI_READINESS_TIMEOUT_MS: Joi.number().integer().min(100).max(1_000).default(1_000),
  MASARIFI_READINESS_CACHE_TTL_MS: Joi.number().integer().min(0).max(5_000).default(5_000),
  MASARIFI_DATABASE_POOL_MAX: Joi.number().integer().min(1).max(50).default(10),
  MASARIFI_SHUTDOWN_TIMEOUT_MS: Joi.number().integer().min(1_000).max(30_000).default(30_000),
  MASARIFI_OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).max(100).default(50),
  MASARIFI_WORKER_ID: Joi.string()
    .pattern(/^[A-Za-z0-9._:-]{1,128}$/)
    .optional(),
  MASARIFI_OUTBOX_LEASE_SECONDS: Joi.number().integer().min(1).max(300).default(30),
  MASARIFI_OUTBOX_POLL_MS: Joi.number().integer().min(100).max(10_000).default(500),
  MASARIFI_OUTBOX_MAX_ATTEMPTS: Joi.number().integer().min(1).max(100).default(10),
  MASARIFI_OUTBOX_RETRY_BASE_SECONDS: Joi.number().integer().min(1).max(60).default(1),
  MASARIFI_OUTBOX_RETRY_MAX_SECONDS: Joi.number().integer().min(1).max(3_600).default(300),
  MASARIFI_OUTBOX_RETRY_JITTER_MS: Joi.number().integer().min(0).max(5_000).default(1_000),
  MASARIFI_LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
  MASARIFI_META_MIN_MOBILE_VERSION: Joi.string().trim().min(1).max(32).optional(),
  MASARIFI_META_MIN_ADMIN_VERSION: Joi.string().trim().min(1).max(32).optional(),
  MASARIFI_MIGRATION_CHECKSUM_FILE: Joi.string()
    .pattern(/^supabase\/[A-Za-z0-9._/-]+$/)
    .default('supabase/migration-checksums.sha256'),
  MASARIFI_MIGRATION_STATEMENT_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1_000)
    .max(600_000)
    .default(120_000),
}).unknown(true);

export function validateEnvironment(input: Record<string, unknown>): PlatformEnvironment {
  const unknownApplicationKeys = Object.keys(input).filter(
    (key) => key.startsWith('MASARIFI_') && !applicationKeys.has(key),
  );
  if (unknownApplicationKeys.length > 0) {
    throw new Error(`Invalid environment variables: ${unknownApplicationKeys.sort().join(', ')}`);
  }

  const result: Joi.ValidationResult<PlatformEnvironment> = schema.validate(input, {
    abortEarly: false,
    convert: true,
    stripUnknown: false,
  });
  const error = result.error;
  const value: unknown = result.value;
  if (error) {
    const keys = [
      ...new Set(error.details.map((detail) => String(detail.path[0] ?? 'environment'))),
    ]
      .sort()
      .join(', ');
    throw new Error(`Invalid environment variables: ${keys}`);
  }

  const environment = value as PlatformEnvironment;
  if (
    environment.MASARIFI_OUTBOX_RETRY_MAX_SECONDS < environment.MASARIFI_OUTBOX_RETRY_BASE_SECONDS
  ) {
    throw new Error(
      'Invalid environment variables: MASARIFI_OUTBOX_RETRY_BASE_SECONDS, MASARIFI_OUTBOX_RETRY_MAX_SECONDS',
    );
  }
  if (environment.NODE_ENV === 'production' && environment.MASARIFI_LOG_LEVEL === 'debug') {
    throw new Error('Invalid environment variables: MASARIFI_LOG_LEVEL');
  }
  if (environment.NODE_ENV === 'production') {
    const invalidOrigin = environment.MASARIFI_CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .some(
        (origin) =>
          origin === '*' ||
          !origin.startsWith('https://') ||
          /localhost|127\.0\.0\.1/i.test(origin),
      );
    if (invalidOrigin) throw new Error('Invalid environment variables: MASARIFI_CORS_ORIGINS');
  }

  return environment;
}
