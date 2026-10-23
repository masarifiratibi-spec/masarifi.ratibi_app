import { createHash, createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

import { HttpException, Injectable } from '@nestjs/common';

import { isRecentClerkAuthentication, type ClerkPrincipal } from '../identity/clerk-auth.guard';
import { ClerkClientService, ClerkSessionIneligibleError } from '../identity/clerk-client.service';
import { hashNormalizedCommand } from '../ledger/idempotency';
import { PlatformConfigService } from '../platform/config/platform-config.service';
import { normalizeSupportScope } from './privacy-handlers';
import { ExportStorage } from './export-storage';
import {
  allowedBodyFields,
  allowedQueryFields,
  assertSafeTextFields,
  containsControlCharacter,
  inputObject,
} from './security.dto';
import { SecurityRepository } from './security.repository';
import { ImmediateDeletionService } from './immediate-deletion.service';

export interface SecurityOperation {
  operation: string;
  permission?: string;
  principal: ClerkPrincipal;
  body: unknown;
  query: Record<string, unknown>;
  params: Record<string, string>;
  requestId: string;
  idempotencyKey?: string;
  commandHash?: string;
  networkAddress?: string;
}

const mutationOperations = new Set([
  'disableAdmin',
  'revokeAdminSessions',
  'createAdminInvitation',
  'acceptAdminInvitation',
  'createRole',
  'updateRole',
  'assignAdminRole',
  'revokeAdminRole',
  'createSupportAccessRequest',
  'decideSupportAccessRequest',
  'revokeSupportAccess',
  'endSupportAccess',
  'decideMySupportAccessRequest',
  'createSecurityIncident',
  'updateSecurityIncident',
  'createMyPrivacyExport',
  'createMyDeletionRequest',
  'cancelMyDeletionRequest',
  'actOnPrivacyExport',
  'actOnDeletionRequest',
  'updateRetentionPolicy',
  'createRetentionHold',
  'releaseRetentionHold',
]);
const recentAuthOperations = new Set([
  'disableAdmin',
  'revokeAdminSessions',
  'createAdminInvitation',
  'acceptAdminInvitation',
  'createRole',
  'updateRole',
  'assignAdminRole',
  'revokeAdminRole',
  'decideSupportAccessRequest',
  'revokeSupportAccess',
  'decideMySupportAccessRequest',
  'createSecurityIncident',
  'updateSecurityIncident',
  'createMyPrivacyExport',
  'createMyDeletionRequest',
  'actOnPrivacyExport',
  'actOnDeletionRequest',
  'updateRetentionPolicy',
  'createRetentionHold',
  'releaseRetentionHold',
  'listPrivacyExports',
  'listDeletionRequests',
  'listRetentionPolicies',
]);
const safeKey = /^[A-Za-z0-9._:-]{8,128}$/;
const requiredReasonOperations = new Set([
  'disableAdmin',
  'revokeAdminSessions',
  'createRole',
  'updateRole',
  'assignAdminRole',
  'revokeAdminRole',
  'decideSupportAccessRequest',
  'revokeSupportAccess',
  'updateSecurityIncident',
  'actOnPrivacyExport',
  'actOnDeletionRequest',
  'updateRetentionPolicy',
  'createRetentionHold',
  'releaseRetentionHold',
]);
const rateLimits: Readonly<Record<string, { limit: number; windowSeconds: number }>> = {
  rbac: { limit: 60, windowSeconds: 60 },
  invitations: { limit: 10, windowSeconds: 3600 },
  support: { limit: 30, windowSeconds: 60 },
  evidence: { limit: 120, windowSeconds: 60 },
  privacy: { limit: 10, windowSeconds: 3600 },
  deletion: { limit: 6, windowSeconds: 3600 },
  retention: { limit: 20, windowSeconds: 3600 },
  incidents: { limit: 30, windowSeconds: 3600 },
};

function rateCategory(operation: string): string {
  if (operation.includes('Invitation')) return 'invitations';
  if (operation.includes('Support')) return 'support';
  if (
    operation.includes('Audit') ||
    operation.includes('SecurityEvent') ||
    operation === 'getSecurityOverview'
  )
    return 'evidence';
  if (operation.includes('Incident')) return 'incidents';
  if (operation.includes('Deletion')) return 'deletion';
  if (operation.includes('PrivacyExport')) return 'privacy';
  if (operation.includes('Retention')) return 'retention';
  return 'rbac';
}

function hashNetworkAddress(address: string | undefined, keyRing: string): string | null {
  const normalized = address
    ?.trim()
    .toLowerCase()
    .replace(/^::ffff:/, '');
  if (!normalized || isIP(normalized) === 0) return null;
  const [active] = keyRing.split(',');
  const separator = active?.indexOf(':') ?? -1;
  if (!active || separator < 1) return null;
  const keyId = active.slice(0, separator);
  const key = Buffer.from(active.slice(separator + 1), 'base64url');
  return `h1:${keyId}:${createHmac('sha256', key).update(normalized).digest('hex')}`;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeReference(value: unknown, kind: string): unknown {
  if (typeof value !== 'string') return value;
  return { id: value, kind, label: `${kind} ${value.slice(-6)}` };
}

function safeFields(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.slice(0, 40);
  return Object.entries(record(value))
    .slice(0, 40)
    .map(([key, field]) => ({
      key: key.replace(/[^A-Za-z0-9]/g, '').slice(0, 64) || 'value',
      label: key.slice(0, 120),
      value: ['string', 'number', 'boolean'].includes(typeof field) ? field : null,
    }));
}

function retainedCategories(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === 'string').slice(0, 100);
  const outcomes = record(value).outcomes;
  if (!Array.isArray(outcomes)) return [];
  return outcomes
    .flatMap((item) => {
      const outcome = record(item);
      return typeof outcome.resourceType === 'string' && Number(outcome.retainedCount) > 0
        ? [outcome.resourceType]
        : [];
    })
    .slice(0, 100);
}

function projectRecord(operation: string, value: unknown): Record<string, unknown> {
  const result = { ...record(value) };
  if (operation === 'disableAdmin') {
    result.roleKeys ??= [];
    result.mfaStatus ??= 'unknown';
    result.activeSessionCount ??= 0;
  }
  if (['listRoles', 'getRole', 'createRole', 'updateRole'].includes(operation)) {
    result.assignmentCount ??= 0;
  }
  if (operation.includes('SupportAccessRequest')) {
    if ('userId' in result) {
      result.user = safeReference(result.userId, 'customer');
      delete result.userId;
    }
    result.requester = safeReference(result.requester, 'admin');
    result.assignee = safeReference(result.assignee, 'admin');
  }
  if (operation.includes('SecurityIncident')) result.timeline ??= [];
  if (operation.includes('SecurityEvent')) result.safeMetadata = safeFields(result.safeMetadata);
  if (operation.includes('AuditEvent')) {
    result.actor = safeReference(
      result.actor,
      typeof result.actorType === 'string' ? result.actorType : 'actor',
    );
    result.result ??= 'success';
    result.safeMetadata = safeFields(result.safeMetadata);
  }
  if (operation.includes('DeletionRequest')) {
    result.retainedCategories = retainedCategories(result.retainedCategories);
    if (['createMyDeletionRequest', 'getMyDeletionRequest'].includes(operation))
      delete result.errorCode;
  }
  return result;
}

function projectResult(operation: string, value: unknown): unknown {
  const page = record(value);
  if (Array.isArray(page.items)) {
    return { ...page, items: page.items.map((item) => projectRecord(operation, item)) };
  }
  return projectRecord(operation, value);
}

@Injectable()
export class SecurityService {
  constructor(
    private readonly repository: SecurityRepository,
    private readonly config: PlatformConfigService,
    private readonly clerk: ClerkClientService,
    private readonly storage: ExportStorage,
    private readonly worker: ImmediateDeletionService,
  ) {}

  async execute(input: SecurityOperation): Promise<unknown> {
    const body = { ...inputObject(input.body) };
    const commandHash = hashNormalizedCommand({ operation: input.operation, body, params: input.params });
    assertSafeTextFields(body);
    const category = rateCategory(input.operation);
    const rate = rateLimits[category];
    const ipHash = input.networkAddress
      ? hashNetworkAddress(
          input.networkAddress,
          this.config.getRequired('MASARIFI_SECURITY_IP_HASH_KEYS'),
        )
      : null;
    let rateAllowed = false;
    try {
      rateAllowed = Boolean(
        rate &&
        (await this.repository.consumeRateLimit(
          input.principal,
          category,
          rate.limit,
          rate.windowSeconds,
          ipHash,
        )),
      );
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null
          ? (error as { code?: unknown }).code
          : undefined;
      if (code === '28000' || code === '42501') throw new HttpException({ code: 'FORBIDDEN' }, 403);
      throw new HttpException({ code: 'SECURITY_OPERATION_FAILED' }, 503);
    }
    if (!rateAllowed) {
      throw new HttpException({ code: 'RATE_LIMITED', retryAfter: rate?.windowSeconds ?? 60 }, 429);
    }
    const allowedQuery = allowedQueryFields[input.operation] ?? [];
    if (
      Object.keys(input.query).length > 12 ||
      Object.entries(input.query).some(
        ([key, value]) =>
          !allowedQuery.includes(key) ||
          typeof value !== 'string' ||
          value.length < 1 ||
          value.length > 512 ||
          containsControlCharacter(value),
      )
    ) {
      throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
    }
    const allowed = allowedBodyFields[input.operation];
    if (allowed && Object.keys(body).some((key) => !allowed.includes(key))) {
      throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
    }
    if (
      mutationOperations.has(input.operation) &&
      (!input.idempotencyKey || !safeKey.test(input.idempotencyKey))
    ) {
      throw new HttpException({ code: 'IDEMPOTENCY_KEY_REQUIRED' }, 400);
    }
    const sessionDeletionOwner = this.config.get('MASARIFI_STAGING_SELF_DELETION_OWNER_ID');
    if (
      sessionDeletionOwner &&
      input.operation === 'createMyDeletionRequest' &&
      sessionDeletionOwner !== input.principal.userId
    )
      throw new HttpException({ code: 'FORBIDDEN' }, 403);
    const scopedSessionDeletion =
      input.operation === 'createMyDeletionRequest' &&
      this.config.get('MASARIFI_PROCESS_KIND') === 'api' &&
      this.config.get('SUPABASE_URL') === 'https://qcffvfbpzvpwcwxwjyro.supabase.co' &&
      this.config.get('MASARIFI_DELETION_COOLING_OFF_HOURS') === 0 &&
      (this.config.get('MASARIFI_STAGING_SELF_DELETION_ENABLED') === true ||
        sessionDeletionOwner === input.principal.userId);
    if (recentAuthOperations.has(input.operation) && !scopedSessionDeletion) {
      this.assertRecentAuth(input.principal);
    }
    if (requiredReasonOperations.has(input.operation) || body.reason !== undefined) {
      const reason = body.reason;
      if (
        typeof reason !== 'string' ||
        reason.trim() !== reason ||
        reason.length < 10 ||
        reason.length > 500 ||
        containsControlCharacter(reason)
      ) {
        throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
      }
    }
    if ('resourceScopes' in body) {
      try {
        body.resourceScopes = normalizeSupportScope(
          body.resourceScopes as Array<{ resource: string; actions: string[] }>,
        );
      } catch {
        throw new HttpException({ code: 'INVALID_SCOPE' }, 400);
      }
    }
    if ('approvedScope' in body) {
      try {
        body.approvedScope = normalizeSupportScope(
          body.approvedScope as Array<{ resource: string; actions: string[] }>,
        );
      } catch {
        throw new HttpException({ code: 'INVALID_SCOPE' }, 400);
      }
    }
    if (input.operation === 'createMyPrivacyExport') {
      const manifest = this.config.getRequired('MASARIFI_PRIVACY_HANDLER_MANIFEST');
      const scope = body.scope ?? manifest;
      if (
        !Array.isArray(scope) ||
        scope.length < 1 ||
        scope.length > manifest.length ||
        scope.some((entry) => typeof entry !== 'string' || !manifest.includes(entry)) ||
        new Set(scope).size !== scope.length
      ) {
        throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
      }
      body.scope = scope;
    }
    if (input.operation === 'disableAdmin' && body.revokeEligibleSessions !== true) {
      throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
    }
    if (input.operation === 'revokeAdminSessions') {
      const ids = body.sessionIds;
      if (
        typeof body.revokeAllEligible !== 'boolean' ||
        (ids !== undefined &&
          (!Array.isArray(ids) ||
            ids.length < 1 ||
            ids.length > 100 ||
            ids.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 255) ||
            new Set(ids).size !== ids.length)) ||
        (!body.revokeAllEligible && ids === undefined)
      ) {
        throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
      }
    }
    if (input.operation === 'createMyDeletionRequest') {
      body.coolingOffHours = this.config.getRequired('MASARIFI_DELETION_COOLING_OFF_HOURS');
      if (body.coolingOffHours === 0 || body.completionToken !== undefined) {
        if (
          typeof body.completionToken !== 'string' ||
          !/^[0-9a-f]{64}$/.test(body.completionToken) ||
          !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.idempotencyKey ?? '')
        )
          throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
        body.completionTokenHash = createHash('sha256').update(body.completionToken).digest('hex');
        delete body.completionToken;
      }
    }
    if (input.operation === 'acceptAdminInvitation') {
      const token = body.token;
      if (typeof token !== 'string' || token.length < 32 || token.length > 512) {
        throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
      }
      const identity = await this.clerk.getIdentityUser(input.principal.userId);
      if (
        !identity?.primaryEmail ||
        !identity.primaryEmailVerified ||
        identity.banned ||
        identity.locked
      )
        throw new HttpException({ code: 'VERIFIED_EMAIL_REQUIRED' }, 403);
      body.tokenHash = `h1:${createHash('sha256').update(token).digest('hex')}`;
      body.verifiedEmail = identity.primaryEmail;
      delete body.token;
    }
    try {
      if (['createAdminInvitation', 'revokeAdminSessions', 'disableAdmin'].includes(input.operation)) {
        return await this.executeProviderMutation({ ...input, body, commandHash });
      }
      const result = projectResult(
        input.operation,
        await this.repository.execute({ ...input, body, commandHash }),
      );
      if (input.operation === 'createMyDeletionRequest' && body.coolingOffHours === 0) {
        const deletionId = record(result).id;
        if (typeof deletionId !== 'string') throw new Error('DELETION_REQUEST_INVALID');
        // The creation transaction has committed; completion can revoke this request's session.
        return projectResult(
          input.operation,
          await this.worker.runDeletionRequestForOwner(input.principal.userId, deletionId),
        );
      }
      if (input.operation === 'getAdminSelf') {
        return {
          ...record(result),
          activeSessionCount: await this.clerk.countActiveSessions(input.principal.userId),
          mfaStatus: input.principal.mfaAgeSeconds == null ? 'missing' : 'enabled',
        };
      }
      if (
        input.operation === 'getMyPrivacyExport' &&
        typeof result === 'object' &&
        result !== null &&
        (result as { status?: unknown }).status === 'ready'
      ) {
        this.assertRecentAuth(input.principal);
        const exportId = input.params.exportId;
        if (!exportId) throw new HttpException({ code: 'NOT_FOUND' }, 404);
        const reference = await this.repository.getReadyExportReference(input.principal, exportId);
        if (!reference) throw new HttpException({ code: 'NOT_FOUND' }, 404);
        const seconds = this.config.getRequired('MASARIFI_EXPORT_SIGNED_URL_SECONDS');
        return {
          ...result,
          basename: 'masarifi-privacy-export.zip',
          mediaType: 'application/zip',
          downloadUrl: await this.storage.sign(reference, seconds),
          downloadUrlExpiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
        };
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const code =
        typeof error === 'object' && error !== null
          ? (error as { code?: unknown }).code
          : undefined;
      const message =
        typeof error === 'object' && error !== null
          ? (error as { message?: unknown }).message
          : undefined;
      if (message === 'SYSTEM_ROLE_PROTECTED' || code === 'SYSTEM_ROLE_PROTECTED')
        throw new HttpException({ code: 'SYSTEM_ROLE_PROTECTED' }, 409);
      if (message === 'LAST_SUPER_ADMIN_REQUIRED')
        throw new HttpException({ code: 'LAST_SUPER_ADMIN' }, 409);
      if (
        message === 'SUPER_ADMIN_TARGET_REQUIRES_SUPER_ADMIN' ||
        code === 'SUPER_ADMIN_TARGET_REQUIRES_SUPER_ADMIN'
      )
        throw new HttpException({ code: 'SUPER_ADMIN_REQUIRED' }, 403);
      if (message === 'SUPPORT_GRANT_INVARIANT_INVALID')
        throw new HttpException({ code: 'SCOPE_WIDENING' }, 409);
      if (message === 'SUPPORT_GRANT_DENIED')
        throw new HttpException({ code: 'SCOPE_FORBIDDEN' }, 403);
      if (message === 'INVITATION_ACCEPTANCE_DENIED')
        throw new HttpException({ code: 'INVITATION_INVALID' }, 403);
      if (message === 'RETENTION_HOLD_OVERLAP')
        throw new HttpException({ code: 'ACTIVE_HOLD_EXISTS' }, 409);
      if (code === 'ACTIVE_ASSIGNMENTS_EXIST')
        throw new HttpException({ code: 'ACTIVE_ASSIGNMENTS_EXIST' }, 409);
      if (code === '23505') throw new HttpException({ code: 'CONFLICT' }, 409);
      if (code === 'PROVIDER_UNAVAILABLE')
        throw new HttpException({ code: 'PROVIDER_UNAVAILABLE' }, 503);
      if (code === 'IDEMPOTENCY_IN_PROGRESS')
        throw new HttpException({ code: 'IDEMPOTENCY_IN_PROGRESS' }, 409);
      if (code === 'IDEMPOTENCY_KEY_REUSED')
        throw new HttpException({ code: 'IDEMPOTENCY_KEY_REUSED' }, 409);
      if (code === '22023' || code === '22P02' || code === '23514')
        throw new HttpException({ code: 'VALIDATION_FAILED' }, 400);
      if (code === '42501') throw new HttpException({ code: 'FORBIDDEN' }, 403);
      if (code === 'STALE_VERSION' || (code === 'P0002' && 'expectedVersion' in body))
        throw new HttpException({ code: 'STALE_VERSION' }, 409);
      if (code === 'INVALID_TRANSITION')
        throw new HttpException({ code: 'INVALID_TRANSITION' }, 409);
      if (code === 'P0002') throw new HttpException({ code: 'NOT_FOUND' }, 404);
      if (code === 'INVALID_CURSOR') throw new HttpException({ code: 'INVALID_CURSOR' }, 400);
      throw new HttpException({ code: 'SECURITY_OPERATION_FAILED' }, 503);
    }
  }

  private async executeProviderMutation(input: SecurityOperation & { body: Record<string, unknown> }): Promise<unknown> {
    let deliveryToken: string | undefined;
    const mutation = await this.repository.executeProviderMutation(input, () => {
      if (input.operation !== 'createAdminInvitation') return input.body;
      deliveryToken = randomBytes(32).toString('base64url');
      return { ...input.body, tokenHash: `h1:${createHash('sha256').update(deliveryToken).digest('hex')}` };
    });
    if (mutation.outcome === 'completed') return mutation.value;
    let result = projectResult(input.operation, mutation.value);
    try {
      if (input.operation === 'createAdminInvitation') {
        await this.clerk.deliverAdminInvitation(input.body.email as string, deliveryToken!);
      } else {
        const sessionIds = input.operation === 'revokeAdminSessions' && !input.body.revokeAllEligible
          ? input.body.sessionIds as string[] : undefined;
        const sessionReferences = await this.clerk.revokeUserSessions(input.params.userId!, sessionIds);
        if (input.operation === 'revokeAdminSessions') result = { sessionReferences, version: record(result).version };
      }
    } catch (error) {
      // An ambiguous external effect is terminal for this key; retries must not affect later sessions.
      await this.repository.finishProviderMutation(input, 'failed', null);
      if (input.operation === 'createAdminInvitation') {
        await this.repository.revokeUndeliveredInvitation(input.principal, record(result).id as string, input.requestId);
      }
      if (error instanceof ClerkSessionIneligibleError) throw new HttpException({ code: 'INELIGIBLE_SESSION' }, 409);
      throw new HttpException({ code: 'PROVIDER_UNAVAILABLE' }, 503);
    }
    await this.repository.finishProviderMutation(input, 'completed', result);
    return result;
  }

  private assertRecentAuth(principal: ClerkPrincipal): void {
    if (
      !isRecentClerkAuthentication(
        principal,
        this.config.getRequired('MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS'),
      )
    ) {
      throw new HttpException({ code: 'RECENT_AUTH_REQUIRED' }, 403);
    }
  }
}
