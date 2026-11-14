# Tracking setup guide implementation plan

**Goal:** Implement the approved B guide in the existing tracking page.
**Architecture:** Isolated tracking help component using AppSheet; a small platform helper opens this app's notification settings; existing SMS/listener services and foreground refresh remain authoritative.
**Tech Stack:** React Native, Expo, TypeScript, Jest, existing design system.
**Spec:** `docs/superpowers/specs/2026-11-14-tracking-setup-guide-design.md`

## Global Constraints

Work only in this integration checkout; preserve unrelated changes. No deployment or permission grants. Keep source toggles and keyword behavior. No changes to other notification service consumers. No app data in tests/artifacts.

## Review Focus

Distinguish notification display from listener access; use runtime package ID; handle settings failures and unsupported platforms; Arabic row mirroring, long text, sheet scrolling, safe area, reduced motion, owner unmount; no automatic permission/source mutations.

## Task 1: System notification settings

**Interfaces:** Export `openTrackingAlertSettings(): Promise<boolean>`, true when settings opened; false on web; failures reject after fallback.

- [x] Add tests for Android package targeting, app-info fallback, iOS settings, web and failure propagation. Run targeted Jest; Expected: failures because helper is missing.
- [x] Implement helper using installed Expo intent launcher and runtime application ID; preserve existing notification service semantics.
- [x] Run targeted tests; Expected: all pass. Commit owned helper and tests.

## Task 2: Approved guide and integration

**Interfaces:** Consume Task 1 and existing SMS/listener settings methods; add typed Arabic/English catalog entries.

- [x] Add guide behavior tests for collapse, three distinct settings actions, no action merely on reading steps, errors, dismiss/reset, unsupported platforms, RTL/theme. Update tracking integration assertions for replacement explanation. Run tests; Expected: feature absent failures.
- [x] Implement isolated help component, step sheets and compact privacy line; integrate after sources and before keywords. Use existing AppSheet and support reduced motion without changing default behavior for other consumers.
- [x] Run guide/service/screen tests, full mobile Jest, typecheck, scoped lint and design boundary checks. Expected: pass; record any baseline failures explicitly.
- [x] Review only owned diff, fix meaningful findings, commit owned files, and report implementation separately from device deployment.

## Execution record

Pre-flight: Task 2 consumes Task 1's explicit boolean result and rejecting failure path; interfaces agree. Existing AppState refresh already rechecks capture permissions; displaying settings alone requires no new source writes.

Final validation: `node node_modules/jest/bin/jest.js --maxWorkers=4` from `apps/mobile`: **629 suites / 5,213 tests passed**, exit 0. Targeted guide/service/screen: 66 passed; updated journey/accessibility: 7 passed. `tsc --noEmit`, scoped ESLint (0 warnings/errors), Prettier for new files, `check-design-system-boundaries.mjs` (1,336 files), `check-frontend-quality-boundaries.mjs`, and `git diff --check` passed.

One independent review completed. The guide now uses the parent's known source availability, with a clear unsupported-version explanation; notification display settings retain a lazy native-module fallback. English instructions use the actual SMS switch label. No outstanding review findings. The initial full run exposed two stale assertions for the intentionally replaced explanation card; updated tests and the final full run passed. Jest still prints Expo Go/React act warnings and reported a worker teardown warning; the final command exited successfully with no failed tests.

Delivery: source and tests only, on the existing branch. No push, backend change, APK build/install, or Android permission changes. OEM settings presentation, device screen-reader/large-font rendering, and installed APK behavior have not been revalidated for this UI change.
