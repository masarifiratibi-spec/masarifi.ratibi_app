# R05 Manual Form Evidence

Date: 2026-08-16

Implemented:

- Compact Manual/Voice and transaction-type chips.
- Amount-first form with the existing account/category pickers.
- Type and account route prefill, including More shortcuts.
- Source-account exclusion from transfer destinations.
- Existing draft, validation, duplicate-save, recovery, and result behavior preserved.

Verification:

- Focused R05 Jest gate: 13 suites and 23 tests passed.
- Typecheck, scoped ESLint, design-system, core-finance, and voice-capture boundaries passed.
- Android dark-theme Arabic RTL and English LTR captures passed:
  - `rebaseline-2026-08-16-add-manual-ar-dark.png`
  - `rebaseline-2026-08-16-add-manual-en-dark.png`

Deferred to R21:

- The complete light-theme, 200% text, reduced-motion, and small/large-device matrix.
- Physical iOS VoiceOver evidence remains externally blocked without iOS/macOS hardware.
