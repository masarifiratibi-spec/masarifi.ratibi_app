# T047-T051 Report

## Verdict

- Spec: **PASS**
- Quality: **APPROVED**

## Blocking findings

None.

## Scope

- `src/features/notifications/notification-policy.test.ts`
- `src/features/notifications/notification-policy.ts`

## Red evidence

- `npx jest --runInBand src/features/notifications/notification-policy.test.ts` failed because `notification-policy.ts` did not exist.

## Implementation

- Added pure notification delivery policy using `Intl.DateTimeFormat` for IANA-timezone quiet-hour checks.
- Covers category disabled, phone disabled, denied/permanently-denied/unavailable permission, quiet hours across midnight, the three critical access bypass event types only, summary deduplication, and daily/weekly summary projection.
- Added phone-copy rewriting that masks protected amounts when requested and returns accessibility text plus action labels.

## Verification

- `npx jest --runInBand src/features/notifications/notification-policy.test.ts`: 3/3 tests passed.
- `npm run typecheck`: passed.

## Round 1 fix evidence

- Cross-midnight quiet hours now attribute post-midnight time to the previous quiet-hour start weekday.
- Policy outcomes now use only values accepted by `notificationPolicyResultSchema`; summary dedupe is represented as `deduplicated: true` alongside the summary outcome.
- Masking is computed for every outcome from sensitivity plus global/preference hiding, and `suppress_private` is represented for security-sensitive hidden content.
- Phone copy rewriting preserves localization keys, masks interpolation values instead of treating keys as prose, and returns localization action-label keys.

## Round 1 verification

- `npx jest --runInBand src/features/notifications/notification-policy.test.ts`: 3/3 tests passed.
- `npm run typecheck`: passed.

## Round 2 fix evidence

- Global hide-balances now forces `hideSensitiveValues` for public/protected/security-sensitive events.
- `security_sensitive` events force masking and `suppress_private` independently of user lock-screen preferences.
- Added coverage for `not_requested`, daily and weekly summaries, and the public/protected/security-sensitive masking precedence cases.

## Round 2 verification

- `npx jest --runInBand src/features/notifications/notification-policy.test.ts`: 3/3 tests passed.
- `npm run typecheck`: passed.
