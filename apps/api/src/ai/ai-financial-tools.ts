import { HttpException, Injectable } from '@nestjs/common';
import type { ClerkPrincipal } from '../identity/clerk-auth.guard';
import { LedgerService } from '../ledger/ledger.service';
import { PlanningService } from '../planning/planning.service';
import { ReportsService } from '../reports/reports.service';
import { localDateAt, zonedDateTimeToInstant } from '../reports/reports.period';
import type { ReportsSummaryResponse } from '../reports/reports.repository';
import type { AssistantContextScope, AssistantIntent } from './ai-routing';
import { resolveAssistantContext, type ResolvedAssistantContext } from './assistant-context';

export interface FinancialToolResult {
  answer: string | null;
  context: Record<string, unknown>;
  evidence: Array<{ kind: string; version: number; asOf?: string }>;
}

@Injectable()
export class AssistantFinancialTools {
  constructor(
    private readonly reports: ReportsService,
    private readonly planning: PlanningService,
    private readonly ledger: LedgerService,
  ) {}
  async getOwnerTimezone(principal: ClerkPrincipal): Promise<string> {
    return (await this.reports.getAssistantContext(principal)).timezone;
  }
  async resolve(
    principal: ClerkPrincipal,
    intent: AssistantIntent,
    question: string,
    requestId: string,
    contextScope: readonly AssistantContextScope[],
    previousQuestion?: string,
  ): Promise<FinancialToolResult> {
    if (intent === 'general_finance')
      return {
        answer: null,
        context: { responseLocale: /[\u0600-\u06ff]/u.test(question) ? 'ar' : 'en' },
        evidence: [],
      };
    if (
      intent === 'resolve_tracking_review' ||
      intent.startsWith('create_') ||
      intent.startsWith('update_') ||
      intent === 'record_obligation_payment'
    )
      return {
        answer: null,
        context: {
          responseLocale: /[\u0600-\u06ff]/u.test(question) ? 'ar' : 'en',
          timezone: await this.getOwnerTimezone(principal),
        },
        evidence: [],
      };
    const owner = await this.reports.getAssistantContext(principal);
    const resolved = resolveAssistantContext(question, owner.timezone);
    if (previousQuestion) {
      const previous = resolveAssistantContext(previousQuestion, owner.timezone);
      if (
        !/month|week|year|الشهر|شهر|أسبوع|اسبوع|سنة|عام|20\d{2}|يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر/iu.test(
          question,
        )
      ) {
        resolved.startDate = previous.startDate;
        resolved.endDate = previous.endDate;
      }
      if (!resolved.currency && !resolved.clarification) resolved.currency = previous.currency;
      if (['category_breakdown', 'budget_status', 'savings_status'].includes(intent))
        question = `${previousQuestion} ${question}`;
    }
    if (resolved.clarification) return unavailable(resolved, resolved.clarification);
    let result: FinancialToolResult;
    if (['spending_summary', 'income_summary', 'category_breakdown'].includes(intent)) {
      if (!contextScope.includes('recent_transactions')) return unavailable(resolved);
      result = reportResult(
        await this.reports.getAssistantSummary(principal, resolved, requestId),
        intent,
        question,
        resolved,
      );
    } else if (
      [
        'budget_status',
        'savings_status',
        'salary_status',
        'obligations_status',
        'upcoming_obligations',
        'purchase_affordability',
      ].includes(intent)
    ) {
      const required = ['obligations_status', 'upcoming_obligations'].includes(intent)
        ? 'obligations'
        : ['salary_status', 'purchase_affordability'].includes(intent)
          ? 'accounts_summary'
          : 'budgets';
      if (
        !contextScope.includes(required) ||
        (intent === 'purchase_affordability' && !contextScope.includes('obligations'))
      )
        return unavailable(resolved);
      // Planning's owner summary is monthly; never relabel it as an arbitrary period.
      const end = new Date(`${resolved.startDate}T00:00:00Z`);
      end.setUTCMonth(end.getUTCMonth() + 1);
      end.setUTCDate(0);
      if (
        !resolved.startDate.endsWith('-01') ||
        resolved.endDate !== end.toISOString().slice(0, 10)
      )
        return unavailable(resolved, 'planning_period_unsupported');
      if (
        ['savings_status', 'obligations_status', 'upcoming_obligations'].includes(intent) &&
        resolved.startDate.slice(0, 7) !== localDateAt(new Date(), resolved.timezone).slice(0, 7)
      )
        return unavailable(resolved, 'historical_state_unavailable');
      const summary = planningRecord(
        await this.planning.getPlanningSummary(
          principal,
          { period: resolved.startDate.slice(0, 7) },
          requestId,
        ),
      );
      if (intent === 'salary_status' && typeof record(summary.salary).currencyCode === 'string') {
        // Planning date casts use database timezone; confirmed income needs owner-local Reports boundaries.
        const report = await this.reports.getAssistantSummary(principal, resolved, requestId);
        checkReport(report);
        const salary = record(summary.salary);
        const income = report.summaries.find((item) => item.income.currency === salary.currencyCode)
          ?.income.amountMinor;
        if (income === undefined && report.metadata.dataState !== 'empty')
          return unavailable(resolved, 'salary_currency_missing');
        result = planningResult(
          { ...summary, salary: { ...salary, actualIncomeMinor: exact(income ?? 0).toString() } },
          intent,
          question,
          resolved,
        );
        result.evidence = [...evidence(summary), ...report.metadata.evidence];
      } else if (intent === 'purchase_affordability') {
        // Salary cash flow is not spendable liquidity. Do not fabricate an available balance.
        result = unavailable(resolved, 'liquidity_incomplete');
        result.context.purchasePriceMinor = resolved.purchasePriceMinor;
        result.context.currency = resolved.currency;
        result.context.liquidityAvailable = false;
        result.evidence = evidence(summary);
      } else result = planningResult(summary, intent, question, resolved);
    } else if (intent === 'recent_transactions' || intent === 'transaction_search') {
      if (!contextScope.includes('recent_transactions')) return unavailable(resolved);
      if (intent === 'transaction_search' || resolved.currency)
        return unavailable(resolved, 'transaction_scope_required');
      const end = new Date(`${resolved.endDate}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      const response = record(
        await this.ledger.listTransactions(
          principal,
          {
            limit: 10,
            status: 'confirmed',
            from: zonedDateTimeToInstant(
              resolved.startDate,
              '00:00',
              resolved.timezone,
            ).toISOString(),
            to: new Date(
              zonedDateTimeToInstant(
                end.toISOString().slice(0, 10),
                '00:00',
                resolved.timezone,
              ).valueOf() - 1,
            ).toISOString(),
          },
          requestId,
        ),
      );
      const items = records(response.items);
      result = {
        answer:
          resolved.locale === 'en'
            ? items.length
              ? `${items.length.toString()} recent confirmed transactions in the requested period (up to 10).`
              : 'No recent confirmed transactions in the requested period.'
            : items.length
              ? `لديك ${items.length.toString()} معاملات حديثة مؤكدة في الفترة المطلوبة (حتى 10).`
              : 'لا توجد معاملات حديثة مؤكدة في الفترة المطلوبة.',
        context: { recentTransactions: items, hasMore: Boolean(response.nextCursor) },
        evidence: [{ kind: 'ledger', version: version(response.ledgerVersion) }],
      };
    } else {
      const context: Record<string, unknown> = {
        responseLocale: resolved.locale,
        resolvedPeriod: resolved,
      };
      const refs: FinancialToolResult['evidence'] = [];
      if (contextScope.includes('recent_transactions')) {
        const current = await this.reports.getAssistantSummary(principal, resolved, requestId);
        checkReport(current);
        context.report = { summaries: current.summaries, categories: current.breakdowns };
        refs.push(...current.metadata.evidence);
        if (intent === 'period_comparison') {
          if (!resolved.startDate.endsWith('-01'))
            return unavailable(resolved, 'comparison_period_required');
          const start = new Date(`${resolved.startDate}T00:00:00Z`);
          const end = new Date(start.valueOf() - 86400000);
          start.setUTCMonth(start.getUTCMonth() - 1);
          const previous = await this.reports.getAssistantSummary(
            principal,
            {
              ...resolved,
              startDate: start.toISOString().slice(0, 10),
              endDate: end.toISOString().slice(0, 10),
            },
            requestId,
          );
          checkReport(previous);
          context.current = context.report;
          delete context.report;
          context.previous = { summaries: previous.summaries, categories: previous.breakdowns };
          refs.push(...previous.metadata.evidence);
        }
      }
      if (
        contextScope.some((scope) => ['accounts_summary', 'budgets', 'obligations'].includes(scope))
      ) {
        const monthEnd = new Date(`${resolved.startDate.slice(0, 7)}-01T00:00:00Z`);
        monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
        monthEnd.setUTCDate(0);
        if (
          !resolved.startDate.endsWith('-01') ||
          resolved.endDate !== monthEnd.toISOString().slice(0, 10)
        )
          return unavailable(resolved, 'planning_period_unsupported');
        if (
          resolved.startDate.slice(0, 7) !== localDateAt(new Date(), resolved.timezone).slice(0, 7)
        )
          return unavailable(resolved, 'historical_state_unavailable');
        const planning = planningRecord(
          await this.planning.getPlanningSummary(
            principal,
            { period: resolved.startDate.slice(0, 7) },
            requestId,
          ),
        );
        context.planning = {
          ...(contextScope.includes('accounts_summary')
            ? { salary: planning.salary, liquidityAvailable: false }
            : {}),
          ...(contextScope.includes('budgets')
            ? { budgets: planning.budgets, savings: planning.savings }
            : {}),
          ...(contextScope.includes('obligations') ? { obligations: planning.obligations } : {}),
        };
        refs.push(...evidence(planning));
      }
      result = { answer: null, context, evidence: refs };
    }
    const totals = records(result.context.totals ?? record(result.context.category).totals);
    const values: Array<{ key: string; minor: string; currency: string; status: 'available' }> =
      totals.map((total) => ({
        key: intent,
        minor: String(total.amountMinor),
        currency: String(total.currency),
        status: 'available' as const,
      }));
    const salary = record(result.context.salary);
    if (typeof salary.currency === 'string')
      values.push({
        key: 'salary.actualIncomeMinor',
        minor: exact(salary.actualIncomeMinor).toString(),
        currency: salary.currency,
        status: 'available',
      });
    for (const [index, item] of [
      ...records(result.context.budgets),
      ...records(result.context.savings),
    ].entries()) {
      for (const key of ['remainingMinor', 'progressMinor', 'targetMinor']) {
        if (item[key] !== undefined && typeof item.currency === 'string')
          values.push({
            key: `${intent}.${index.toString()}.${key}`,
            minor: exact(item[key]).toString(),
            currency: item.currency,
            status: 'available',
          });
      }
    }
    result.context.assistantMetadata = {
      schemaVersion: 1,
      locale: resolved.locale,
      timezone: resolved.timezone,
      startDate: resolved.startDate,
      endDate: resolved.endDate,
      currencies: [...new Set(values.map((entry) => entry.currency))],
      responseType: result.context.missingDataReason
        ? 'missing'
        : result.answer === null
          ? 'estimate'
          : 'fact',
      generatedAt: new Date().toISOString(),
      values,
      reasons: result.context.missingDataReason ? [result.context.missingDataReason] : [],
    };
    return result;
  }
}

function reportResult(
  report: ReportsSummaryResponse,
  intent: AssistantIntent,
  question: string,
  resolved: ResolvedAssistantContext,
): FinancialToolResult {
  checkReport(report);
  if (intent === 'category_breakdown') {
    let selected = report.breakdowns.filter(
      (item) => includesName(question, item.labelAr) || includesName(question, item.labelEn),
    );
    const largest = /biggest|largest|highest|أكبر|اكبر|أعلى/iu.test(question);
    if (!selected.length && largest) {
      const maximumByCurrency = new Map<string, bigint>();
      for (const item of report.breakdowns) {
        const amount = exact(item.expenseMinor);
        if (amount > (maximumByCurrency.get(item.currencyCode) ?? 0n))
          maximumByCurrency.set(item.currencyCode, amount);
      }
      selected = report.breakdowns.filter(
        (item) =>
          exact(item.expenseMinor) > 0n &&
          exact(item.expenseMinor) === maximumByCurrency.get(item.currencyCode),
      );
    }
    const category = selected[0];
    if (!category || (!largest && new Set(selected.map((item) => item.categoryId)).size > 1))
      return unavailable(resolved, 'entity_required');
    const totals = selected.map((item) => ({
      currency: item.currencyCode,
      amountMinor: exact(item.expenseMinor).toString(),
    }));
    const name = [
      ...new Set(selected.map((item) => (resolved.locale === 'ar' ? item.labelAr : item.labelEn))),
    ].join(' / ');
    return {
      answer: `${selected.map((item) => `${resolved.locale === 'ar' ? item.labelAr : item.labelEn}: ${money(exact(item.expenseMinor).toString(), item.currencyCode, resolved.locale)}`).join(' / ')} (${resolved.startDate} – ${resolved.endDate}).`,
      context: {
        category: {
          name,
          totals,
        },
      },
      evidence: report.metadata.evidence,
    };
  }
  const net = /net (?:result|income|cash flow)|صافي (?:الدخل|النتيجة|التدفق)/iu.test(question);
  const totals = report.summaries.map((summary) => {
    const amount = net
      ? summary.netCashFlow
      : intent === 'income_summary'
        ? summary.income
        : summary.expense;
    return { amountMinor: exact(amount.amountMinor).toString(), currency: amount.currency };
  });
  if (!totals.length) return unavailable(resolved, 'no_data');
  const firstTotal = totals[0];
  const amount = totals
    .map((item) => money(item.amountMinor, item.currency, resolved.locale))
    .join(' / ');
  const lastDay = new Date(`${resolved.startDate.slice(0, 7)}-01T00:00:00Z`);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1);
  lastDay.setUTCDate(0);
  const current =
    localDateAt(new Date(), resolved.timezone).slice(0, 7) === resolved.startDate.slice(0, 7) &&
    resolved.startDate.endsWith('-01') &&
    resolved.endDate === lastDay.toISOString().slice(0, 10);
  return {
    answer:
      resolved.locale === 'ar'
        ? `${net ? 'صافي الدخل' : intent === 'income_summary' ? 'دخلك' : 'صرفت'} ${amount} ${current ? 'هذا الشهر' : `خلال ${resolved.startDate} – ${resolved.endDate}`}.`
        : `${net ? 'Net result' : intent === 'income_summary' ? 'Income' : 'Spending'}: ${amount} (${resolved.startDate} – ${resolved.endDate}).`,
    context: {
      totals,
      ...(totals.length === 1 && firstTotal
        ? {
            [net
              ? 'monthlyNetResultMinor'
              : intent === 'income_summary'
                ? 'monthlyIncomeMinor'
                : 'monthlySpendingMinor']: firstTotal.amountMinor,
            currency: firstTotal.currency,
          }
        : {}),
      dataState: report.metadata.dataState,
    },
    evidence: report.metadata.evidence,
  };
}
function planningResult(
  summary: Record<string, unknown>,
  intent: AssistantIntent,
  question: string,
  resolved: ResolvedAssistantContext,
): FinancialToolResult {
  const refs = evidence(summary);
  const filterCurrency = (items: Record<string, unknown>[]) =>
    items.filter((item) => !resolved.currency || item.currencyCode === resolved.currency);
  if (intent === 'salary_status') {
    const salary = record(summary.salary);
    if (
      typeof salary.currencyCode !== 'string' ||
      (resolved.currency && salary.currencyCode !== resolved.currency)
    )
      return unavailable(resolved, 'salary_missing');
    const income = exact(salary.actualIncomeMinor).toString(),
      currency = salary.currencyCode;
    return {
      answer:
        resolved.locale === 'ar'
          ? `دخلك المؤكد ${money(income, currency, 'ar')} (${resolved.startDate} – ${resolved.endDate}).`
          : `Confirmed income: ${money(income, currency, 'en')} (${resolved.startDate} – ${resolved.endDate}).`,
      context: { salary: { actualIncomeMinor: income, currency } },
      evidence: refs,
    };
  }
  if (intent === 'budget_status' || intent === 'savings_status') {
    const items = filterCurrency(
      records(intent === 'budget_status' ? summary.budgets : summary.savings),
    );
    const selected = items.filter((item) => includesName(question, String(item.name)));
    const generic =
      /^(?:كيف ادخاري|ادخاري|كم باقي من ميزانيتي|savings status|budget status)[؟?]?$/iu.test(
        question.trim(),
      );
    const item =
      selected.length === 1 ? selected[0] : generic && items.length === 1 ? items[0] : null;
    if (!item) return unavailable(resolved, 'entity_required');
    const currency = String(item.currencyCode);
    if (intent === 'budget_status') {
      const remaining = exact(item.remainingMinor).toString();
      return {
        answer:
          resolved.locale === 'ar'
            ? `باقي لك ${money(remaining, currency, 'ar')} من ميزانية ${String(item.name)}.`
            : `${String(item.name)} remaining: ${money(remaining, currency, 'en')}.`,
        context: { budgets: [{ name: item.name, remainingMinor: remaining, currency }] },
        evidence: refs,
      };
    }
    const progress = exact(item.progressMinor).toString(),
      target = exact(item.targetMinor).toString();
    return {
      answer:
        resolved.locale === 'ar'
          ? `ادخرت ${money(progress, currency, 'ar')} من هدف بقيمة ${money(target, currency, 'ar')}.`
          : `${String(item.name)}: ${money(progress, currency, 'en')} of ${money(target, currency, 'en')}.`,
      context: {
        savings: [{ name: item.name, progressMinor: progress, targetMinor: target, currency }],
      },
      evidence: refs,
    };
  }
  const payables = filterCurrency(records(record(summary.obligations).payables));
  // Next-due amount is not a complete due-in-period total. Disclose next-installment coverage.
  if (
    intent === 'upcoming_obligations' &&
    payables.some((item) => item.nextDueAt && item.nextDueAmountMinor == null)
  )
    return unavailable(resolved, 'due_schedule_incomplete');
  const selected =
    intent === 'upcoming_obligations'
      ? payables.filter(
          (item) =>
            typeof item.nextDueAt === 'string' &&
            localDateAt(new Date(item.nextDueAt), resolved.timezone) >= resolved.startDate &&
            localDateAt(new Date(item.nextDueAt), resolved.timezone) <= resolved.endDate,
        )
      : payables;
  const grouped = new Map<string, bigint>();
  for (const item of selected) {
    const currency = String(item.currencyCode);
    grouped.set(
      currency,
      (grouped.get(currency) ?? 0n) +
        exact(intent === 'upcoming_obligations' ? item.nextDueAmountMinor : item.remainingMinor),
    );
  }
  const totals = [...grouped].map(([currency, amount]) => ({
    currency,
    amountMinor: amount.toString(),
  }));
  const firstTotal = totals[0];
  return {
    answer: `${resolved.locale === 'ar' ? (intent === 'upcoming_obligations' ? 'الأقساط التالية المستحقة في الفترة' : 'إجمالي الالتزامات المتبقية') : intent === 'upcoming_obligations' ? 'Next installments due in the period' : 'Total outstanding obligations'}: ${totals.length ? totals.map((item) => money(item.amountMinor, item.currency, resolved.locale)).join(' / ') : '0'} (${resolved.startDate} – ${resolved.endDate}).`,
    context: {
      count: selected.length,
      totals,
      ...(totals.length === 1 && firstTotal
        ? { totalMinor: firstTotal.amountMinor, currency: firstTotal.currency }
        : {}),
      dueCoverage:
        intent === 'upcoming_obligations' ? 'next_installment_only' : 'total_outstanding',
    },
    evidence: refs,
  };
}
function checkReport(report: ReportsSummaryResponse) {
  if (!['complete', 'empty'].includes(report.metadata.dataState))
    throw new HttpException({ code: 'AI_EVIDENCE_INCOMPLETE' }, 409);
}
function planningRecord(value: unknown) {
  const result = record(value);
  const obligations = record(result.obligations);
  if (
    !['ready', 'empty'].includes(String(result.dataState)) ||
    !Array.isArray(result.budgets) ||
    !Array.isArray(result.savings) ||
    !Array.isArray(obligations.payables) ||
    !Array.isArray(obligations.receivables) ||
    !('salary' in result)
  )
    throw new HttpException({ code: 'AI_EVIDENCE_INCOMPLETE' }, 409);
  return result;
}
function evidence(summary: Record<string, unknown>) {
  return [{ kind: 'report', version: version(summary.ledgerVersion) }];
}
function version(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new HttpException({ code: 'AI_EVIDENCE_INCOMPLETE' }, 409);
  return Number(value);
}
function exact(value: unknown): bigint {
  if (
    (typeof value !== 'string' || !/^-?\d+$/u.test(value)) &&
    (typeof value !== 'number' || !Number.isSafeInteger(value))
  )
    throw new HttpException({ code: 'AI_EVIDENCE_INCOMPLETE' }, 409);
  return BigInt(value);
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}
function includesName(question: string, name: string) {
  return (
    name.length > 0 &&
    question.normalize('NFKC').toLowerCase().includes(name.normalize('NFKC').toLowerCase())
  );
}
function money(value: string, currency: string, language: 'ar' | 'en') {
  if (!/^[A-Z]{3}$/u.test(currency))
    throw new HttpException({ code: 'AI_EVIDENCE_INCOMPLETE' }, 409);
  const digits =
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const amount = BigInt(value),
    sign = amount < 0n ? '-' : '',
    absolute = amount < 0n ? -amount : amount,
    scale = 10n ** BigInt(digits);
  const whole = new Intl.NumberFormat('en-US').format(absolute / scale),
    fraction = (absolute % scale).toString().padStart(digits, '0').replace(/0+$/u, '');
  return `${sign}${whole}${fraction ? `.${fraction}` : ''} ${currency === 'SAR' && language === 'ar' ? 'ريال' : currency}`;
}
function unavailable(
  resolved: ResolvedAssistantContext,
  reason = 'data_incomplete',
): FinancialToolResult {
  return {
    answer:
      reason === 'liquidity_incomplete'
        ? resolved.locale === 'ar'
          ? 'لا تتوفر بيانات كاملة عن السيولة المتاحة. الدخل ناقص المصروفات لا يساوي رصيدًا متاحًا للشراء.'
          : 'Complete spendable liquidity is unavailable. Income minus expenses is not an available purchase balance.'
        : resolved.locale === 'ar'
          ? 'لا تتوفر بيانات كافية للإجابة بدقة. حدد الفترة أو العملة أو العنصر المطلوب.'
          : 'There is not enough verified data to answer accurately. Specify the period, currency or entity.',
    context: {
      missingDataReason: reason,
      responseLocale: resolved.locale,
      assistantMetadata: {
        schemaVersion: 1,
        locale: resolved.locale,
        timezone: resolved.timezone,
        startDate: resolved.startDate,
        endDate: resolved.endDate,
        currencies: resolved.currency ? [resolved.currency] : [],
        responseType: 'missing',
        generatedAt: new Date().toISOString(),
        values: [],
        reasons: [reason],
      },
    },
    evidence: [],
  };
}
