import { listPendingIosShortcutReviews } from './ios-shortcut-reviews';
import type { ReviewItem } from '@/domain/automatic-tracking';
test('fetches pending reviews through every cursor so an older pending capture remains reachable', async () => {
  const seen: unknown[] = [];
  const reviews = await listPendingIosShortcutReviews({
    assertCurrent: () => {},
    list: async (query) => {
      seen.push(query);
      return query?.cursor
        ? {
            items: [{ id: 'older-pending', status: 'pending' } as ReviewItem],
            nextCursor: null,
            total: 1
          }
        : {
            items: Array.from(
              { length: 50 },
              (_, i) =>
                ({ id: `pending-${i}`, status: 'pending' }) as ReviewItem
            ),
            nextCursor: 'next-page',
            total: 50
          };
    }
  });
  expect(reviews.items).toHaveLength(51);
  expect(reviews.items[50].id).toBe('older-pending');
  expect(seen).toEqual([
    { status: 'pending', pageSize: 100, cursor: null },
    { status: 'pending', pageSize: 100, cursor: 'next-page' }
  ]);
});
test('refuses pagination after the owner changes and rejects repeated cursors', async () => {
  let current = true;
  await expect(
    listPendingIosShortcutReviews({
      assertCurrent: () => {
        if (!current) throw Error('owner_changed');
      },
      list: async () => {
        current = false;
        return { items: [], nextCursor: 'next', total: 0 };
      }
    })
  ).rejects.toThrow('owner_changed');
  await expect(
    listPendingIosShortcutReviews({
      assertCurrent: () => {},
      list: async () => ({ items: [], nextCursor: 'same', total: 0 })
    })
  ).rejects.toThrow();
});
