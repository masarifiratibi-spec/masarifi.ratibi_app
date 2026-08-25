# Masarifi Mobile Production Remediation Design

**Date:** 2026-08-24
**Branch:** `codex/r01-shared-ui-foundation`
**Status:** Approved

## Objective

Make the current Masarifi Mobile implementation truthful, secure, and financially correct without redesigning the approved Arabic/English UI. Preserve the visual baseline under `new_Desinge/final_visual_mockups` and prefer shared root-cause fixes over screen-specific patches.

## Baseline evidence

- TypeScript and all architecture/design boundary checks pass.
- Jest baseline: 1,413 passing and 2 stale expectation failures out of 1,415 tests.
- ESLint exits successfully with 76 CommonJS-import warnings.
- Production-quality gates remain blocked on Android native, iOS native, participant-study, and final end-to-end sign-offs.
- No Android device or emulator was connected during the audit.
- Codex Security scan `8f882967-27d4-4842-b404-d3b7780547be` validated 10 findings.

## Design

### Authorization and capability truthfulness

Protected access is deny-by-default at the root router. Public, onboarding, unlock, and recovery routes are explicit exceptions. Notification and deep-link mutations require an exactly `unlocked` state.

Mock providers remain available only to tests and explicit demo/development builds. A distributable non-demo build without a real backend reports the capability as unavailable and never issues a synthetic authenticated session or financial advice.

### Persistence lifecycle

SQLite migrations are ordered, idempotent, and tested against representative historical schemas. Schema-version rows are written only after their migration succeeds.

The current product is treated as a single-user offline installation. One authoritative reset clears all user-derived tables and covered persisted/in-memory state in dependency-safe order. Sign-out reuses that reset; multi-account retention is not introduced without a product requirement.

### Financial correctness

All production planning calculations use an injected clock and live ledger. Settlement values come from actual outstanding balances. Transaction writes validate account/currency invariants at the repository boundary. Deleted records are excluded from ordinary lists by default.

Home and Reports use the stored base currency and the same rate source. Missing rates produce explicit incomplete-result metadata rather than silently omitting accounts or transactions.

### Platform privacy

Android backup is disabled for sensitive local state. `READ_SMS` is removed until a real reviewed ingestion path exists. Voice recorder ownership is retained until stop/release/delete cleanup completes, including exception paths.

### UI, navigation, and localization

No redesign is permitted. Changes may only correct route gating, loading/error/unavailable states, hardware-back draft protection, RTL ordering, safe-area use, dead fields, and accessibility behavior while retaining approved tokens, typography, spacing, and copy intent.

## Error handling

Repository and platform failures remain typed and user-safe. Security and money mutations fail closed. Cleanup failures cannot leave in-flight flags or persisted partial state. Destructive reset reports success only after its transaction and external-store cleanup complete.

## Verification strategy

Every non-trivial change starts with the smallest regression test that demonstrates the defect. Phase checks run before proceeding; final verification covers the complete Jest suite, lint, typecheck, boundary scripts, production-quality gates, Git checks, and connected-device journeys when hardware is available.

## Explicit external dependencies

Real OTP/OAuth, assistant inference, subscription billing, support delivery, authoritative exchange rates, and real SMS ingestion require backend/native integrations absent from this repository. This remediation contains them honestly; it does not fabricate implementations. Encrypted SQLite remains a separate native dependency decision after immediate backup exclusion.
