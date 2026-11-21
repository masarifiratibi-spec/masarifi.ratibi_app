import { ScreenReadiness, classifyScreenReads } from './screen-readiness';
import {
  markOfflineSnapshot,
  markRemoteSnapshot,
  inheritReadProvenance
} from '@/services/read-snapshot';

const freshRead = {
  data: markRemoteSnapshot([]),
  isError: false,
  isFetching: false,
  dataUpdatedAt: 110
};

it('retains offline provenance for plain arrays and paginated local results without changing payloads', () => {
  const accounts: unknown[] = [];
  expect(markOfflineSnapshot(accounts)).toBe(accounts);
  expect(JSON.stringify(accounts)).toBe('[]');
  expect(classifyScreenReads([{ ...freshRead, data: accounts }], 100)).toBe(
    'offline'
  );
  const page = markOfflineSnapshot({ items: [], nextCursor: null });
  expect(
    classifyScreenReads(
      [{ ...freshRead, data: { pages: [page], pageParams: [null] } }],
      100
    )
  ).toBe('offline');
});

it('rejects retained cache timestamps after the wall clock moves backwards', () => {
  const now = Date.now();
  expect(
    classifyScreenReads(
      [{ ...freshRead, dataUpdatedAt: now + 60_000 }],
      now - 100
    )
  ).toBe('cached');
});

it('preserves mixed offline balance provenance through a derived Home summary', () => {
  const accounts = markRemoteSnapshot([]);
  const balances = markOfflineSnapshot([]);
  const summary = { balanceMinor: 0 };
  expect(inheritReadProvenance(summary, [accounts, balances])).toBe(summary);
  expect(classifyScreenReads([{ ...freshRead, data: summary }], 100)).toBe(
    'offline'
  );
});

it('requires validated data, positive layout and a subsequent frame before usability', () => {
  const screen = new ScreenReadiness();
  expect(screen.observe('pending')).toEqual([]);
  expect(screen.observe('fresh')).toEqual(['refreshed']);
  expect(screen.frame()).toEqual([]);
  expect(screen.layout(0, 100)).toEqual([]);
  expect(screen.layout(100, 100)).toEqual(['visible']);
  expect(screen.frame()).toEqual(['interactive']);
  expect(screen.frame()).toEqual([]);
});

it('distinguishes cached usability from completed authoritative refresh', () => {
  const screen = new ScreenReadiness();
  screen.layout(100, 100);
  expect(screen.observe('cached')).toEqual(['cached']);
  expect(screen.frame()).toEqual(['interactive']);
  expect(screen.observe('pending')).toEqual([]);
  expect(screen.frame()).toEqual([]);
  expect(screen.observe('fresh')).toEqual(['refreshed']);
  expect(screen.frame()).toEqual(['interactive']);
});

it.each(['failed', 'aborted'] as const)(
  'prevents late readiness after %s',
  (outcome) => {
    const screen = new ScreenReadiness();
    screen.layout(100, 100);
    expect(screen.finish(outcome)).toEqual([outcome]);
    expect(screen.observe('fresh')).toEqual([]);
    expect(screen.frame()).toEqual([]);
    expect(screen.finish(outcome)).toEqual([]);
  }
);

it.each([
  [[{ ...freshRead, data: undefined }], 'pending'],
  [[{ ...freshRead, dataUpdatedAt: 90 }], 'cached'],
  [[{ ...freshRead, isFetching: true }], 'cached'],
  [[{ ...freshRead, data: { dataState: 'offline' } }], 'offline'],
  [[{ ...freshRead, isError: true, error: { status: 403 } }], 'failed'],
  [[{ ...freshRead, isError: true, data: undefined }], 'failed'],
  [[{ ...freshRead, isError: true, error: { status: 503 } }], 'cached'],
  [[freshRead, { ...freshRead, dataUpdatedAt: 90 }], 'cached'],
  [[freshRead], 'fresh']
] as const)(
  'classifies required read state %# without treating a stale denial as readiness',
  (reads, expected) => {
    expect(classifyScreenReads(reads, 100)).toBe(expected);
  }
);
