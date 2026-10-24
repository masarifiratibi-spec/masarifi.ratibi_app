import { MasarifiSmsInbox } from '../../../modules/masarifi-sms-inbox';
import * as Crypto from 'expo-crypto';
import type {
  RawSmsMessage,
  SmsInboxService,
  SmsInboxPage
} from './sms-inbox-service';

interface NativeSmsInbox {
  readRecentSms(since: number, limit: number): Promise<unknown>;
  readSmsPage?(since: number, afterId: string, limit: number): Promise<unknown>;
  readFinancialSmsPageV2?(
    since: number,
    afterId: string,
    limit: number,
    ownerDigest: string
  ): Promise<unknown>;
  isNetworkAvailable(): Promise<unknown>;
}

export function createAndroidSmsInboxService(
  native: NativeSmsInbox | null = MasarifiSmsInbox
): SmsInboxService {
  const validateBounds = (since: number, limit: number) => {
    if (
      !Number.isSafeInteger(since) ||
      since < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new Error('sms_inbox_invalid_request');
  };
  const legacyRead = async (
    since: number,
    afterId: string | undefined,
    limit: number
  ): Promise<unknown[]> => {
    const value = native?.readSmsPage
      ? await native.readSmsPage(since, afterId ?? '', limit)
      : await native?.readRecentSms(since, limit);
    if (!Array.isArray(value)) throw new Error('sms_inbox_invalid_response');
    return value;
  };
  return {
    available: native !== null,
    async readRecent({ since, limit, afterId }) {
      validateBounds(since, limit);
      if (!native) return [];
      return validMessages(await legacyRead(since, afterId, limit));
    },
    async readPage({ since, limit, afterId, ownerId }) {
      validateBounds(since, limit);
      const initial = { receivedAt: since, id: afterId || '0' };
      if (!boundary(initial) || !ownerId)
        throw new Error('sms_inbox_invalid_request');
      if (!native)
        return {
          version: 2,
          messages: [],
          lastScanned: initial,
          hasMore: false,
          scanned: 0
        };
      if (!native.readFinancialSmsPageV2) {
        const rows = await legacyRead(since, afterId, limit);
        const tail = rows.at(-1) as Record<string, unknown> | undefined;
        const last = tail
          ? { receivedAt: tail.receivedAt, id: tail.id }
          : initial;
        if (!boundary(last)) throw new Error('sms_inbox_invalid_response');
        return {
          version: 2,
          messages: validMessages(rows),
          lastScanned: last,
          hasMore: rows.length === limit,
          scanned: rows.length
        };
      }
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        ownerId
      );
      const value = await native.readFinancialSmsPageV2(
        since,
        initial.id,
        limit,
        digest
      );
      if (!value || typeof value !== 'object')
        throw new Error('sms_inbox_invalid_response');
      const page = value as SmsInboxPage;
      if (
        page.version !== 2 ||
        !Array.isArray(page.messages) ||
        page.messages.length > limit ||
        !boundary(page.lastScanned) ||
        typeof page.hasMore !== 'boolean' ||
        !Number.isSafeInteger(page.scanned) ||
        page.scanned < page.messages.length ||
        page.scanned > 1000 ||
        compare(page.lastScanned, initial) < 0 ||
        (page.hasMore && compare(page.lastScanned, initial) === 0)
      )
        throw new Error('sms_inbox_invalid_response');
      const messages = validMessages(page.messages);
      if (
        messages.some(
          (message) =>
            !boundary({ receivedAt: message.receivedAt, id: message.id }) ||
            compare(
              { receivedAt: message.receivedAt, id: message.id },
              initial
            ) <= 0 ||
            compare(
              { receivedAt: message.receivedAt, id: message.id },
              page.lastScanned
            ) > 0
        )
      )
        throw new Error('sms_inbox_invalid_response');
      return { ...page, messages };
    },
    async isNetworkAvailable() {
      if (!native) return false;
      const value = await native.isNetworkAvailable();
      if (typeof value !== 'boolean')
        throw new Error('sms_inbox_invalid_response');
      return value;
    }
  };
}

function boundary(value: unknown): value is SmsInboxPage['lastScanned'] {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(row.receivedAt) &&
    Number(row.receivedAt) >= 0 &&
    typeof row.id === 'string' &&
    /^(0|[1-9][0-9]{0,18})$/.test(row.id)
  );
}
function compare(
  left: SmsInboxPage['lastScanned'],
  right: SmsInboxPage['lastScanned']
): number {
  if (left.receivedAt !== right.receivedAt)
    return left.receivedAt - right.receivedAt;
  return (
    left.id.length - right.id.length ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  );
}
function validMessages(values: unknown[]): RawSmsMessage[] {
  return values.flatMap((value) => {
    try {
      return [validateMessage(value)];
    } catch {
      return [];
    }
  });
}

export const smsInboxService = createAndroidSmsInboxService();

function validateMessage(value: unknown): RawSmsMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('sms_inbox_invalid_response');
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    !row.id ||
    typeof row.sender !== 'string' ||
    !row.sender.trim() ||
    typeof row.body !== 'string' ||
    !row.body.trim() ||
    !Number.isSafeInteger(row.receivedAt) ||
    Number(row.receivedAt) < 0 ||
    (row.observedAt !== undefined &&
      (!Number.isSafeInteger(row.observedAt) || Number(row.observedAt) < 0))
  ) {
    throw new Error('sms_inbox_invalid_response');
  }
  return {
    id: row.id,
    sender: row.sender,
    body: row.body,
    receivedAt: Number(row.receivedAt),
    ...(row.observedAt !== undefined
      ? { observedAt: Number(row.observedAt) }
      : {})
  };
}
