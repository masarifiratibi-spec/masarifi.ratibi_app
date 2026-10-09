import * as Crypto from 'expo-crypto';
import {
  discoverFinancialMessage,
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
    const sourceRules = options.senderRules.filter(
      (rule) =>
        normalizeSender(rule.normalizedSender) === normalizeSender(sender)
    );
    if (sourceRules.some((rule) => !rule.enabled)) {
      result.skippedFingerprints.push(key);
      consume();
      continue;
    }
    const trusted = sourceRules.some((rule) => rule.enabled && rule.trusted);
    const discovery = discoverFinancialMessage(
      { text: normalizedBody, sender, country, channel, receivedAt },
      configured,
      options.keywordRules
    );
    const classification = discovery.classification;
    const publishedFinancialMatch = classification.appliedRuleKeys.some(
      (ruleKey) =>
        configured.rules.some(
          (rule) => rule.ruleKey === ruleKey && rule.family === 'action'
        )
    );
    if (
      classification.disposition === 'ignore' ||
      (!discovery.strong && !(trusted && publishedFinancialMatch))
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
      provider?.providerKey,
      trusted
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
  provider?: string,
  allowCurrencyFallback = true
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
  if (!allowCurrencyFallback) return null;
  if (eligible.length === 1) return eligible[0] ?? null;
  const defaults = eligible.filter((a) => a.isDefault);
  return defaults.length === 1 ? (defaults[0] ?? null) : null;
}
