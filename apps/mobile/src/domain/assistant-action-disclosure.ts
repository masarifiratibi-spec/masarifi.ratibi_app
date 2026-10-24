import type { AssistantActionPreview } from './assistant';
import type { Locale } from './foundation';
import { hasCompleteAssistantEffect } from './assistant-action-effect';
import { supportedCurrencies } from './currencies';
import { formatMinorAmount } from '@/utils/format-financial-value';

export interface AssistantActionDisclosure {
  complete: boolean;
  scopeKey: string;
  fields: {
    key: string;
    labelKey: string;
    value: string | null;
    before?: string | null;
  }[];
  reason?: 'incomplete' | 'stale';
}

export interface AssistantActionDisclosureContext {
  target?: Record<string, unknown>;
  transaction?: Record<string, unknown>;
  schedule?: readonly Record<string, unknown>[];
  timezone?: string;
}

const actions: Record<string, string> = {
  create_transaction: 'transaction.create',
  update_transaction: 'transaction.update',
  update_budget: 'budget.update',
  create_goal: 'savings_goal.create',
  record_obligation_payment: 'obligation.payment.record',
  resolve_tracking_review: 'tracking.review.resolve'
};
const monetary = new Set([
  'amountMinor',
  'feeMinor',
  'totalMinor',
  'incomeTargetMinor',
  'savingsTargetMinor',
  'rolloverMinor',
  'targetMinor',
  'openingTrackedMinor',
  'paidMinor'
]);
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('incomplete');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('incomplete');
  return value;
}
function currency(value: unknown): string {
  const code = text(value);
  if (!supportedCurrencies.some((item) => item.code === code))
    throw new Error('incomplete');
  return code;
}
function minor(value: unknown): bigint {
  if (!(
    (typeof value === 'string' && /^-?\d+$/u.test(value)) ||
    (typeof value === 'number' && Number.isSafeInteger(value))
  ))
    throw new Error('incomplete');
  const result = BigInt(value as string | number);
  if (
    result > BigInt(Number.MAX_SAFE_INTEGER) ||
    result < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error('incomplete');
  return result;
}
function currentTarget(
  context: AssistantActionDisclosureContext,
  id: unknown,
  expectedVersion: unknown
) {
  const target = object(context.target);
  if (
    target.id !== id ||
    target.version !== expectedVersion ||
    target.deletedAt != null
  )
    throw new Error('stale');
  return target;
}

/** Pure disclosure from the validated effect and owner-authorized reads; never infer missing financial values. */
export function buildAssistantActionDisclosure(
  preview: AssistantActionPreview,
  context: AssistantActionDisclosureContext,
  locale: Locale
): AssistantActionDisclosure {
  const fields: AssistantActionDisclosure['fields'] = [];
  let scopeKey = 'assistant.actionPreview.scope.unavailable';
  try {
    const action = actions[preview.kind];
    const payload = object(preview.effect);
    if (!action || !hasCompleteAssistantEffect(action, payload))
      throw new Error('incomplete');
    const add = (
      key: string,
      value: unknown,
      code?: string,
      before?: unknown,
      oldCode = code
    ) => {
      const display = (input: unknown, moneyCode?: string): string | null => {
        if (input === undefined) throw new Error('incomplete');
        if (input === null) return null;
        if (monetary.has(key.split('.').at(-1) ?? key))
          return formatMinorAmount(
            Number(minor(input)),
            currency(moneyCode),
            locale
          );
        if (['string', 'boolean', 'number'].includes(typeof input))
          return String(input);
        throw new Error('incomplete');
      };
      fields.push({
        key,
        labelKey: `assistant.actionPreview.field.${key.split('.').at(-1) ?? key}`,
        value: display(value, code),
        ...(before !== undefined ? { before: display(before, oldCode) } : {})
      });
    };
    add('previewVersion', preview.version);
    if (preview.expiresAt !== null)
      add('expiresAt', new Date(preview.expiresAt).toISOString());
    if (action === 'transaction.create') {
      const timezone = text(context.timezone ?? preview.effectTimezone);
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format(0);
      scopeKey = 'assistant.actionPreview.scope.createTransaction';
      add('kind', minor(payload.amountMinor) < 0n ? 'income' : 'expense');
      add(
        'amountMinor',
        (minor(payload.amountMinor) < 0n
          ? -minor(payload.amountMinor)
          : minor(payload.amountMinor)
        ).toString(),
        payload.currency as string
      );
      for (const key of [
        'currency',
        'accountId',
        'categoryId',
        'date',
        'merchant',
        'note'
      ])
        add(key, payload[key]);
      add('timezone', timezone);
      add('time', '12:00');
      add('title', payload.merchant ?? 'Assistant transaction');
      add('paymentMethod', null);
      add('source', 'platform_assisted');
    } else if (action === 'savings_goal.create') {
      scopeKey = 'assistant.actionPreview.scope.createGoal';
      const code = currency(payload.currencyCode);
      for (const key of ['name', 'targetMinor', 'currencyCode'])
        add(key, payload[key], code);
      add('openingTrackedMinor', payload.openingTrackedMinor ?? '0', code);
      for (const key of ['targetDate', 'linkedAccountId', 'iconKey'])
        add(key, payload[key] ?? null);
      add('emergencyFund', payload.emergencyFund ?? false);
    } else if (action === 'transaction.update' || action === 'budget.update') {
      const budget = action === 'budget.update';
      const target = currentTarget(
        context,
        payload[budget ? 'budgetId' : 'transactionId'],
        payload.expectedVersion
      );
      const code = currency(target[budget ? 'currencyCode' : 'currency']);
      const patch = budget ? object(payload.patch) : payload;
      scopeKey = budget
        ? 'assistant.actionPreview.scope.updateBudget'
        : 'assistant.actionPreview.scope.updateTransaction';
      add(budget ? 'budgetId' : 'transactionId', target.id);
      add('expectedVersion', target.version);
      add(budget ? 'currencyCode' : 'currency', code);
      if (!budget) add('reason', payload.reason);
      const keys = budget
        ? [
            'name',
            'periodStart',
            'periodEnd',
            'totalMinor',
            'incomeTargetMinor',
            'savingsTargetMinor',
            'rolloverEnabled',
            'rolloverMinor',
            'status'
          ]
        : [
            'kind',
            'amountMinor',
            'accountId',
            'categoryId',
            'title',
            'merchant',
            'paymentMethod',
            'note',
            'occurredAt'
          ];
      for (const key of keys) {
        const before = target[key === 'accountId' ? 'sourceAccountId' : key];
        if (before === undefined) throw new Error('incomplete');
        add(key, Object.hasOwn(patch, key) ? patch[key] : before, code, before);
      }
      if (!budget && target.kind === 'transfer') {
        add(
          'destinationAccountId',
          target.destinationAccountId,
          undefined,
          target.destinationAccountId
        );
        add('feeMinor', target.feeMinor, code, target.feeMinor);
      }
    } else if (action === 'obligation.payment.record') {
      scopeKey = 'assistant.actionPreview.scope.recordPayment';
      const target = currentTarget(
        context,
        payload.obligationId,
        payload.expectedVersion
      );
      const transaction = object(context.transaction);
      const code = currency(target.currencyCode);
      if (
        target.status !== 'active' ||
        transaction.id !== payload.transactionId ||
        transaction.deletedAt != null ||
        transaction.status !== 'confirmed' ||
        transaction.currency !== code ||
        transaction.kind !==
          (target.direction === 'payable' ? 'expense' : 'income')
      )
        throw new Error('stale');
      add('obligationId', target.id);
      add('name', target.name);
      add('expectedVersion', target.version);
      add('direction', target.direction);
      for (const key of [
        'transactionId',
        'paymentMethod',
        'paymentCase',
        'allocationIntent',
        'source'
      ])
        add(key, payload[key]);
      add('currency', code);
      add('amountMinor', transaction.amountMinor, code);
      add('occurredAt', transaction.occurredAt);
      add('accountId', transaction.sourceAccountId);
      let total = 0n;
      const seen = new Set<unknown>();
      for (const value of payload.allocations as unknown[]) {
        const allocation = object(value);
        const item = context.schedule?.find(
          (row) =>
            row.id === allocation.scheduleItemId &&
            row.obligationId === target.id
        );
        if (!item || seen.has(item.id)) throw new Error('incomplete');
        seen.add(item.id);
        const paid = minor(item.paidMinor),
          amount = minor(allocation.amountMinor),
          after = paid + amount;
        if (after > minor(item.amountMinor)) throw new Error('stale');
        total += amount;
        const dueAt = Date.parse(text(item.dueAt));
        if (!Number.isFinite(dueAt)) throw new Error('incomplete');
        const prefix = `allocation.${text(item.id)}.`;
        add(`${prefix}scheduleItemId`, item.id);
        add(`${prefix}dueAt`, item.dueAt);
        add(`${prefix}amountMinor`, amount.toString(), code);
        add(`${prefix}paidMinor`, after.toString(), code, paid.toString());
        add(
          `${prefix}status`,
          after === minor(item.amountMinor)
            ? 'paid'
            : dueAt < Date.now()
              ? 'overdue'
              : 'partial',
          undefined,
          item.status
        );
      }
      if (total !== minor(transaction.amountMinor))
        throw new Error('incomplete');
    } else if (action === 'tracking.review.resolve') {
      const target = currentTarget(
        context,
        payload.reviewId,
        payload.expectedVersion
      );
      if (target.status !== 'pending') throw new Error('stale');
      add('reviewId', target.id);
      add('expectedVersion', target.version);
      add('decision', payload.decision);
      add(
        'status',
        payload.decision === 'reject'
          ? 'rejected'
          : payload.decision === 'edit_accept'
            ? 'edited'
            : 'accepted',
        undefined,
        'pending'
      );
      if (payload.decision === 'reject') {
        scopeKey = 'assistant.actionPreview.scope.rejectReview';
        add('transactionEffect', 'none');
      } else {
        scopeKey = 'assistant.actionPreview.scope.acceptReview';
        const proposed = object(target.proposedValues),
          edit = object(payload.edit);
        const after = { ...proposed, ...edit };
        const code = currency(after.currency),
          oldCode = currency(proposed.currency);
        if (!['expense', 'income', 'transfer'].includes(text(after.kind)))
          throw new Error('incomplete');
        const importedAmount = minor(after.amountMinor);
        if (importedAmount === 0n) throw new Error('incomplete');
        after.amountMinor = (
          importedAmount < 0n ? -importedAmount : importedAmount
        ).toString();
        if (after.kind === 'transfer') {
          after.categoryId = null;
          after.merchant = null;
          after.paymentMethod = null;
        }
        const defaults: Record<string, unknown> = {
          categoryId: null,
          merchant: null,
          paymentMethod: null,
          note: null
        };
        const keys = [
          'kind',
          'amountMinor',
          'currency',
          'accountId',
          'categoryId',
          'title',
          'merchant',
          'paymentMethod',
          'note',
          'occurredAt'
        ];
        if (after.kind === 'transfer') keys.push('destinationAccountId');
        for (const key of keys) {
          const before =
            key === 'title'
              ? (proposed.title ?? proposed.merchant ?? 'Imported transaction')
              : (proposed[key] ?? defaults[key]);
          const value =
            key === 'title'
              ? (after.title ?? after.merchant ?? 'Imported transaction')
              : (after[key] ?? defaults[key]);
          add(key, value, code, before, oldCode);
        }
        if (after.kind === 'transfer') {
          add('feeMinor', '0', code);
          add('source', 'manual');
        } else add('source', 'tracking-import');
      }
    }
    return { complete: true, scopeKey, fields };
  } catch (error) {
    return {
      complete: false,
      scopeKey,
      fields,
      reason:
        error instanceof Error && error.message === 'stale'
          ? 'stale'
          : 'incomplete'
    };
  }
}
