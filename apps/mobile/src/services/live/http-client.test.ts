import { z } from 'zod';
import {
  HttpError,
  configureMobileApiTokenProvider,
  configureRecentAuthHandler,
  requestJson,
  sanitizeHttpLog
} from './http-client';

const schema = z.object({ state: z.enum(['ready']) }).strict();
const response = (status: number, value?: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(value)
  }) as unknown as Response;

describe('Mobile strict HTTP client', () => {
  it('reverifies once and retries the same mutation identity with a fresh credential', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(response(403, { code: 'RECENT_AUTH_REQUIRED' }))
      .mockResolvedValueOnce(response(200, { state: 'ready' }));
    configureRecentAuthHandler(async () => 'fresh-token');
    try {
      await expect(
        requestJson('/api/v1/transactions', schema, {
          baseUrl: 'https://inert.invalid',
          token: 'old-token',
          method: 'POST',
          headers: { 'Idempotency-Key': 'same-operation' },
          body: { amountMinor: 5000 },
          request
        })
      ).resolves.toEqual({ state: 'ready' });
      const [first, second] = request.mock.calls.map(
        (call) => call[1] as RequestInit
      );
      expect(second.body).toBe(first.body);
      expect(second.headers).toMatchObject({
        Authorization: 'Bearer fresh-token',
        'Idempotency-Key': 'same-operation'
      });
    } finally {
      configureRecentAuthHandler();
    }
  });
  it('does not replay a cancelled or repeatedly rejected step-up', async () => {
    const request = jest.fn(async () =>
      response(403, { code: 'RECENT_AUTH_REQUIRED' })
    );
    configureRecentAuthHandler(async () => null);
    try {
      await expect(
        requestJson('/api/v1/transactions', schema, {
          baseUrl: 'https://inert.invalid',
          token: 'token',
          request
        })
      ).rejects.toMatchObject({ code: 'recent_auth_required' });
      expect(request).toHaveBeenCalledTimes(1);
      configureRecentAuthHandler(async () => 'fresh-token');
      await expect(
        requestJson('/api/v1/transactions', schema, {
          baseUrl: 'https://inert.invalid',
          token: 'token',
          request
        })
      ).rejects.toMatchObject({ code: 'recent_auth_required' });
      expect(request).toHaveBeenCalledTimes(3);
    } finally {
      configureRecentAuthHandler();
    }
  });
  it.each(['network', 'timeout', 'server', 'auth'] as const)(
    'preserves %s provenance for honest startup recovery',
    async (kind) => {
      const request = jest.fn(async () => {
        if (kind === 'timeout') return new Promise<Response>(() => {});
        if (kind === 'network') throw new TypeError('Failed to fetch');
        return response(kind === 'auth' ? 401 : 503, {
          code: kind === 'auth' ? 'UNAUTHORIZED' : 'SERVICE_UNAVAILABLE'
        });
      });
      const failure = await requestJson('/api/v1/me', schema, {
        baseUrl: 'https://inert.invalid',
        token: 'token',
        request,
        timeoutMs: 5
      }).catch((error: unknown) => error);
      expect(failure).toMatchObject({
        code: kind === 'auth' ? 'session_expired' : 'provider_unavailable'
      });
      expect(
        (failure as HttpError & { failureSource?: string }).failureSource
      ).toBe(kind === 'network' || kind === 'timeout' ? kind : undefined);
    }
  );
  it.each<HeadersInit>([
    { Accept: 'application/json; currency-onboarding=1' },
    { accept: 'application/json; currency-onboarding=1' },
    [['Accept', 'application/json; currency-onboarding=1']] as [
      string,
      string
    ][]
  ])(
    'preserves negotiated Accept through the authenticated transport',
    async (headers) => {
      const request = jest
        .fn()
        .mockResolvedValue(response(200, { state: 'ready' }));
      await requestJson('/api/v1/me/preferences', schema, {
        baseUrl: 'https://inert.invalid',
        token: 'real-owner-token',
        request,
        headers
      });
      const sent = new Headers(request.mock.calls[0][1].headers);
      expect(sent.get('accept')).toBe(
        'application/json; currency-onboarding=1'
      );
      expect(sent.get('authorization')).toBe('Bearer real-owner-token');
    }
  );

  it.each(['server', 'cancelled', 'timeout', 'network'] as const)(
    'distinguishes %s failures from an actual HTTP 503 without logging protected data',
    async (kind) => {
      const log = jest
        .spyOn(console, 'info')
        .mockImplementation(() => undefined);
      const controller = new AbortController();
      if (kind === 'cancelled') controller.abort();
      const request = jest.fn(async () => {
        if (kind === 'server')
          return response(503, {
            code: 'LEDGER_UNAVAILABLE',
            requestId: 'safe-request-503',
            message: 'private balance'
          });
        if (kind === 'timeout') return new Promise<Response>(() => {});
        throw new TypeError('private network information');
      });
      try {
        await expect(
          requestJson('/api/v1/transactions?account=private-owner', schema, {
            baseUrl: 'https://inert.invalid',
            token: 'private-token',
            request,
            signal: controller.signal,
            timeoutMs: 5
          })
        ).rejects.toMatchObject({ status: 503, code: 'provider_unavailable' });
        expect(log).toHaveBeenCalledWith(
          '[mobile:http-failure]',
          expect.objectContaining({
            failureSource: kind === 'server' ? 'http_response' : kind,
            httpStatus: kind === 'server' ? 503 : null,
            endpointGroup: 'ledger',
            method: 'GET',
            status: 503,
            elapsedMs: expect.any(Number)
          })
        );
        expect(JSON.stringify(log.mock.calls)).not.toMatch(
          /private-owner|private-token|private balance|private network/
        );
        expect(request).toHaveBeenCalledTimes(kind === 'cancelled' ? 0 : 1);
      } finally {
        log.mockRestore();
      }
    }
  );
  it('preserves a definite ledger rejection when debug logging fails', async () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('diagnostic sink unavailable');
    });
    try {
      await expect(
        requestJson('/api/v1/transactions', schema, {
          baseUrl: 'https://inert.invalid',
          token: 'fixture',
          request: async () =>
            response(400, {
              code: 'VALIDATION_FAILED',
              requestId: 'request-400'
            })
        })
      ).rejects.toMatchObject({
        code: 'validation_error',
        status: 400,
        domainCode: 'VALIDATION_FAILED',
        requestId: 'request-400'
      });
    } finally {
      log.mockRestore();
    }
  });
  it('retains safe correlation for an unknown server code without treating it as a definite rejection', async () => {
    await expect(
      requestJson('/api/v1/transactions', schema, {
        baseUrl: 'https://api.example',
        token: 'fixture',
        request: async () =>
          response(400, {
            code: 'FUTURE_VALIDATION_CODE',
            requestId: '22222222-2222-4222-8222-222222222222',
            message: 'private contents'
          })
      })
    ).rejects.toMatchObject({
      code: 'contract_mismatch',
      status: 400,
      domainCode: 'FUTURE_VALIDATION_CODE',
      requestId: '22222222-2222-4222-8222-222222222222'
    });
  });
  it.each([
    ['AMOUNT_OUT_OF_RANGE', 400, 'validation_error'],
    ['AMOUNT_BELOW_REFUNDED', 409, 'conflict'],
    ['TRACKING_ACCOUNT_BLOCKED', 409, 'conflict']
  ])(
    'preserves the definite %s rejection and its request correlation',
    async (domainCode, status, code) => {
      await expect(
        requestJson('/api/v1/transactions', schema, {
          baseUrl: 'https://api.example',
          token: 'fixture',
          request: async () =>
            response(status as number, {
              code: domainCode,
              requestId: 'request-finance-1',
              message: 'private note'
            })
        })
      ).rejects.toMatchObject({
        code,
        status,
        domainCode,
        requestId: 'request-finance-1'
      });
    }
  );
  it('retains only allowlisted domain/status/request metadata for actionable finance feedback', async () => {
    await expect(
      requestJson('/api/v1/transactions', schema, {
        baseUrl: 'https://api.example',
        token: 'fixture',
        request: jest.fn().mockResolvedValue(
          response(409, {
            code: 'ACCOUNT_NOT_POSTABLE',
            requestId: 'request-fixture-1',
            message: 'private contents'
          })
        )
      })
    ).rejects.toMatchObject({
      code: 'conflict',
      status: 409,
      domainCode: 'ACCOUNT_NOT_POSTABLE',
      requestId: 'request-fixture-1'
    });
  });
  beforeEach(() =>
    configureMobileApiTokenProvider(async () => 'clerk-session')
  );

  it('injects the Clerk bearer and preserves idempotency and version headers', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(response(200, { state: 'ready' }));

    await expect(
      requestJson('/api/v1/me', schema, {
        baseUrl: 'https://api.example',
        request,
        method: 'PATCH',
        body: { locale: 'en' },
        headers: {
          Authorization: 'Bearer attacker',
          'Idempotency-Key': 'profile-1',
          'If-Match': '"7"'
        }
      })
    ).resolves.toEqual({ state: 'ready' });

    expect(request).toHaveBeenCalledWith(
      'https://api.example/api/v1/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: 'application/json',
          Authorization: 'Bearer clerk-session',
          'Idempotency-Key': 'profile-1',
          'If-Match': '"7"'
        })
      })
    );
  });

  it('decodes flat safe errors and rejects unsupported codes without leaking messages', async () => {
    const known = jest.fn().mockResolvedValue(
      response(422, {
        code: 'VALIDATION_FAILED',
        message: 'secret provider detail'
      })
    );
    await expect(
      requestJson('/known', schema, {
        baseUrl: 'https://api.example',
        request: known
      })
    ).rejects.toMatchObject({ code: 'validation_error' });

    const unknown = jest
      .fn()
      .mockResolvedValue(
        response(500, { code: 'NEW_FATAL_STATE', message: 'secret token' })
      );
    const failure = await requestJson('/unknown', schema, {
      baseUrl: 'https://api.example',
      request: unknown
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({ code: 'contract_mismatch' });
    expect((failure as Error).message).not.toContain('secret');
  });

  it.each([
    ['CATEGORY_INVALID', 'conflict'],
    ['CATEGORY_CYCLE', 'conflict'],
    ['ACCOUNT_CURRENCY_LOCKED', 'conflict'],
    ['ACCOUNT_CLOSED', 'conflict'],
    ['DUPLICATE_RESOURCE', 'conflict'],
    ['LEDGER_NOT_AVAILABLE', 'conflict'],
    ['IDEMPOTENCY_KEY_REQUIRED', 'validation_error'],
    ['IDEMPOTENCY_KEY_REUSED', 'conflict'],
    ['IDEMPOTENCY_IN_PROGRESS', 'conflict'],
    ['INVALID_CURRENCY', 'validation_error'],
    ['PROFILE_INACTIVE', 'forbidden'],
    ['REFERENCE_UNAVAILABLE', 'provider_unavailable'],
    ['PROVIDER_UNAVAILABLE', 'provider_unavailable'],
    ['PROFILE_SYNC_UNAVAILABLE', 'provider_unavailable']
  ] as const)('maps the BE004 %s error', async (serverCode, clientCode) => {
    await expect(
      requestJson('/reference', schema, {
        baseUrl: 'https://api.example',
        request: jest
          .fn()
          .mockResolvedValue(
            response(409, { code: serverCode, message: 'safe' })
          )
      })
    ).rejects.toMatchObject({ code: clientCode });
  });

  it('requires explicit values for 204 and 304 responses', async () => {
    await expect(
      requestJson('/empty', z.null(), {
        baseUrl: 'https://api.example',
        request: jest.fn().mockResolvedValue(response(204)),
        emptyValue: null
      })
    ).resolves.toBeNull();
    await expect(
      requestJson('/cached', schema, {
        baseUrl: 'https://api.example',
        request: jest.fn().mockResolvedValue(response(304)),
        notModifiedValue: { state: 'ready' }
      })
    ).resolves.toEqual({ state: 'ready' });
    await expect(
      requestJson('/missing-empty', z.null(), {
        baseUrl: 'https://api.example',
        request: jest.fn().mockResolvedValue(response(204))
      })
    ).rejects.toMatchObject({ code: 'contract_mismatch' });
  });

  it('fails explicitly on malformed JSON and unknown response states', async () => {
    const malformed = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new SyntaxError('bad json'))
    } as unknown as Response);
    await expect(
      requestJson('/malformed', schema, {
        baseUrl: 'https://api.example',
        request: malformed
      })
    ).rejects.toMatchObject({ code: 'contract_mismatch' });
    await expect(
      requestJson('/state', schema, {
        baseUrl: 'https://api.example',
        request: jest.fn().mockResolvedValue(response(200, { state: 'future' }))
      })
    ).rejects.toMatchObject({ code: 'contract_mismatch' });
  });

  it('fails safely on timeouts and caller aborts', async () => {
    const pending = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const abort = () =>
            reject(
              Object.assign(new Error('aborted token=secret'), {
                name: 'AbortError'
              })
            );
          if (init?.signal?.aborted) abort();
          else init?.signal?.addEventListener('abort', abort);
        })
    );
    await expect(
      requestJson('/slow', schema, {
        baseUrl: 'https://api.example',
        request: pending as typeof fetch,
        timeoutMs: 5
      })
    ).rejects.toMatchObject({ code: 'provider_unavailable' });

    const controller = new AbortController();
    controller.abort();
    await expect(
      requestJson('/aborted', schema, {
        baseUrl: 'https://api.example',
        request: pending as typeof fetch,
        signal: controller.signal
      })
    ).rejects.toMatchObject({ code: 'provider_unavailable' });
  });

  it('terminates a hung token acquisition instead of leaving bootstrap pending', async () => {
    jest.useFakeTimers();
    configureMobileApiTokenProvider(() => new Promise(() => {}));
    let failure: unknown;
    const request = requestJson('/api/v1/me', schema, {
      baseUrl: 'https://api.example',
      timeoutMs: 10
    }).catch((error: unknown) => {
      failure = error;
    });
    await jest.advanceTimersByTimeAsync(10);
    try {
      expect(failure).toMatchObject({ code: 'provider_unavailable' });
      await request;
    } finally {
      jest.useRealTimers();
    }
  });

  it('redacts request paths, tokens, payloads, and errors from logs', () => {
    expect(
      sanitizeHttpLog({
        path: '/api/v1/me?email=person@example.test',
        authorization: 'Bearer secret',
        payload: { name: 'Person' },
        error: new Error('token secret'),
        status: 500
      })
    ).toEqual({
      path: '[REDACTED]',
      authorization: '[REDACTED]',
      payload: '[REDACTED]',
      error: '[REDACTED]',
      status: 500
    });
  });
});
