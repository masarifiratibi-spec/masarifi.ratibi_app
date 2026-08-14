# Task T026-T030 Brief

Plan source: D:/MY Work/0Part_Time/MASREFY _Final/apps/mobile/specs/009-assistant-notifications/tasks.md

Run commands from apps/mobile.

## Tasks

- [ ] T026 [P] Write failing analytics allowlist/rejection tests in `src/analytics/assistant-notifications-events.test.ts` for fixed event names and scalar outcomes, rejecting amounts, currency-linked values, titles/bodies, questions/answers, source IDs, contact data, ticket text, credentials, nested objects, and user-authored strings; run the file and confirm failure.
- [ ] T027 [P] Implement the fixed event and property unions plus reject-on-sensitive-input guard in `src/analytics/assistant-notifications-events.ts`; run `npm test -- --runInBand src/analytics/assistant-notifications-events.test.ts` and expect all tests to pass.
- [ ] T028 [P] Add deterministic catalogs and builders for offers, help/What's New, sessions, security events, notification events, assistant contexts, and 1,000-item histories in `src/test-utils/assistant-notifications-fixtures.ts`; run `npm run typecheck` and expect zero errors.
- [ ] T029 Write failing destination normalization tests in `src/features/shell/navigation-context.test.ts` and `src/features/shell/resolve-entry-route.test.ts` for every new static route, typed dynamic route, rejected raw URL/query, safe fallback, and unlock destination; run both files and confirm the new cases fail.
- [ ] T030 Extend `src/features/shell/navigation-context.ts` and `src/features/shell/resolve-entry-route.ts` with approved SPEC-009 destinations only; run `npm test -- --runInBand src/features/shell/navigation-context.test.ts src/features/shell/resolve-entry-route.test.ts` and expect all tests to pass.

## Constraints

- No new dependencies.
- Analytics payloads are fixed-name, scalar-only, and must reject protected values, user-authored strings, IDs, titles/bodies, question/answer text, support text/contact data, credentials, nested arrays/objects, amounts, and currency-linked values.
- Native notification payloads later must use IDs only; do not build phone or provider logic here.
- Fixtures must be deterministic and type-safe; keep them as plain builders/catalogs.
- Route normalization must allow only approved SPEC-009 static routes and typed dynamic routes. Reject raw URLs, query strings, unsafe params, and sensitive destinations. Unlock flow must return a safe destination/fallback.
- Preserve existing shell route behavior for auth/onboarding/security gates.
