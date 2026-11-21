import { HttpException, Injectable } from '@nestjs/common';
import Joi from 'joi';
import { PlatformConfigService } from '../platform/config/platform-config.service';
import { isRecentClerkAuthentication, type ClerkPrincipal } from './clerk-auth.guard';
import { ClerkClientService, ClerkProviderUnavailableError } from './clerk-client.service';
import { CustomerAdminRepository } from './customer-admin.repository';
import { customerSessionReference } from './customer-session-revoker';

const calendarDate = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value: string, helpers) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value
      ? helpers.error('any.invalid')
      : value;
  });

const listSchema = Joi.object({
  query: Joi.string().trim().max(100),
  status: Joi.string().valid('active', 'suspended', 'deletion_pending', 'deleted'),
  language: Joi.string().valid('ar', 'en'),
  platform: Joi.string().valid('all', 'ios', 'android', 'multi').default('all'),
  registeredFrom: calendarDate,
  registeredTo: calendarDate,
  lastActiveFrom: Joi.string().isoDate(),
  lastActiveTo: Joi.string().isoDate(),
  sort: Joi.string().valid('name', 'registeredAt', 'lastActive').default('lastActive'),
  order: Joi.string().valid('asc', 'desc').default('desc'),
  page: Joi.number().integer().min(1).max(100000).default(1),
  pageSize: Joi.number().valid(25, 50, 100).default(25),
}).unknown(false);

function checked(schema: Joi.ObjectSchema, input: unknown): Record<string, unknown> {
  const parsed = schema.validate(input);
  if (parsed.error) throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
  return parsed.value as Record<string, unknown>;
}

@Injectable()
export class CustomerAdminService {
  constructor(
    private readonly repository: CustomerAdminRepository,
    private readonly clerk: ClerkClientService,
    private readonly config: PlatformConfigService,
  ) {}

  async read(
    principal: ClerkPrincipal,
    operation: 'list' | 'detail' | 'devices' | 'sessions-target',
    input: Record<string, unknown>,
  ) {
    try {
      const body =
        operation === 'list'
          ? checked(listSchema, input)
          : checked(
              Joi.object({ userId: Joi.string().trim().min(1).max(128).required() }).unknown(false),
              input,
            );
      const data = await this.repository.execute(principal, operation, body);
      if (operation === 'detail') {
        try {
          const identity = await this.clerk.getIdentityUser(String(body.userId));
          if (identity && identity.id !== body.userId) throw new ClerkProviderUnavailableError();
          data.verification = identity
            ? identity.primaryEmailVerified
              ? 'verified'
              : 'pending'
            : 'unknown';
        } catch (error) {
          if (!(error instanceof ClerkProviderUnavailableError)) throw error;
          data.verification = 'unknown';
        }
      }
      if (operation !== 'sessions-target') return data;
      const userId = String(body.userId);
      const sessions = await this.clerk.listCustomerSessions(userId);
      return {
        items: sessions.map((session) => ({
          id: customerSessionReference(userId, session.id),
          userId,
          deviceId: null,
          safeDeviceLabel: 'Session / جلسة',
          platform: null,
          coarseRegion: null,
          startedAt: session.createdAt.toISOString(),
          lastActivityAt: session.lastActiveAt.toISOString(),
          state: 'active',
          risk: 'unknown',
          isCurrentAdminVisibleSession: false,
          revokedAt: null,
        })),
        activeCount: sessions.length,
        expiredCount: null,
        revokedCount: null,
        region: {
          availability: sessions.length ? 'partial' : 'empty',
          message:
            'Active provider sessions only; historical expired/revoked sessions unavailable / الجلسات النشطة فقط؛ السجل السابق غير متاح',
        },
      };
    } catch (error) {
      return this.failure(error);
    }
  }

  async mutate(
    principal: ClerkPrincipal,
    operation: string,
    input: unknown,
    userId: string,
    key: string | undefined,
    deviceId?: string,
  ) {
    if (
      !isRecentClerkAuthentication(
        principal,
        this.config.get('MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS'),
      )
    )
      throw new HttpException({ code: 'RECENT_AUTH_REQUIRED' }, 403);
    const schema = Joi.object({
      reason: Joi.string().trim().min(5).max(200).required(),
      internalNote: Joi.string().trim().allow('').max(500),
      ...(operation === 'revoke-sessions'
        ? {
            scope: Joi.string().valid('all', 'selected').required(),
            sessionIds: Joi.array()
              .items(Joi.string().pattern(/^sess_[a-f0-9]{64}$/))
              .max(100)
              .unique()
              .required(),
          }
        : {}),
    }).unknown(false);
    const body = checked(schema, input);
    if (
      operation === 'revoke-sessions' &&
      (body.scope === 'all') !== ((body.sessionIds as string[]).length === 0)
    )
      throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
    if (
      !key ||
      key.length < 8 ||
      key.length > 255 ||
      !userId ||
      userId.length > 128 ||
      (deviceId && !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(deviceId))
    )
      throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
    try {
      const command = { ...body, userId, key, ...(deviceId ? { deviceId } : {}) };
      return await this.repository.execute(principal, operation, command);
    } catch (error) {
      return this.failure(error);
    }
  }

  private failure(error: unknown): never {
    if (error instanceof HttpException) throw error;
    const message = error instanceof Error ? error.message : '';
    const code = [
      'ADMIN_PERMISSION_DENIED',
      'ADMIN_CUSTOMER_LIFECYCLE_DENIED',
      'CUSTOMER_NOT_FOUND',
      'CUSTOMER_DEVICE_NOT_FOUND',
      'CUSTOMER_STATE_CONFLICT',
      'IDEMPOTENCY_CONFLICT',
      'VALIDATION_FAILED',
    ].find((value) => message.includes(value));
    if (code)
      throw new HttpException(
        { code },
        code.includes('DENIED')
          ? 403
          : code.includes('NOT_FOUND')
            ? 404
            : code === 'VALIDATION_FAILED'
              ? 400
              : 409,
      );
    throw new HttpException({ code: 'PROVIDER_UNAVAILABLE' }, 503);
  }
}
