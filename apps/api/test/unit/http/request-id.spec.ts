import { normalizeRequestId } from '../../../src/platform/http/request-id.middleware';

describe('normalizeRequestId', () => {
  it('propagates a valid bounded caller ID', () => {
    expect(normalizeRequestId('req_123:test')).toBe('req_123:test');
  });

  it.each([undefined, '', 'x'.repeat(129), 'bad id', 'Bearer token'])(
    'replaces an absent or malformed ID',
    (value) => {
      expect(normalizeRequestId(value)).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    },
  );
});
