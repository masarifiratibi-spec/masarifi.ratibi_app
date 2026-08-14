import { normalizeSender } from '@/domain/automatic-tracking';

export function validateSenderRule(sender: string): string | null {
  const normalized = normalizeSender(sender);
  return normalized ? normalized : null;
}
