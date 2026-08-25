# Auth Required Evidence

Date: 2026-08-15

Implemented:

- `app/modals/auth-required.tsx` now uses `RouteModalContainer`.
- Preserved `sanitizeReturnRoute`, `setPendingDestination`, `router.replace('/(public)/sign-in')`, and `router.back()`.
- Replaced generic placeholder route use only for this modal.
- Added localized explanation text in English and Arabic.

Checks:

- `src/features/shell/NavigationJourney.test.tsx`: PASS after fixing duplicate title regression.
- `src/features/shell/ProtectedNavigation.test.tsx`: PASS, 10 tests.
- `src/features/shell/AppShellLocalization.test.tsx`: PASS in full focused suite.
- `src/features/shell/AppShellAccessibility.test.tsx`: PASS in full focused suite.
- `npm run typecheck`: PASS.
- `npm run check:app-shell`: PASS, 750 files checked.

Async duplicate-submit loading/error treatment for this route remains open.
