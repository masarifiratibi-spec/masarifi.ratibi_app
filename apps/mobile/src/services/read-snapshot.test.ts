import { hasReadableSnapshot } from './read-snapshot';
import { HttpError } from './live/http-client';
import { CoreFinanceError } from './contracts/core-finance-service';

it.each([
  Object.assign(Error('assistant consent withdrawn'), {
    code: 'consent_required'
  }),
  Object.assign(Error('report permission'), { code: 'permission_required' }),
  Object.assign(Error('remote resource expired'), { code: 'expired' }),
  new HttpError('forbidden', 403),
  new HttpError('session_expired', 401),
  new HttpError('recent_auth_required', 403),
  new HttpError('not_found', 404),
  new HttpError('gone', 410),
  new CoreFinanceError('unknown', { status: 403 })
])(
  'refuses to replace authoritative access/deletion errors with saved data: %s',
  (error) => {
    expect(
      hasReadableSnapshot({ data: { amountMinor: 100 }, isError: true, error })
    ).toBe(false);
  }
);

it.each([
  new HttpError('provider_unavailable', 503),
  new CoreFinanceError('offline'),
  new Error('offline')
])(
  'retains a valid saved snapshot through a transport failure: %s',
  (error) => {
    expect(hasReadableSnapshot({ data: [], isError: true, error })).toBe(true);
  }
);

it('does not fabricate unavailable data', () => {
  expect(hasReadableSnapshot({ data: undefined, isError: false })).toBe(false);
  expect(hasReadableSnapshot({ data: null, isError: true })).toBe(false);
});
