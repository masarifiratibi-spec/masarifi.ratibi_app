const eventTypePattern = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;
const aggregateTypePattern = /^[a-z][a-z0-9_-]*$/;
const sensitiveKeyPattern =
  /authorization|cookie|credential|password|secret|token|connection[_ -]?string|provider[_ -]?(request|response)/i;

function containsSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveKey);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, child]) => sensitiveKeyPattern.test(key) || containsSensitiveKey(child),
  );
}

export function validateOutboxInput(
  eventType: string,
  aggregateType: string,
  payload: unknown,
): asserts payload is Record<string, unknown> {
  if (eventType.length < 3 || eventType.length > 128 || !eventTypePattern.test(eventType)) {
    throw new Error('OUTBOX_EVENT_TYPE_INVALID');
  }
  if (
    aggregateType.length < 1 ||
    aggregateType.length > 64 ||
    !aggregateTypePattern.test(aggregateType)
  ) {
    throw new Error('OUTBOX_AGGREGATE_TYPE_INVALID');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('OUTBOX_PAYLOAD_INVALID');
  }
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 65_536) {
    throw new Error('OUTBOX_PAYLOAD_INVALID');
  }
  if (containsSensitiveKey(payload)) throw new Error('OUTBOX_PAYLOAD_SENSITIVE');
}
