import * as Crypto from 'expo-crypto';
import {
  classifyFinancialMessage,
  defaultSnapshot,
  normalizeFinancialText,
  type RuleSnapshot
} from '@masarifi/transaction-parser';
import type { KeywordRule } from '@/domain/app-shell';
import {
  normalizeSender,
  type SenderRule,
  type TrackingImportEvent
} from '@/domain/automatic-tracking';
import {
  accountAllowsAutomaticTracking,
  type Account
} from '@/domain/core-finance';
import type { RawSmsMessage } from '@/services/platform/sms-inbox-service';
import type { RawBankNotification } from '@/services/platform/bank-notification-service';

export interface PreparedSmsImport {
  events: TrackingImportEvent[];
  skippedFingerprints: string[];
  newestReceivedAt: number | null;
  accountRequiredCount: number;
  consumedSourceKeys: string[];
}
interface Options {
  keywordRules: readonly KeywordRule[];
  senderRules: readonly SenderRule[];
  accounts: readonly Account[];
  knownFingerprints: ReadonlySet<string>;
  deviceId?: string;
  snapshot?: RuleSnapshot;
  country?: string;
  bindings?: readonly {
    provider: string;
    role: 'card' | 'account';
    suffix: string;
    accountId: string;
  }[];
}
const digest = async (value: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
export const prepareSmsImport = (
  messages: readonly RawSmsMessage[],
  options: Options
) => prepareFinancialMessageImport(messages, options);

export async function prepareFinancialMessageImport(
  messages: readonly (RawSmsMessage | RawBankNotification)[],
  options: Options
): Promise<PreparedSmsImport> {
  const result: PreparedSmsImport = {
    events: [],
    skippedFingerprints: [],
    newestReceivedAt: null,
    accountRequiredCount: 0,
    consumedSourceKeys: []
  };
  for (const input of messages) {
    const sms = 'body' in input;
    const nativeId = sms ? input.id : input.key;
    const sender = sms ? input.sender : input.packageName;
    const body = sms
      ? input.body
      : [input.title, input.text].filter(Boolean).join('\n');
    const receivedAt = sms ? input.receivedAt : input.postedAt;
    if (!Number.isSafeInteger(receivedAt) || receivedAt < 0) continue;
    result.newestReceivedAt = Math.max(
      result.newestReceivedAt ?? 0,
      receivedAt
    );
    const normalizedBody = normalizeFinancialText(body);
    const channel = sms ? 'android_sms' : 'android_notification';
    const nativeIdDigest = await digest(
      `${sender}\n${sms ? nativeId : (input.nativeKey ?? nativeId)}`
    );
    const revisionDigest = await digest(normalizedBody);
    const key = `sha256:${await digest(`${options.deviceId ?? 'legacy-device'}\n${channel}\n${nativeIdDigest}${sms ? '' : '\n' + revisionDigest}`)}`;
    const consume = () => {
      if (!sms) result.consumedSourceKeys.push(nativeId);
    };
    if (options.knownFingerprints.has(key)) {
      result.skippedFingerprints.push(key);
      consume();
      continue;
    }
    const configured = options.snapshot ?? defaultSnapshot;
    const provider = configured.providers?.find((p) =>
      [...p.senders, ...p.packages].some(
        (s) => normalizeSender(s) === normalizeSender(sender)
      )
    );
    const country = options.country ?? provider?.country;
    const overrides = new Map(
      options.keywordRules.map((rule) => [
        normalizeFinancialText(rule.value).toLowerCase(),
        rule.enabled
      ])
    );
    const snapshot: RuleSnapshot = {
      ...configured,
      rules: configured.rules
        .map((rule) => ({
          ...rule,
          any:
            rule.family === 'action'
              ? rule.any.filter(
                  (phrase) =>
                    overrides.get(
                      normalizeFinancialText(phrase).toLowerCase()
                    ) !== false
                )
              : rule.any
        }))
        .filter((rule) => rule.any.length > 0)
    };
    const classification = classifyFinancialMessage(
      { text: normalizedBody, sender, country, channel, receivedAt },
      snapshot
    );
    // Custom wording can identify a candidate, but cannot bypass accounting review or protected lifecycle rules.
    if (classification.status === 'unknown') {
      const custom = options.keywordRules.filter(
        (rule) =>
          rule.enabled &&
          rule.origin === 'custom' &&
          normalizedBody
            .toLowerCase()
            .includes(normalizeFinancialText(rule.value).toLowerCase())
      );
      if (custom.length) {
        classification.reasonCodes.push('custom_rule_review');
        classification.appliedRuleKeys.push(
          ...custom.map(
            (rule) =>
              `custom.${rule.id.replace(/[^a-z0-9._-]/gi, '_').slice(0, 80)}`
          )
        );
        classification.direction = custom.every((rule) =>
          ['expense', 'fee', 'subscription', 'installment'].includes(rule.group)
        )
          ? 'outgoing'
          : custom.every((rule) =>
                ['income', 'deposit', 'refund'].includes(rule.group)
              )
            ? 'incoming'
            : 'unknown';
        classification.subtype =
          classification.direction === 'outgoing'
            ? 'generic_debit'
            : classification.direction === 'incoming'
              ? 'generic_credit'
              : 'unknown';
      }
    }
    if (classification.disposition === 'ignore') {
      result.skippedFingerprints.push(key);
      consume();
      continue;
    }
    const trusted = options.senderRules.some(
      (rule) =>
        rule.enabled &&
        rule.trusted &&
        normalizeSender(rule.normalizedSender) === normalizeSender(sender)
    );
    if (
      !classification.appliedRuleKeys.length &&
      classification.amountMinor === null
    ) {
      result.skippedFingerprints.push(key);
      consume();
      continue;
    }
    if (!trusted) classification.reasonCodes.push('source_untrusted');
    const selected = selectAccount(
      classification.currency,
      classification.instruments,
      options,
      provider?.providerKey
    );
    if (!selected) {
      classification.reasonCodes.push('ambiguous_account');
      result.accountRequiredCount++;
    }
    if (classification.reasonCodes.length)
      classification.disposition = 'review';
    const kind =
      classification.subtype === 'salary'
        ? 'income'
        : ['refund', 'reversal'].includes(classification.subtype)
          ? 'refund'
          : ['transfer_sent', 'transfer_received', 'withdrawal'].includes(
                classification.subtype
              )
            ? 'transfer'
            : classification.subtype === 'fee'
              ? 'fee'
              : classification.direction === 'outgoing'
                ? 'expense'
                : undefined;
    const { providerReference, ...safeClassification } = classification;
    const paymentRail = /apple\s*pay/i.test(body)
      ? 'apple_pay'
      : /مدى|\bmada\b/i.test(body)
        ? 'mada'
        : null;
    result.events.push({
      sourceItemKey: key,
      transport: {
        deviceId: options.deviceId ?? 'legacy-device',
        channel,
        nativeIdDigest,
        revisionDigest
      },
      classification: safeClassification,
      ...(providerReference
        ? {
            providerReferenceDigest: await digest(
              `${provider?.providerKey ?? normalizeSender(sender)}\n${providerReference}`
            )
          }
        : {}),
      ...(/https?:|\+?\d{4,}/i.test(sender)
        ? {}
        : { sender: sender.slice(0, 80) }),
      ...(classification.amountMinor !== null
        ? {
            amountMinor:
              classification.direction === 'incoming'
                ? classification.amountMinor
                : -classification.amountMinor
          }
        : {}),
      ...(classification.currency ? { currency: classification.currency } : {}),
      ...(kind ? { kind } : {}),
      ...(selected ? { accountId: selected.id } : {}),
      ...(classification.merchant ? { merchant: classification.merchant } : {}),
      metadata: {
        ...(sms ? {} : { sourcePackage: sender }),
        ...(paymentRail ? { paymentRail } : {}),
        ...(provider ? { sourceProvider: provider.providerKey } : {})
      },
      receivedAt: new Date(receivedAt).toISOString(),
      ...(classification.occurredAt
        ? { occurredAt: classification.occurredAt }
        : {})
    });
    consume();
  }
  return result;
}
function selectAccount(
  currency: string | null,
  hints: { role: 'card' | 'account'; suffix: string }[],
  options: Options,
  provider?: string
): Account | null {
  const eligible = options.accounts.filter(
    (a) => a.currencyCode === currency && accountAllowsAutomaticTracking(a)
  );
  if (hints.length) {
    const matches = hints.map((hint) => {
      const binding =
        options.bindings?.filter(
          (b) =>
            provider &&
            b.provider === provider &&
            b.role === hint.role &&
            b.suffix === hint.suffix
        ) ?? [];
      if (binding.length)
        return eligible.filter((a) =>
          binding.some((b) => b.accountId === a.id)
        );
      if (
        options.bindings?.some(
          (b) => b.role === hint.role && b.suffix === hint.suffix
        )
      )
        return [];
      return hint.suffix.length === 4
        ? eligible.filter((a) => a.lastFour === hint.suffix)
        : [];
    });
    if (matches.some((m) => m.length !== 1)) return null;
    return matches.every((m) => m[0]?.id === matches[0]?.[0]?.id)
      ? (matches[0]?.[0] ?? null)
      : null;
  }
  if (eligible.length === 1) return eligible[0] ?? null;
  const defaults = eligible.filter((a) => a.isDefault);
  return defaults.length === 1 ? (defaults[0] ?? null) : null;
}
