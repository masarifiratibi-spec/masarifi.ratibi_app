import { resolveEffectiveTimeZone } from './effective-time-zone';
import { localDateInTimeZone } from './financial-period';

test('uses a valid profile, then device, and requires selection when neither exists', () => {
  expect(resolveEffectiveTimeZone('Asia/Riyadh', 'Asia/Dubai')).toBe(
    'Asia/Riyadh'
  );
  expect(resolveEffectiveTimeZone('Mars/Olympus', 'Asia/Dubai')).toBe(
    'Asia/Dubai'
  );
  expect(() => resolveEffectiveTimeZone('', 'invalid')).toThrow(
    'TIMEZONE_SELECTION_REQUIRED'
  );
});
test.each(['Asia/Riyadh', 'Asia/Dubai'])(
  'civil today in %s crosses UTC year boundary',
  (zone) => {
    expect(localDateInTimeZone(Date.parse('2026-12-31T21:30:00Z'), zone)).toBe(
      '2027-01-01'
    );
  }
);
