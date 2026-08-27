import { safeError } from '../../../src/platform/http/safe-exception.filter';

describe('safeError', () => {
  it('maps internal errors to a stable bounded envelope', () => {
    const result = safeError(500, 'req-123');

    expect(result).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId: 'req-123',
    });
    expect(JSON.stringify(result)).not.toMatch(/secret|postgresql|private|stack/i);
  });

  it('preserves only approved client status categories', () => {
    expect(safeError(401, 'req-1')).toMatchObject({
      code: 'UNAUTHORIZED',
      requestId: 'req-1',
    });
    expect(safeError(503, 'req-2')).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      requestId: 'req-2',
    });
  });

  it('bounds and sanitizes validation field errors', () => {
    const unsafe = Array.from({ length: 51 }, (_, index) => ({
      field: index === 0 ? 'password=/private/path' : `field${String(index)}`,
      code: 'invalid code',
      message: 'postgresql://user:secret@db/internal stack',
    }));

    const result = safeError(400, 'req-3', unsafe);

    expect(result.fieldErrors).toHaveLength(50);
    expect(result.fieldErrors?.[0]).toEqual({
      field: 'request',
      code: 'INVALID',
      message: 'Invalid value',
    });
    expect(JSON.stringify(result)).not.toMatch(/password|private|postgresql|secret|stack/i);
  });
});
