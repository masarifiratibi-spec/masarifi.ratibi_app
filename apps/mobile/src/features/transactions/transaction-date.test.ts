import { replaceLocalDate } from './transaction-date';

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
