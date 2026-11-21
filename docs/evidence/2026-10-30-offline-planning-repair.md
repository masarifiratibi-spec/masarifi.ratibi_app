# Offline planning repair — 30 October 2026

Salary and Obligations previously requested the live planning API even when the
native connectivity probe reported an offline device. With no cached projection,
both destinations displayed “Planning unavailable.”

The live provider now reads validated planning projections from the current
owner's encrypted database while explicitly offline, including across day and
language changes. Owner/session changes and authoritative denials still withdraw
access. A failed connectivity probe uses the existing authenticated API path.
Canonical local profile/obligation records provide a conservative fallback;
missing financial amounts remain unavailable. Offline salary amounts retain
their saved timestamp and do not manufacture a current daily allowance.

The connection notice again uses the original styled, dismissible popup. It
leaves no permanent bottom strip after dismissal. Existing foreground/recovery
and receipt safeguards remain, and reconnect can refresh successful offline
planning reads without resuming paused mutations.

## Verification

- Ten affected Jest suites passed: 123 cases. Follow-up validation added one
  impossible-date case; targeted date/layout checks passed. There are 124 distinct
  passing cases across these producers, not 124 newly written tests.
- Full mobile TypeScript check, exact changed-file ESLint, planning boundaries,
  and product whitespace checks passed. The shared-summary fixture now explicitly
  supplies the native secure-store null response expected by its auth boundary.
- Physical Android: Arabic and English Salary/Obligations open offline; English
  also passes after a visible DEV reload. Reports content scrolls in both
  languages without the old network strip. The popup dismisses correctly, with
  its English actions readable at 200% text size.
- No populated salary or obligation records were injected into the device. Tests
  cover populated saved reads, owner changes, corrupt models, denials, and actual
  SQLite persistence. The physical evidence covers the device's real local state.
- Original draft and financial projections matched the preserved baseline before
  these journeys. No financial save, report generation, private export, capture,
  APK installation, signing, or database migration was performed for this repair.
  Detailed device evidence stays private.

The existing Metro process exhausted its V8 heap and exited with code 134. Its
original receipt/logs were preserved. The same staging-development launch was
recovered on loopback port 8081 with one worker and a 1024 MiB heap; the APK,
Clerk public configuration, app lock and API destination were retained.

This repair is a bounded supplement to T07a/T13. It does not accept all tasks
through T19a or replace their hosted, private-authentication and role checks.
The unchanged S1 packet remains a separate execution boundary. Automatic
checkpoint CI exposed existing Backend Foundation fixture/configuration failures
and a Voice schema-source pin failure; mobile CI passed. These failures remain
recorded, and full CI/native qualification under T20–T22 is outside this run.
