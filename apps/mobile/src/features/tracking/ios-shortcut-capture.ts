import { z } from 'zod';
import {
  discoverFinancialMessage,
  normalizeFinancialText
} from '@masarifi/transaction-parser';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import type { TrackingImportEvent } from '@/domain/automatic-tracking';

const payloadSchema = z
  .object({
    token: z.guid(),
    messageId: z.string().trim().min(1).max(160),
    sender: z.string().trim().min(1).max(100),
    body: z.string().trim().min(1).max(2000),
    receivedAt: z.string().max(40).datetime({ offset: true })
  })
  .strict();
export type IosShortcutPayload = z.infer<typeof payloadSchema>;
export type IosShortcutCandidate = TrackingImportEvent & {
  amountMinor: number;
  currency: string;
  kind: 'expense' | 'income';
};

/** This URL is an untrusted local transport, never a navigation destination. */
export function decodeIosShortcut(
  path: string,
  now = Date.now()
): IosShortcutPayload | null {
  if (path.length > 25000) return null;
  try {
    const url = new URL(path);
    if (
      url.protocol !== 'masarifi:' ||
      url.host !== 'capture-ios' ||
      url.username ||
      url.password ||
      (url.pathname !== '' && url.pathname !== '/') ||
      url.hash ||
      [...url.searchParams.keys()].some((key) => key !== 'payload') ||
      url.searchParams.getAll('payload').length !== 1
    )
      return null;
    const parsed = payloadSchema.safeParse(
      JSON.parse(url.searchParams.get('payload') ?? '')
    );
    if (!parsed.success) return null;
    const age = now - Date.parse(parsed.data.receivedAt);
    if (age < -60000 || age > 24 * 60 * 60 * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function prepareIosShortcut(
  input: IosShortcutPayload
): Promise<IosShortcutCandidate | null> {
  const { classification: c, strong } = discoverFinancialMessage({
    text: input.body,
    sender: input.sender,
    channel: 'ios_shortcut',
    receivedAt: Date.parse(input.receivedAt),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  if (
    !strong ||
    c.status !== 'completed' ||
    c.disposition !== 'capture_candidate' ||
    c.reasonCodes.length ||
    !c.amountMinor ||
    !c.currency ||
    !(
      (c.direction === 'outgoing' && ['purchase', 'fee'].includes(c.subtype)) ||
      (c.direction === 'incoming' && c.subtype === 'salary')
    )
  )
    return null;
  const digest = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    JSON.stringify([
      'ios_shortcut:v1',
      input.sender.trim().toLowerCase(),
      input.messageId,
      new Date(input.receivedAt).toISOString(),
      normalizeFinancialText(input.body)
    ])
  );
  if (!/^[a-f0-9]{64}$/u.test(digest))
    throw Error('ios_shortcut_digest_unavailable');
  // No raw message, sender, token, instrument suffixes or provider references leave this boundary.
  return {
    sourceItemKey: `ios-shortcut:${digest}`,
    amountMinor: c.amountMinor,
    currency: c.currency,
    kind: c.direction === 'incoming' ? 'income' : 'expense',
    receivedAt: new Date(input.receivedAt).toISOString(),
    occurredAt: c.occurredAt ?? new Date(input.receivedAt).toISOString()
  };
}
