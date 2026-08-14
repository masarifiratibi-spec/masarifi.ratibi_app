# Task T039-T040 Brief

Plan source: D:/MY Work/0Part_Time/MASREFY _Final/apps/mobile/specs/009-assistant-notifications/tasks.md

Run commands from apps/mobile.

## Tasks

- [ ] T039 [US1] Write failing typed-target and protected-action controller tests in `src/features/notifications/notification-response-controller.test.ts` for exact/fallback/unavailable targets, startup/live replay, unlock-first behavior, revalidation, expiry, and at-most-once operation IDs.
- [ ] T040 [US1] Implement the shared cold/live response pipeline in `src/features/notifications/notification-response-controller.ts` as event ID to trusted resolution to unlock to revalidation to route/action.

## Constraints

- No direct SQLite/storage imports. Use `NotificationService` contract methods.
- Native response payload contains notification ID and action only; never trust route URLs or sensitive text from native payload.
- Pipeline order: notification ID -> service target resolution -> unlock if protected -> revalidate action -> route or execute action.
- View/edit routes must use safe typed target mapping. Protected undo/edit actions must generate stable operation IDs and execute at most once.
- Cold-start last response and live response subscription must replay through the same handler and unsubscribe cleanly.
- Expired/unavailable/deleted target cases must land on safe fallback, not raw errors.
