import { makeTransaction } from '@/test-utils/core-finance-fixtures';
import {
  buildTransactionSections,
  transactionPeriodKey
} from './transaction-sections';

const at = (day: number) => new Date(2026, 7, day, 12).getTime();
const now = at(19);

it.each([
  ['saturday', 19, 'today'],
  ['saturday', 18, 'yesterday'],
  ['saturday', 15, 'lastWeek'],
  ['saturday', 10, 'earlier'],
  ['sunday', 15, 'lastWeek'],
  ['monday', 15, 'lastWeek']
] as const)(
  'groups %s week-start day %s into %s',
  (firstDayOfWeek, day, expected) => {
    expect(transactionPeriodKey(at(day), now, firstDayOfWeek)).toBe(expected);
  }
);

it('uses the approved relative-time section keys', () => {
  expect(transactionPeriodKey(at(19), now, 'sunday')).toBe('today');
  expect(transactionPeriodKey(at(18), now, 'sunday')).toBe('yesterday');
  expect(transactionPeriodKey(at(15), now, 'sunday')).toBe('lastWeek');
  expect(transactionPeriodKey(at(10), now, 'sunday')).toBe('earlier');

  const sections = buildTransactionSections(
    [
      makeTransaction(1, { occurredAt: at(19) }),
      makeTransaction(2, { occurredAt: at(18) }),
      makeTransaction(3, { occurredAt: at(15) }),
      makeTransaction(4, { occurredAt: at(10) })
    ],
    now,
    'sunday'
  );

  expect(sections.map((section) => section.key)).toEqual([
    'today',
    'yesterday',
    'lastWeek',
    'earlier'
  ]);
});

it('builds ordered sections and grouped row positions', () => {
  const sections = buildTransactionSections(
    [
      makeTransaction(1, { occurredAt: at(19) }),
      makeTransaction(2, { occurredAt: at(19) }),
      makeTransaction(3, { occurredAt: at(18) })
    ],
    now,
    'sunday'
  );

  expect(sections.map((section) => section.key)).toEqual([
    'today',
    'yesterday'
  ]);
  expect(sections[0].items.map((item) => item.groupedPosition)).toEqual([
    'first',
    'last'
  ]);
  expect(sections[1].items[0].groupedPosition).toBe('only');
});
