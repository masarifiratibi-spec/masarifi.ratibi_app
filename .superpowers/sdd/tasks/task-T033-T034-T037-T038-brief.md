# Task T033-T034-T037-T038 Brief

Plan source: D:/MY Work/0Part_Time/MASREFY _Final/apps/mobile/specs/009-assistant-notifications/tasks.md

Run commands from apps/mobile.

## Tasks

- [ ] T033 [US1] Write a failing notification-center journey in `src/features/notifications/NotificationCenterScreen.test.tsx` covering all eight views, date groups, unread badge, dense/offline/sync/deleted-target/action-expired states, safe navigation, and source-safe deletion.
- [ ] T034 [US1] Write failing route ownership tests in `src/features/notifications/NotificationsRoutes.test.tsx` for `/notifications` and thin route modules without SQLite access.
- [ ] T037 [US1] Implement `src/features/notifications/NotificationCenterScreen.tsx` with `FlatList`, existing `StateView`, `StatusBadge`, `SensitiveValue`, and `ConfirmationDialog`.
- [ ] T038 [US1] Add `app/notifications/_layout.tsx` and `app/notifications/index.tsx` as thin render-only routes for the notification center.

## Constraints

- No direct SQLite/storage import in screen or route files.
- Use query hooks from `src/features/notifications/notification-queries.ts`; do not create a second data store.
- Safe navigation only through typed/sanitized targets. Deleted target and expired action must show fallback states, not raw errors.
- Deleting a notification must call the notification delete mutation only; never delete linked source records.
- Keep route files thin render-only modules.
- Reuse existing primitives where available: `FlatList`, `StateView`, `StatusBadge`, `SensitiveValue`, `ConfirmationDialog`, `NotificationBadge`.
- Keep strings simple and localizable-ready; no production/external success claims.
