# Baseline Evidence

Date: 2026-08-15

Commands before production edits:

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run check:design-system`: PASS, 742 files checked.
- `npm run check:app-shell`: PASS, 742 files checked.
- `.\\node_modules\\.bin\\jest.cmd --runInBand src/design-system src/features/design-system src/features/shell`: first full baseline run had one timeout in `src/features/shell/ProtectedNavigation.test.tsx`; rerunning that file alone passed 10/10 in 1.859 s. After implementation and warm rerun, the same full focused suite passed 61 suites / 141 tests.

Known setup note: the documented `npm test -- --runInBand ...` form was swallowed by npm on this Windows/npm setup and caused Jest worker `spawn EPERM`. Direct Jest invocation was used for in-band proof.
