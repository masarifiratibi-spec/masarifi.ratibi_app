import type { ReviewItem } from '@/domain/automatic-tracking';
import type {
  AutomaticTrackingService,
  TrackingPage
} from '@/services/contracts/automatic-tracking-service';

export async function listPendingIosShortcutReviews(ports: {
  list: AutomaticTrackingService['listReviewItems'];
  assertCurrent(): void;
}): Promise<TrackingPage<ReviewItem>> {
  const reviews = new Map<string, ReviewItem>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    ports.assertCurrent();
    const page = await ports.list({ status: 'pending', pageSize: 100, cursor });
    ports.assertCurrent();
    for (const review of page.items)
      if (review.status === 'pending') reviews.set(review.id, review);
    cursor = page.nextCursor;
    if (cursor && cursors.has(cursor))
      throw Error('ios_shortcut_review_cursor_loop');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return {
    items: [...reviews.values()],
    nextCursor: null,
    total: reviews.size
  };
}
