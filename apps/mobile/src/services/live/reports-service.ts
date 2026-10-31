import { requestRecentAuthentication } from './http-client';
import { captureLiveClerkOwner } from './auth-service';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import { useAppShellStore } from '@/state/app-shell';
import { readLocalFinancialReport, type LocalReportFinance } from '@/services/local-financial-report';
import { usePreferenceStore } from '@/state/preferences';
import { currentLocale } from '@/localization/i18n';
import {
  available,
  money,
  resolveReportPeriod,
  unavailable,
  type FinancialReport,
  type CompletenessReason,
  type ReportBreakdown,
  type ReportOutputAttempt,
  type ReportPreview,
  type ReportSnapshot
} from '@/domain/reports';
import { emptyTransactionFilters } from '@/domain/core-finance';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import {
  reportsServiceCapability,
  type ReportsService
} from '@/services/contracts/reports-service';
import { ReportsRepository } from '@/storage/reports-repository';
import {
  captureLiveClerkIdentity,
  captureLiveReadClerkIdentity
} from './auth-service';
import {
  registerRuntimeIdentityReset,
  registerRuntimeUserDataReset
} from '@/storage/runtime-user-data-reset';
import {
  assertReadActive,
  withReadContext,
  type ReadContext
} from './read-context';
import { measurePerformance } from '../platform/performance-timing';

type Json = Record<string, unknown>;
type TokenProvider = () => Promise<string>;

export class ReportsApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function object(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ReportsApiError('reports_unavailable');
  return value as Json;
}
function exact(value: unknown, keys: readonly string[]): Json {
  const row = object(value);
  if (Object.keys(row).some((key) => !keys.includes(key)))
    throw new ReportsApiError('contract_mismatch');
  return row;
}
function integer(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new ReportsApiError('reports_unavailable');
  return parsed;
}
function epoch(value: unknown): number {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    throw new ReportsApiError('reports_unavailable');
  return Date.parse(value);
}

export function createLiveReportsService(
  options: {
    baseUrl?: string;
    token?: TokenProvider;
    request?: typeof fetch;
    repository?: ReportsRepository;
    requestTimeoutMs?: number;
    finance?: LocalReportFinance;
  } = {}
): CapabilityProviderHandle<ReportsService> {
  const baseUrl = options.baseUrl ?? process.env.EXPO_PUBLIC_API_URL ?? '';
  const token = options.token;
  const request = options.request ?? fetch;
  const local = options.repository ?? new ReportsRepository(false);
  const previews = new Map<string, ReportPreview>();
  const attempts = new Map<string, ReportOutputAttempt>();
  let currentSchedule: import('@/domain/reports').ReportSchedule | null = null;
  const reset = () => {
    currentSchedule = null;
    previews.clear();
    attempts.clear();
    local.reset();
  };
  registerRuntimeIdentityReset(reset);
  registerRuntimeUserDataReset(reset);

  const sendRequest = async (
    method: string,
    path: string,
    requestContext: {
      body?: unknown;
      key?: string;
      signal: AbortSignal;
      verifiedToken?: string;
      reverified?: boolean;
    }
  ): Promise<unknown> => {
    const { body, key, signal } = requestContext;
    if (!baseUrl) throw new ReportsApiError('reports_unavailable');
    let response: Response;
    let identity: Awaited<
      ReturnType<typeof captureLiveReadClerkIdentity>
    > | null = null;
    try {
      identity = token
        ? null
        : await measurePerformance(
            'reports.auth',
            method === 'GET'
              ? captureLiveReadClerkIdentity
              : captureLiveClerkIdentity
          );
      const sessionToken =
        requestContext.verifiedToken ??
        (token ? await token() : identity!.token);
      await identity?.assertCurrent();
      if (signal?.aborted) throw new ReportsApiError('offline');
      response = await measurePerformance('reports.read', () =>
        request(`${baseUrl.replace(/\/$/u, '')}${path}`, {
          method,
          signal,
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
            ...(key ? { 'Idempotency-Key': key } : {})
          },
          body: body === undefined ? undefined : JSON.stringify(body)
        })
      );
      await identity?.assertCurrent();
      assertReadActive(signal);
    } catch {
      throw new ReportsApiError('offline');
    }
    let value: unknown = null;
    try {
      if (response.status !== 204) value = await response.json();
    } catch {
      throw new ReportsApiError('contract_mismatch');
    }
    await identity?.assertCurrent();
    assertReadActive(signal);
    if (
      !response.ok &&
      response.status === 403 &&
      object(value).code === 'RECENT_AUTH_REQUIRED'
    ) {
      const pdfDownload = method === 'POST' && path === '/api/v1/reports' && body !== undefined && object(body).format === 'pdf' && object(body).delivery === 'download';
      const reportStatus = method === 'GET' && /^\/api\/v1\/reports\/[^/?]+$/.test(path);
      // A deployed policy mismatch needs the approved backend update, never a client bypass or prompt.
      if (pdfDownload || reportStatus) throw new ReportsApiError('report_pdf_policy_pending');
      if (!requestContext.reverified) {
        const freshToken = await requestRecentAuthentication();
        await identity?.assertCurrent();
        assertReadActive(signal);
        if (freshToken)
          return sendRequest(method, path, {
            ...requestContext,
            verifiedToken: freshToken,
            reverified: true
          });
      }
      throw new ReportsApiError('recent_auth_required');
    }
    if (!response.ok)
      throw new ReportsApiError(
        response.status === 401
          ? 'session_expired'
          : response.status === 403
          ? 'permission_required'
          : response.status === 404
            ? 'not_found'
            : response.status === 409
              ? 'conflict'
              : response.status === 410
                ? 'expired'
                : 'reports_unavailable'
      );
    return value;
  };

  const send = async (
    method: string,
    path: string,
    body?: unknown,
    key?: string
  ) => {
    const controller = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        sendRequest(method, path, { body, key, signal: controller.signal }),
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(
            () => {
              controller.abort();
              reject(new ReportsApiError('offline'));
            },
            Math.min(options.requestTimeoutMs ?? 15000, 15000)
          );
        })
      ]);
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  };

  const read = async (path: string, context?: ReadContext) => {
    try {
      return await withReadContext(
        {
          ...context,
          timeoutMs: Math.min(
            context?.timeoutMs ?? options.requestTimeoutMs ?? 15000,
            15000
          )
        },
        (signal) => sendRequest('GET', path, { signal })
      );
    } catch (error) {
      if (error instanceof ReportsApiError) throw error;
      throw new ReportsApiError('offline');
    }
  };

  const report = async (
    input: Parameters<ReportsService['getReport']>[0],
    context?: ReadContext
  ): Promise<FinancialReport> => {
    const response = exact(
      await read(
        `/api/v1/reports/summary?${new URLSearchParams({
          type: 'financial_summary',
          period: input.kind,
          anchorDate: input.anchorDate,
          ...(input.monthStartDay === undefined || input.monthStartDay === 1
            ? {}
            : { monthStartDay: String(input.monthStartDay) }),
          currency: input.currencyCode,
          ...(input.accountIds?.length
            ? { accountIds: [...new Set(input.accountIds)].sort().join(',') }
            : {})
        }).toString()}`,
        context
      ),
      ['metadata', 'summaries', 'breakdowns']
    );
    const metadata = exact(response.metadata, [
        'schemaVersion',
        'generatedAt',
        'ledgerVersion',
        'reportType',
        'period',
        'range',
        'dataState',
        'evidence'
      ]),
      range = exact(metadata.range, ['startDate', 'endDate', 'timezone']),
      summaries = Array.isArray(response.summaries)
        ? response.summaries.map((value) =>
            exact(value, [
              'income',
              'expense',
              'netCashFlow',
              'savingsRateBasisPoints',
              'transactionCount'
            ])
          )
        : (() => {
            throw new ReportsApiError('contract_mismatch');
          })();
    if (
      metadata.schemaVersion !== 1 ||
      metadata.reportType !== 'financial_summary' ||
      metadata.period !== input.kind ||
      !['complete', 'empty', 'partial', 'estimated'].includes(
        String(metadata.dataState)
      ) ||
      !Number.isSafeInteger(metadata.ledgerVersion) ||
      !Array.isArray(metadata.evidence)
    )
      throw new ReportsApiError('contract_mismatch');
    const selected =
      summaries.find(
        (item) =>
          exact(item.income, ['amountMinor', 'currency']).currency ===
          input.currencyCode
      ) ?? null;
    if (!selected && metadata.dataState !== 'empty')
      throw new ReportsApiError('contract_mismatch');
    const values = selected ?? {
      income: { amountMinor: 0, currency: input.currencyCode },
      expense: { amountMinor: 0, currency: input.currencyCode },
      netCashFlow: { amountMinor: 0, currency: input.currencyCode },
      savingsRateBasisPoints: 0,
      transactionCount: 0
    };
    const incomeValue = exact(values.income, ['amountMinor', 'currency']),
      expenseValue = exact(values.expense, ['amountMinor', 'currency']),
      netValue = exact(values.netCashFlow, ['amountMinor', 'currency']);
    if (
      incomeValue.currency !== input.currencyCode ||
      expenseValue.currency !== input.currencyCode ||
      netValue.currency !== input.currencyCode
    )
      throw new ReportsApiError('contract_mismatch');
    const income = integer(incomeValue.amountMinor),
      expense = integer(expenseValue.amountMinor),
      net = integer(netValue.amountMinor);
    const period = resolveReportPeriod({
      ...input,
      now: epoch(metadata.generatedAt)
    });
    if (range.timezone !== input.timeZone)
      throw new ReportsApiError('report_timezone_unavailable');
    if (
      range.startDate !== period.startDate ||
      range.endDate !== period.endDate
    )
      throw new ReportsApiError('report_range_mismatch');
    const key = `report:${input.kind}:${input.anchorDate}:${input.currencyCode}:${input.monthStartDay ?? 1}:${input.accountIds?.length ? [...new Set(input.accountIds)].sort().join(',') : 'all'}`;
    if (!Array.isArray(response.breakdowns))
      throw new ReportsApiError('contract_mismatch');
    const breakdowns = [
      categoryBreakdown(
        response.breakdowns,
        period,
        input.currencyCode,
        key,
        input.accountIds ?? []
      )
    ];
    const sourceReasons: CompletenessReason[] =
      metadata.dataState === 'partial' || metadata.dataState === 'estimated'
        ? ['source_incomplete']
        : [];
    const financialValue = (amountMinor: number) =>
      sourceReasons.length
        ? {
            status: 'incomplete' as const,
            value: money(amountMinor, input.currencyCode),
            reasons: sourceReasons
          }
        : available(money(amountMinor, input.currencyCode));
    const evidence = metadata.evidence.map((value) =>
      exact(value, ['kind', 'version', 'asOf'])
    );
    return {
      key,
      period,
      currencyCode: input.currencyCode,
      generatedAt: epoch(metadata.generatedAt),
      dataAsOf: epoch(evidence[0]?.asOf ?? metadata.generatedAt),
      dataState: metadata.dataState === 'empty' ? 'empty' : 'partial',
      completenessReasons: [...sourceReasons, 'unsupported_by_server'],
      summary: {
        income: financialValue(income),
        expense: financialValue(expense),
        netCashFlow: financialValue(net),
        savingsRateBasisPoints: sourceReasons.length
          ? {
              status: 'incomplete',
              value: integer(values.savingsRateBasisPoints),
              reasons: sourceReasons
            }
          : available(integer(values.savingsRateBasisPoints)),
        obligationPayments: unavailable('unsupported_by_server'),
        largestCategory: breakdowns[0]?.items[0]
          ? available(breakdowns[0].items[0])
          : unavailable('insufficient_history'),
        largestTransaction: unavailable('unsupported_by_server'),
        comparisons: []
      },
      breakdowns,
      insights: []
    };
  };

  const breakdown = (
    dimension: ReportBreakdown['dimension'],
    dataState: FinancialReport['dataState']
  ): ReportBreakdown => ({
    dimension,
    questionKey: `reports.${dimension}.question`,
    summaryKey: `reports.${dimension}.summary`,
    items: [],
    dataState
  });
  const snapshot = (
    value: FinancialReport,
    language: 'ar' | 'en',
    detailLevel: 'summary' | 'detailed'
  ): ReportSnapshot => ({
    period: value.period,
    generatedAt: value.generatedAt,
    dataAsOf: value.dataAsOf,
    language,
    currencyCode: value.currencyCode,
    detailLevel,
    dataState: value.dataState,
    notices: [],
    summary: value.summary,
    breakdowns: value.breakdowns,
    detailedRows: []
  });
  const attempt = (
    value: unknown,
    fallback?: ReportSnapshot | null,
    operationId = ''
  ): ReportOutputAttempt => {
    const row = exact(value, [
        'id',
        'attemptId',
        'scheduleId',
        'reportType',
        'format',
        'delivery',
        'status',
        'metadata',
        'ledgerVersion',
        'schemaVersion',
        'generatedAt',
        'requestedAt',
        'updatedAt',
        'completedAt',
        'expiresAt',
        'errorCode',
        'downloadUrl',
        'downloadUrlExpiresAt',
        'requestId'
      ]),
      status = String(row.status);
    if (
      ![
        'queued',
        'generating',
        'ready',
        'sending',
        'delivered',
        'failed',
        'expired'
      ].includes(status)
    )
      throw new ReportsApiError('contract_mismatch');
    const saved = attempts.get(String(row.id ?? row.attemptId));
    const format = row.format;
    if (format !== undefined && format !== 'pdf' && format !== 'csv' && format !== 'json')
      throw new ReportsApiError('contract_mismatch');
    const outputSnapshot = fallback ?? saved?.snapshot ?? null;
    if (
      row.downloadUrl !== undefined &&
      (typeof row.downloadUrl !== 'string' ||
        new URL(row.downloadUrl).protocol !== 'https:')
    )
      throw new ReportsApiError('contract_mismatch');
    return {
      id: String(row.id ?? row.attemptId),
      operationId,
      ...(format === 'pdf' || format === 'csv' || format === 'json' ? { format } : {}),
      scheduleId: typeof row.scheduleId === 'string' ? row.scheduleId : null,
      kind:
        typeof row.scheduleId === 'string'
          ? 'scheduled'
          : row.delivery === 'email'
            ? 'send_now'
            : 'download',
      status:
        status === 'ready'
          ? 'ready'
          : status === 'sending'
            ? 'sending'
            : status === 'delivered'
              ? 'sent'
              : status === 'failed' || status === 'expired'
                ? 'failed'
                : 'scheduled',
      snapshot: outputSnapshot,
      ...(typeof row.downloadUrl === 'string'
        ? {
            downloadUrl: row.downloadUrl,
            downloadUrlExpiresAt: epoch(row.downloadUrlExpiresAt)
          }
        : {}),
      retryOfAttemptId: null,
      failureCategory: status === 'failed' ? 'unknown' : null,
      requestedAt: epoch(row.requestedAt ?? row.generatedAt),
      completedAt:
        ['ready', 'delivered', 'failed', 'expired'].includes(status) &&
        (row.updatedAt ?? row.generatedAt)
          ? epoch(row.updatedAt ?? row.generatedAt)
          : null,
      scheduleStatusAtCompletion: null
    };
  };

  const schedule = (
    value: unknown
  ): import('@/domain/reports').ReportSchedule => {
    const row = exact(value, [
      'id',
      'scheduleId',
      'version',
      'reportType',
      'frequency',
      'timezone',
      'nextRunAt',
      'deliveryChannel',
      'recipientMasked',
      'recipient',
      'enabled',
      'lastRunAt',
      'createdAt',
      'updatedAt',
      'requestId'
    ]);
    if (
      row.reportType !== 'financial_summary' ||
      row.deliveryChannel !== 'email' ||
      !['monthly', 'three_months', 'half_year', 'annual'].includes(
        String(row.frequency)
      ) ||
      typeof row.timezone !== 'string' ||
      typeof row.enabled !== 'boolean' ||
      typeof row.id !== 'string'
    )
      throw new ReportsApiError('contract_mismatch');
    try {
      new Intl.DateTimeFormat('en', { timeZone: row.timezone });
    } catch {
      throw new ReportsApiError('contract_mismatch');
    }
    const recipient = typeof row.recipient === 'string' ? row.recipient : '';
    const next: import('@/domain/reports').ReportSchedule = {
      id: row.id,
      version: integer(row.version),
      status: row.enabled ? 'active' : 'paused',
      recipient: {
        normalizedEmail: recipient,
        status: recipient ? 'verified' : 'unverified',
        verifiedAt: null,
        failureCategory: null
      },
      frequency: row.frequency as import('@/domain/reports').ReportPeriodKind,
      language: currentLocale(),
      currencyCode: usePreferenceStore.getState().baseCurrencyCode,
      deliveryDay: 1,
      timeZone: row.timezone,
      includeAssistantSummary: false,
      detailLevel: 'summary',
      lastSuccessfulAttemptId: null,
      lastRunAt: row.lastRunAt ? epoch(row.lastRunAt) : null,
      nextDeliveryAt: row.enabled ? epoch(row.nextRunAt) : null,
      createdAt: epoch(row.createdAt),
      updatedAt: epoch(row.updatedAt)
    };
    currentSchedule = next;
    return next;
  };

  return {
    metadata: {
      id: 'phase10-reports-http',
      capability: reportsServiceCapability.capability,
      majorVersion: reportsServiceCapability.majorVersion,
      kind: 'live',
      availability: baseUrl ? 'available' : 'unavailable'
    },
    async getReport(input, context) {
      let offline = useAppShellStore.getState().session?.restoration === 'local';
      if (!offline && readRecoveryNetwork.available) {
        try { offline = !await readRecoveryNetwork.isOnline(); } catch { /* Unknown connectivity still uses the authorized API. */ }
      }
      if (offline) {
        const owner = await captureLiveClerkOwner();
        return readLocalFinancialReport(input, options.finance ?? coreFinanceService, owner, context?.signal);
      }
      return report(input, context);
    },
    async getBreakdown(input, context) {
      if (input.dimension !== 'category')
        throw new ReportsApiError('report_dimension_unavailable');
      const value = await report(input, context);
      return (
        value.breakdowns.find((item) => item.dimension === 'category') ??
        breakdown('category', value.dataState)
      );
    },
    async getSchedule(context) {
      const page = exact(
        await read('/api/v1/report-schedules?limit=1', context),
        ['items', 'nextCursor', 'requestId']
      );
      const item = Array.isArray(page.items) ? page.items[0] : undefined;
      if (item) return schedule(item);
      currentSchedule = null;
      return null;
    },
    async verifyRecipient(email, operationId) {
      const value = object(
        await send(
          'POST',
          '/api/v1/report-schedules/verify-recipient',
          { email },
          operationId
        )
      );
      return {
        value: {
          normalizedEmail: String(value.normalizedEmail),
          status: 'verified',
          verifiedAt: epoch(value.verifiedAt),
          failureCategory: null
        },
        affectedScopes: ['reports.schedule']
      };
    },
    async saveSchedule(input, expectedVersion, operationId) {
      if (
        input.deliveryDay !== 1 ||
        input.includeAssistantSummary ||
        input.detailLevel !== 'summary'
      )
        throw new ReportsApiError('report_schedule_settings_unavailable');
      const body = {
        reportType: 'financial_summary',
        frequency: input.frequency,
        timezone: input.timeZone,
        deliveryChannel: 'email',
        recipient: input.recipientEmail,
        enabled:
          !input.status ||
          input.status === 'active' ||
          input.status === 'verification_required'
      };
      if (expectedVersion !== null && !currentSchedule)
        await this.getSchedule();
      if (expectedVersion !== null && !currentSchedule)
        throw new ReportsApiError('not_found');
      const path =
        expectedVersion === null
          ? '/api/v1/report-schedules'
          : `/api/v1/report-schedules/${encodeURIComponent(currentSchedule!.id)}`;
      const value = schedule(
        await send(
          expectedVersion === null ? 'POST' : 'PATCH',
          path,
          expectedVersion === null ? body : { ...body, expectedVersion },
          operationId
        )
      );
      return { value, affectedScopes: ['reports.schedule'] };
    },
    async setScheduleStatus(status, expectedVersion, operationId) {
      if (!currentSchedule) await this.getSchedule();
      if (!currentSchedule) throw new ReportsApiError('not_found');
      const value = schedule(
        await send(
          'PATCH',
          `/api/v1/report-schedules/${encodeURIComponent(currentSchedule.id)}`,
          { expectedVersion, enabled: status === 'active' },
          operationId
        )
      );
      return { value, affectedScopes: ['reports.schedule'] };
    },
    saveScheduleDraft: (value) => local.saveDraft(value),
    loadScheduleDraft: () => local.loadDraft(),
    discardScheduleDraft: () => local.discardDraft(),
    async previewOutput(input, context) {
      const value = await report(input, context);
      const result = {
        previewId: `preview:${value.key}:${input.detailLevel}`,
        ...(input.accountIds?.length
          ? { accountIds: [...new Set(input.accountIds)].sort() }
          : {}),
        snapshot: snapshot(value, input.language, input.detailLevel),
        recipientEmail: input.recipientEmail ?? null
      };
      previews.set(result.previewId, result);
      return result;
    },
    async requestOutput(input, operationId) {
      if (input.kind === 'retry') {
        await send(
          'POST',
          `/api/v1/reports/${encodeURIComponent(input.previousAttemptId)}/retry-delivery`,
          undefined,
          operationId
        );
        const value = await this.getAttempt(input.previousAttemptId);
        return { value, affectedScopes: ['reports.attempts'] };
      }
      if (input.kind === 'scheduled')
        throw new ReportsApiError('reports_unavailable');
      const preview = previews.get(input.previewId);
      if (!preview) throw new ReportsApiError('stale_preview');
      const body = {
        type: 'financial_summary',
        currency: preview.snapshot.currencyCode,
        timezone: preview.snapshot.period.timeZone,
        ...(preview.accountIds?.length
          ? { accountIds: preview.accountIds }
          : {}),
        periodStart: preview.snapshot.period.startDate,
        periodEnd: preview.snapshot.period.endDate,
        format: 'pdf',
        delivery:
          input.kind === 'download' || input.kind === 'share'
            ? 'download'
            : 'email',
        recipient:
          input.kind === 'download' || input.kind === 'share'
            ? null
            : preview.recipientEmail
      };
      const accepted = object(
        await send('POST', '/api/v1/reports', body, operationId)
      );
      const value = attempt(accepted, preview.snapshot, operationId);
      attempts.set(value.id, value);
      await local.saveAttempt(value);
      return { value, affectedScopes: ['reports.attempts'] };
    },
    async getAttempt(id, context) {
      const saved = (await local.listAttempts()).find(
        (attempt) => attempt.id === id
      );
      const value = attempt(
        await read(`/api/v1/reports/${encodeURIComponent(id)}`, context),
        saved?.snapshot,
        saved?.operationId
      );
      attempts.set(id, value);
      await local.saveAttempt(value);
      return value;
    }
  };
}

function categoryBreakdown(
  values: unknown[],
  period: FinancialReport['period'],
  currencyCode: string,
  reportKey: string,
  accountIds: string[]
): ReportBreakdown {
  const items = values
    .map((value) =>
      exact(value, [
        'categoryId',
        'labelAr',
        'labelEn',
        'currencyCode',
        'expenseMinor',
        'transactionCount'
      ])
    )
    .filter((row) => row.currencyCode === currencyCode)
    .map((row) => ({
      id: String(row.categoryId),
      label: String(row.labelEn),
      value: available(money(integer(row.expenseMinor), currencyCode)),
      metricKind: 'category_spend' as const,
      transactionIds: [],
      transactionCount: integer(row.transactionCount),
      drillDown: {
        kind: 'transactions' as const,
        filters: {
          ...emptyTransactionFilters,
          accountIds,
          periodStart: period.startInstant,
          periodEnd: period.endExclusiveInstant - 1,
          categoryIds: [String(row.categoryId)]
        },
        returnContext: { reportKey, period, dimension: String(row.categoryId) }
      }
    }));
  return {
    dimension: 'category',
    questionKey: 'reports.chart.categories',
    summaryKey: 'reports.chart.categoriesSummary',
    items,
    dataState: items.length ? 'complete' : 'empty'
  };
}
