# Task T024-T025 Brief

Plan source: D:/MY Work/0Part_Time/MASREFY _Final/apps/mobile/specs/009-assistant-notifications/tasks.md

Run commands from apps/mobile.

## Tasks

- [ ] T024 Write failing protected-settings tests in `src/storage/settings-storage.test.ts` for profile timezone/currency, application defaults, preserved security controls, and one global `hideBalances` owner; run `npm test -- --runInBand src/storage/settings-storage.test.ts` and confirm failure.
- [ ] T025 Implement `src/storage/settings-storage.ts` by composing `src/storage/secure-preferences.ts` and `src/state/preferences.ts`, and remove `hideBalances` from the privacy-lock preference shape in `src/features/security/privacy-lock.ts`; run `npm test -- --runInBand src/storage/settings-storage.test.ts src/features/security/privacy-lock.test.ts` and expect all tests to pass.

## Constraints

- No new dependency.
- Protected settings storage owns profile timezone/currency and application defaults.
- `src/state/preferences.ts` remains the single global owner for `hideBalances`.
- `privacy-lock` must preserve PIN, biometric, auto-lock, privacy-screen, failed-attempt lockout, and reset behavior, but must not persist a duplicate `hideBalances` field.
- Keep the diff minimal and scoped to the task files unless a direct test dependency requires a tiny adjustment.
- Follow TDD: write the storage test first, run it red, then implement.
