const PRIVATE_KEYS = /token|secret|password|authorization|cookie|path|payload|error/i;

export function sanitizeForLog(value: unknown): unknown {
  if (value instanceof Error) return "[REDACTED]";
  if (Array.isArray(value)) return value.map(sanitizeForLog);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      PRIVATE_KEYS.test(key) ? "[REDACTED]" : sanitizeForLog(entry),
    ]),
  );
}

export function safeDevelopmentLog(event: string, details: unknown): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[admin:${event}]`, sanitizeForLog(details));
}
