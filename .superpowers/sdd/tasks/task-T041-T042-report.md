# T041-T042 Review

## Verdict

- Spec: **PASS**
- Quality: **APPROVED**

## Blocking findings

None.

## Verified

- The central `NotificationService.createFromSource` seam replaces the obsolete helper and defaults to `assistantNotificationsService`.
- No obsolete-helper caller remains under `src`.
- Focused Jest suites pass: 3/3 tests.
- TypeScript typecheck passes.

## Round 1 fix evidence

- Duplicate review decisions now emit one `duplicate` notification instead of both `review-required` and `duplicate`.
- Repeated undo on already-undone feedback returns the current feedback before owner deletion or notification emission.
- The test retries undo and asserts one owner delete plus one `tracking:expense:undone` notification.

## Round 1 verification

- `npx jest --runInBand src/services/mocks/automatic-tracking-service.test.ts src/features/tracking/AutomaticTrackingPrivacy.test.tsx`: 3/3 tests passed.
- `npm run typecheck`: passed.

## Round 2 fix evidence

- Concurrent undo replays are now guarded by feedback ID, so one in-flight/completed undo promise owns the delete and notification emission.
- Failed undo attempts evict the guard so expired/offline failures can retry safely later.
- The test now uses `Promise.all` repeated undo and still asserts one owner delete plus one undone notification.

## Round 2 verification

- `npx jest --runInBand src/services/mocks/automatic-tracking-service.test.ts src/features/tracking/AutomaticTrackingPrivacy.test.tsx`: 3/3 tests passed.
- `npm run typecheck`: passed after the unrelated in-progress More-menu localization key was completed.
