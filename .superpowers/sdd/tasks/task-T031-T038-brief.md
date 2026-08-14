# Task T031-T038 Brief

Plan source: D:/MY Work/0Part_Time/MASREFY _Final/apps/mobile/specs/009-assistant-notifications/tasks.md

Run commands from apps/mobile.

## Tasks

- [ ] T031 [P] [US1] Write failing `NotificationService` behavior tests in `src/services/mocks/assistant-notifications-service.test.ts` for create/list/get, event-key deduplication, correction/reversal distinction, filtered mark-all, delete-only semantics, target resolution, action expiry/version checks, and idempotent execution; run the file and confirm failure.
- [ ] T032 [P] [US1] Write a failing query-key and invalidation test in `src/features/notifications/notification-queries.test.ts` for list/filter/page, detail, unread count, mark-read, filtered mark-all, and delete mutations; run the file and confirm failure.
- [ ] T033 [P] [US1] Write a failing notification-center journey in `src/features/notifications/NotificationCenterScreen.test.tsx` covering all eight views, date groups, unread badge, dense/offline/sync/deleted-target/action-expired states, safe navigation, and source-safe deletion; run the file and confirm failure.
- [ ] T034 [P] [US1] Write failing route ownership tests in `src/features/notifications/NotificationsRoutes.test.tsx` for `/notifications` and thin route modules without SQLite access; run the file and confirm failure.
- [ ] T035 [US1] Implement the notification methods of `src/services/mocks/assistant-notifications-service.ts` by composing `src/storage/assistant-notifications-repository.ts` and canonical owner services; run `npm test -- --runInBand src/services/mocks/assistant-notifications-service.test.ts` and expect all tests to pass.
- [ ] T036 [US1] Implement notification keys, paged queries, derived unread count, and narrowly scoped mutations in `src/features/notifications/notification-queries.ts`; run `npm test -- --runInBand src/features/notifications/notification-queries.test.ts` and expect all tests to pass.
- [ ] T037 [US1] Implement `src/features/notifications/NotificationCenterScreen.tsx` with `FlatList`, existing `StateView`, `StatusBadge`, `SensitiveValue`, and `ConfirmationDialog`; run the notification-center test and expect all cases to pass.
- [ ] T038 [US1] Add `app/notifications/_layout.tsx` and `app/notifications/index.tsx` as thin render-only routes for the notification center; run `npm test -- --runInBand src/features/notifications/NotificationsRoutes.test.tsx` and expect all tests to pass.

## Constraints

- Local mock service only; no push tokens, provider SDKs, AI/payment/support providers, or external success claims.
- Compose `src/storage/assistant-notifications-repository.ts`; screens/routes must not access SQLite.
- Native payload later is ID-only; keep notification actions target/action-safe.
- Deleting notifications is delete-only and must never delete source finance/assistant records.
- Use TanStack Query for service-shaped data; no new Zustand entity store.
- Reuse existing UI primitives (`StateView`, `StatusBadge`, `SensitiveValue`, `ConfirmationDialog`) where present.
- Keep routes thin render-only modules.
