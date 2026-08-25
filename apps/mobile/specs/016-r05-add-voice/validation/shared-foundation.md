# R05 Shared Foundation Evidence

Date: 2026-08-16

Implemented:

- Kept deterministic voice scenarios inside the existing `__DEV__` gate and moved them into one picker sheet.
- Reused shared chips and picker sheets for proposal type, payment method, accounts, categories, and recurring choices.
- Added proposal position/selection summaries and guarded atomic voice saves against duplicate activation.
- Added permanent-denial, unavailable, and settings-return permission handling.
- Formatted the recorder timer as `MM:SS` and added a post-save path to Transactions.
- Preserved explicit transcript review, confidence confirmation, privacy cleanup, and atomic-save ownership.

Verification:

- `npm run typecheck`: passed.
- Scoped ESLint: passed.
- `npm run check:design-system`: passed.
- `npm run check:core-finance`: passed.
- `npm run check:voice-capture`: passed.
- Focused Jest: 13 suites and 23 tests passed.

Android device evidence:

- Samsung SM-A165F, Android 16, dark theme, normal text scale.
- Arabic RTL and English LTR invitation screens passed.
- Native Android permission prompt passed.
- English ready, recording, transcript, and proposal states passed.
- Safe deterministic transcript fixtures only; temporary audio was removed by the existing lifecycle owner.
- Evidence files use the `rebaseline-2026-08-16-*` prefix in this directory.

Deferred to R21:

- Full light/dark, 200% text, reduced-motion, TalkBack, and small/large-device confirmation matrix.
- Physical iOS microphone and VoiceOver evidence is externally blocked without a supported iOS/macOS environment.
