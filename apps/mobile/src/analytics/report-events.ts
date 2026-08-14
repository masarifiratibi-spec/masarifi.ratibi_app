const blockedKeys = /amount|minor|recipient|email|merchant|account|row|snapshot|transaction|id|balance|message|transcript|question|answer|support|credential|rawError/i;

export function sanitizeReportAnalyticsPayload(payload: Record<string, unknown>) {
  return Object.freeze(Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => !blockedKeys.test(key) && typeof value !== 'object')
  ));
}
