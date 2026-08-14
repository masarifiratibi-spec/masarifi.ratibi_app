# Task T031-T032-T035-T036 Brief

Plan source: D:/MY Work/0Part_Time/MASREFY _Final/apps/mobile/specs/009-assistant-notifications/tasks.md

Run commands from apps/mobile.

## Tasks

- [ ] T031 [US1] Write failing `NotificationService` behavior tests in `src/services/mocks/assistant-notifications-service.test.ts` for create/list/get, event-key deduplication, correction/reversal distinction, filtered mark-all, delete-only semantics, target resolution, action expiry/version checks, and idempotent execution.
- [ ] T032 [US1] Write failing query-key and invalidation tests in `src/features/notifications/notification-queries.test.ts` for list/filter/page, detail, unread count, mark-read, filtered mark-all, and delete mutations.
- [ ] T035 [US1] Implement notification methods of `src/services/mocks/assistant-notifications-service.ts` by composing `src/storage/assistant-notifications-repository.ts` and canonical owner service resolution callbacks.
- [ ] T036 [US1] Implement notification keys, paged queries, derived unread count, and narrowly scoped mutations in `src/features/notifications/notification-queries.ts`.

## Constraints

- No screen or route implementation in this slice.
- Remove any unfinished T033/T034 screen/route test files before reporting unless you finish their implementation too.
- Local mock service only; no provider SDKs, push tokens, external success copy, or event bus.
- Service must preserve source records: delete only tombstones the notification.
- Idempotent operations must replay by operation ID for mark-all/delete/execute.
- Action revalidation must check target availability, expiry, source version, and action presence.
- Query invalidation must stay under notification keys and not invalidate unrelated finance/report/support caches.
