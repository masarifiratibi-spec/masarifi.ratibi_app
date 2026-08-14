# T045-T046 Report

## Verdict

- Spec: **PASS**
- Quality: **APPROVED**

## Blocking finding

None.

## Scope

- `src/features/shell/NavigationJourney.test.tsx`
- `app/(tabs)/more.tsx`
- `src/components/MenuLink.tsx`
- `src/localization/messages/en.ts`
- `src/localization/messages/ar.ts`

## Red evidence

- `npx jest --runInBand src/features/shell/NavigationJourney.test.tsx` failed because the More menu had no notification unread badge/entry.

## Implementation

- More menu now includes a notifications row that navigates to `/notifications`.
- The row uses existing `MenuLink` and existing `NotificationBadge`.
- `MenuLink` has a minimal optional `accessory` slot for the badge.
- Added English/Arabic `appShell.shell.notifications` localization key.

## Verification

- `npx jest --runInBand src/features/shell/NavigationJourney.test.tsx`: 3/3 tests passed.
- `npm run typecheck`: passed.

## Round 1 fix evidence

- The notification row itself now announces the unread count via `accessibilityLabel` and `accessibilityValue`.
- The visual `NotificationBadge` supports `decorative` mode and is hidden from accessibility when used inside the accessible row.
- The navigation test now presses the actionable row label with the count.

## Round 1 verification

- `npx jest --runInBand src/features/shell/NavigationJourney.test.tsx src/design-system/components/feedback/StateFeedback.test.tsx`: 12/12 tests passed.
- `npm run typecheck`: passed.

## Round 2 fix evidence

- Decorative `NotificationBadge` now uses `importantForAccessibility="no-hide-descendants"` so the nested count text is not exposed separately.
- Removed hardcoded English `accessibilityValue`; the localized row label carries the unread count once.
- State feedback test verifies decorative badge has no accessibility label.

## Round 2 verification

- `npx jest --runInBand src/features/shell/NavigationJourney.test.tsx src/design-system/components/feedback/StateFeedback.test.tsx`: 12/12 tests passed.
- `npm run typecheck`: passed.
