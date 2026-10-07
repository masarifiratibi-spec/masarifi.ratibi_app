import type { z } from 'zod';

export type HttpErrorCode =
  | 'validation_error'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'session_expired'
  | 'gone'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'contract_mismatch'
  | 'internal_error';

export class HttpError extends Error {
  constructor(
    readonly code: HttpErrorCode,
    readonly status: number,
    readonly domainCode?: string,
    readonly requestId?: string
  ) {
    super(SAFE_MESSAGES[code]);
    this.name = 'HttpError';
  }
}

type TokenProvider = () => Promise<string | null>;
type RequestOptions<T> = Omit<RequestInit, 'body'> & {
  baseUrl?: string;
  body?: unknown;
  emptyValue?: T;
  notModifiedValue?: T;
  request?: typeof fetch;
  timeoutMs?: number;
  token?: string;
};

const SAFE_MESSAGES: Record<HttpErrorCode, string> = {
  validation_error: 'Check the submitted data and try again.',
  forbidden: 'This action is not permitted.',
  not_found: 'The requested item was not found.',
  conflict: 'The request conflicts with the current state.',
  session_expired: 'The session has expired. Sign in again.',
  gone: 'This item is no longer available.',
  rate_limited: 'Too many attempts. Try again later.',
  provider_unavailable: 'The service is temporarily unavailable.',
  contract_mismatch: 'The service returned an unsupported response.',
  internal_error: 'The request could not be completed.'
};
const SERVER_CODES: Readonly<Record<string, HttpErrorCode>> = {
  VALIDATION_FAILED: 'validation_error',
  AMOUNT_OUT_OF_RANGE: 'validation_error',
  TRACKING_ACCOUNT_BLOCKED: 'conflict',
  IDEMPOTENCY_KEY_REQUIRED: 'validation_error',
  IDEMPOTENCY_KEY_REUSED: 'conflict',
  IDEMPOTENCY_IN_PROGRESS: 'conflict',
  INVALID_CURRENCY: 'validation_error',
  FORBIDDEN: 'forbidden',
  PROFILE_INACTIVE: 'forbidden',
  NOT_FOUND: 'not_found',
  FX_UNAVAILABLE: 'not_found',
  VERSION_CONFLICT: 'conflict',
  CATEGORY_USAGE_CHANGED: 'conflict',
  CATEGORY_INVALID: 'conflict',
  CATEGORY_CYCLE: 'conflict',
  ACCOUNT_CURRENCY_LOCKED: 'conflict',
  ACCOUNT_CLOSED: 'conflict',
  ACCOUNT_NOT_POSTABLE: 'conflict',
  CURRENCY_MISMATCH: 'conflict',
  TRANSACTION_NOT_EDITABLE: 'conflict',
  TRANSACTION_HAS_DEPENDENTS: 'conflict',
  REVERSAL_EXISTS: 'conflict',
  REFUND_EXCEEDS_AVAILABLE: 'conflict',
  UNDO_EXPIRED: 'conflict',
  FINANCIAL_ACCESS_DENIED: 'forbidden',
  RECENT_AUTH_REQUIRED: 'session_expired',
  LEDGER_BUSY: 'conflict',
  LEDGER_UNAVAILABLE: 'provider_unavailable',
  DUPLICATE_RESOURCE: 'conflict',
  LEDGER_NOT_AVAILABLE: 'conflict',
  AUTH_TOKEN_INVALID: 'session_expired',
  UNAUTHORIZED: 'session_expired',
  GONE: 'gone',
  RATE_LIMITED: 'rate_limited',
  SERVICE_UNAVAILABLE: 'provider_unavailable',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  PROFILE_SYNC_UNAVAILABLE: 'provider_unavailable',
  REFERENCE_UNAVAILABLE: 'provider_unavailable'
};
const PRIVATE_KEYS =
  /token|secret|password|authorization|cookie|path|payload|error/i;
let tokenProvider: TokenProvider | null = null;

export function configureMobileApiTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

export function sanitizeHttpLog(value: unknown): unknown {
  if (value instanceof Error) return '[REDACTED]';
  if (Array.isArray(value)) return value.map(sanitizeHttpLog);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      PRIVATE_KEYS.test(key) ? '[REDACTED]' : sanitizeHttpLog(entry)
    ])
  );
}

export async function requestJson<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions<T> = {}
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, options.timeoutMs ?? 15_000);
  let rejectAborted!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAborted = () => reject(new HttpError('provider_unavailable', 503));
    controller.signal.addEventListener('abort', rejectAborted, { once: true });
  });

  try {
    if (controller.signal.aborted)
      throw new HttpError('provider_unavailable', 503);
    const operation = (async () => {
      const token = options.token ?? (await tokenProvider?.());
      if (controller.signal.aborted)
        throw new HttpError('provider_unavailable', 503);
      if (!token) throw new HttpError('session_expired', 401);
      const headers = headerRecord(options.headers);
      setHeader(headers, 'accept', 'application/json');
      if (options.body !== undefined)
        setHeader(headers, 'content-type', 'application/json');
      setHeader(headers, 'Authorization', `Bearer ${token}`);

      const request = options.request ?? fetch;
      const baseUrl = (
        options.baseUrl ??
        process.env.EXPO_PUBLIC_API_URL ??
        ''
      ).replace(/\/+$/u, '');
      if (!baseUrl || !path.startsWith('/'))
        throw new HttpError('contract_mismatch', 500);
      const response = await request(`${baseUrl}${path}`, {
        method: options.method,
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      });

      if (response.status === 204)
        return parseKnownValue(schema, options, 'emptyValue');
      if (response.status === 304)
        return parseKnownValue(schema, options, 'notModifiedValue');
      if (!response.ok) throw await parseError(response);

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new HttpError('contract_mismatch', 502);
      }
      const parsed = schema.safeParse(payload);
      if (!parsed.success) throw new HttpError('contract_mismatch', 502);
      return parsed.data;
    })();
    return await Promise.race([operation, aborted]);
  } catch (error) {
    const failure = normalizeFailure(error, controller.signal.aborted);
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      try {
        console.info(
          '[mobile:http-failure]',
          sanitizeHttpLog({ path, error: failure, status: failure.status })
        );
      } catch {
        // Preserve the actual HTTP outcome when the Dev log sink is unavailable.
      }
    }
    throw failure;
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', rejectAborted);
    options.signal?.removeEventListener('abort', abort);
  }
}

async function parseError(response: Response): Promise<HttpError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return new HttpError('contract_mismatch', response.status);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return new HttpError('contract_mismatch', response.status);
  const code = Reflect.get(payload, 'code');
  const requestId = Reflect.get(payload, 'requestId');
  return new HttpError(
    typeof code === 'string'
      ? (SERVER_CODES[code] ?? 'contract_mismatch')
      : 'contract_mismatch',
    response.status,
    typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/u.test(code)
      ? code
      : undefined,
    typeof requestId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/u.test(requestId)
      ? requestId
      : undefined
  );
}

function parseKnownValue<T>(
  schema: z.ZodType<T>,
  options: RequestOptions<T>,
  key: 'emptyValue' | 'notModifiedValue'
): T {
  if (!(key in options)) throw new HttpError('contract_mismatch', 502);
  const parsed = schema.safeParse(options[key]);
  if (!parsed.success) throw new HttpError('contract_mismatch', 502);
  return parsed.data;
}

function normalizeFailure(error: unknown, aborted: boolean): HttpError {
  if (error instanceof HttpError) return error;
  if (
    aborted ||
    (error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TypeError'))
  )
    return new HttpError('provider_unavailable', 503);
  return new HttpError('internal_error', 500);
}

function headerRecord(value: HeadersInit | undefined): Record<string, string> {
  if (!value) return {};
  if (value instanceof Headers) return Object.fromEntries(value.entries());
  if (Array.isArray(value)) return Object.fromEntries(value);
  return { ...value };
}

function setHeader(
  headers: Record<string, string>,
  name: string,
  value: string
): void {
  for (const key of Object.keys(headers))
    if (key.toLowerCase() === name.toLowerCase()) delete headers[key];
  headers[name] = value;
}
