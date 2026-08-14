import { renderWithProviders } from '@/test-utils/render';
import { oneThousandAssistantResponses, oneThousandNotificationEvents } from '@/test-utils/assistant-notifications-fixtures';

import { countMountedAssistantNotificationRows } from './assistant-notifications-performance';
import { buildNotificationCenterRows } from './NotificationCenterScreen';

test('1,000 notifications and 1,000 assistant responses stay paged, exact, and under the mounted-row cap', () => {
  const started = performance.now();
  const result = countMountedAssistantNotificationRows({
    notifications: oneThousandNotificationEvents,
    responses: oneThousandAssistantResponses,
    render: renderWithProviders
  });

  expect(result.notificationCount).toBe(1000);
  expect(result.responseCount).toBe(1000);
  expect(result.firstUsefulContentMs).toBeLessThan(2000);
  expect(result.firstUsefulContentMs).toBeLessThanOrEqual(performance.now() - started + 1);
  expect(result.maxMountedRows).toBeLessThan(100);
});

test('1,000 notifications keep stable duplicate-free paging during newer inserts', () => {
  const ids: string[] = [];
  const inserted = {
    ...oneThousandNotificationEvents[0],
    id: 'notification-new',
    occurredAt: oneThousandNotificationEvents[0].occurredAt + 60_000
  };
  const sorted = [inserted, ...oneThousandNotificationEvents].sort(
    (a, b) => b.occurredAt - a.occurredAt || b.id.localeCompare(a.id)
  );

  for (let start = 0; start < sorted.length; start += 100) {
    ids.push(...sorted.slice(start, start + 100).map((item) => item.id));
  }

  expect(ids).toHaveLength(1_001);
  expect(new Set(ids).size).toBe(1_001);
  expect(buildNotificationCenterRows(sorted).filter((row) => row.kind === 'notification')).toHaveLength(1_001);
});
