import { replaceLocalDate } from './transaction-date';

it('bounds Today to now instead of keeping yesterday evening time in Manual Add', () => {
  const now = new Date(2026, 9, 5, 10).getTime();
  const yesterday = new Date(2026, 9, 4, 21, 30).getTime();
  expect(replaceLocalDate(yesterday, now, now)).toBe(now);
});

it('changes the calendar day while preserving the local time', () => {
  const original = new Date(2026, 7, 8, 16, 37, 12, 250).getTime();
  const selected = new Date(2026, 8, 21).getTime();

  const changed = new Date(replaceLocalDate(original, selected));

  expect([
    changed.getFullYear(),
    changed.getMonth(),
    changed.getDate(),
    changed.getHours(),
    changed.getMinutes(),
    changed.getSeconds(),
    changed.getMilliseconds()
  ]).toEqual([2026, 8, 21, 16, 37, 12, 250]);
});
