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
  configurationRevision?: string;
  country?: string;
  bindings?: readonly {
    provider: string;
    role: 'card' | 'account' | 'cash_card' | 'cash_account';
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
    const transfer = ['transfer_sent', 'transfer_received'].includes(
      classification.subtype
    );
    const source = transfer
      ? selectAccount(
          classification.currency,
          classification.instruments.filter((h) => h.side === 'source'),
          options,
          provider?.providerKey
        )
      : null;
    const destination = transfer
      ? selectAccount(
          classification.currency,
          classification.instruments.filter((h) => h.side === 'destination'),
          options,
          provider?.providerKey
        )
      : null;
    const ownedTransfer =
      transfer &&
      source &&
      destination &&
      source.id !== destination.id &&
      classification.instruments.every((h) => h.side !== undefined);
    const selected = ownedTransfer
      ? classification.direction === 'incoming'
        ? destination
        : source
      : transfer &&
          (classification.direction === 'incoming' ? destination : source)
        ? classification.direction === 'incoming'
          ? destination
          : source
        : selectAccount(
            classification.currency,
            classification.instruments,
            options,
            provider?.providerKey
          );
    const cashDestination =
      classification.subtype === 'withdrawal' && selected
        ? selectCashDestination(
            classification.currency,
            classification.instruments,
            options,
            provider?.providerKey
          )
        : null;
    const counterpart = ownedTransfer
      ? classification.direction === 'incoming'
        ? source
        : destination
      : cashDestination;
    const affectedSide =
      classification.direction === 'incoming' ? 'destination' : 'source';
    const oppositeHints = classification.instruments.filter(
      (hint) => hint.side !== undefined && hint.side !== affectedSide
    );
    const anotherOwnedEndpoint = oppositeHints.some((hint) =>
      options.accounts.some(
        (candidate) =>
          candidate.status === 'active' &&
          candidate.currencyCode === classification.currency &&
          (candidate.lastFour === hint.suffix ||
            options.bindings?.some(
              (binding) =>
                binding.provider === provider?.providerKey &&
                binding.role === hint.role &&
                binding.suffix === hint.suffix &&
                binding.accountId === candidate.id
            ))
      )
    );
    const externalTransfer =
      transfer &&
      selected &&
      !ownedTransfer &&
      !anotherOwnedEndpoint &&
      classification.direction !== 'unknown' &&
      classification.instruments.some(
        (hint) =>
          hint.side === affectedSide ||
          (hint.side === undefined && classification.instruments.length === 1)
      );
    if (ownedTransfer)
      classification.reasonCodes = classification.reasonCodes.filter(
        (code) => code !== 'transfer_counterparty_required'
      );
    if (cashDestination)
      classification.reasonCodes = classification.reasonCodes.filter(
        (code) => code !== 'cash_destination_required'
      );
    if (externalTransfer)
      classification.reasonCodes = classification.reasonCodes.filter(
        (code) => code !== 'transfer_counterparty_required'
      );
    if (!selected) {
      classification.reasonCodes.push('ambiguous_account');
      result.accountRequiredCount++;
    }
    classification.disposition =
      classification.status === 'completed' &&
      classification.direction !== 'unknown' &&
      classification.amountMinor !== null &&
      classification.currency !== null &&
      !classification.reasonCodes.length
        ? 'capture_candidate'
        : 'review';
    const kind = externalTransfer
      ? classification.direction === 'incoming'
        ? 'income'
        : 'expense'
      : ['salary', 'deposit'].includes(classification.subtype) ||
          (classification.subtype === 'generic_credit' &&
            !classification.reasonCodes.includes('credit_origin_required'))
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
    const {
      providerReference,
      originalProviderReference,
      ...safeClassification
    } = classification;
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
            providerReferenceDigest: await digest(`v2\n${providerReference}`)
          }
        : {}),
      ...(originalProviderReference
        ? {
            originalProviderReferenceDigest: await digest(
              `v2\n${originalProviderReference}`
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
      ...(counterpart ? { destinationAccountId: counterpart.id } : {}),
      ...(classification.merchant ? { merchant: classification.merchant } : {}),
      metadata: {
        ...(providerReference || originalProviderReference
          ? { referenceScheme: 'plain-v2' }
          : {}),
        ...(sms
          ? { sourceIdentityDigest: await digest(normalizeSender(sender)) }
          : {}),
        ...(options.configurationRevision
          ? { ruleConfigurationRevision: options.configurationRevision }
          : {}),
        ...(sms ? {} : { sourcePackage: sender }),
        ...(input.observedAt !== undefined
          ? { nativeObservedAt: input.observedAt }
          : {}),
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
function selectCashDestination(
  currency: string | null,
  hints: { role: 'card' | 'account'; suffix: string }[],
  options: Options,
  provider?: string
): Account | null {
  if (!provider || !hints.length) return null;
  const matches = hints.map((hint) => {
    const bindings =
      options.bindings?.filter(
        (binding) =>
          binding.provider === provider &&
          binding.role === `cash_${hint.role}` &&
          binding.suffix === hint.suffix
      ) ?? [];
    return options.accounts.filter(
      (candidate) =>
        candidate.type === 'cash' &&
        candidate.status === 'active' &&
        candidate.automaticTrackingEnabled &&
        candidate.currencyCode === currency &&
        bindings.some((binding) => binding.accountId === candidate.id)
    );
  });
  return matches.every(
    (rows) => rows.length === 1 && rows[0]?.id === matches[0]?.[0]?.id
  )
    ? (matches[0]?.[0] ?? null)
    : null;
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
  // Currency/default selection is not evidence of the account affected by
  // a captured event. An explicit instrument or verified binding is required.
  return null;
}
