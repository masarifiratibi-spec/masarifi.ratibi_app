# Onboarding, sign-in and simple loading implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. Latest user corrections below supersede the earlier uncommitted acknowledgement proposal.

**Goal:** First-use onboarding with the selected transaction-example cards leads to the existing Google sign-in page, visually refined under the user's approved preview; startup loading shows only a circle and its existing message.

**Architecture:** Reuse `FirstLaunchOnboardingScreen`, existing preference completion and `firstLaunchDestination`. Refine `GoogleAuthScreen` without changing authentication handlers. Delete decorative branding from the shared provider-independent `StartupLoading`; keep readiness, accessibility and reduced-motion lifecycles.

**Tech Stack:** Existing Expo/React Native, Zustand and design tokens; no new dependencies.

**Spec:** User selected the original card onboarding and lighter Start button, then explicitly removed all legal controls from onboarding and retained the existing Google sign-in flow. Approved `login-current-refined-ar.png`, then removed its language selector. Latest addition: remove startup logo/name, keep spinner/message; remove only the separate name under the login logo and balance spacing. Preview artifacts are private under `.superpowers/sdd/2026-11-01-onboarding-preview/`.

## Global constraints

- Same branch/account/data/2026-13/APK and existing Metro12652; no reset, installation, provider/financial trial or sign-out to force first-use screens.
- First-use is determined by the existing installation preference, not by guessing Google identity before authentication. Returning authenticated owners keep Home; after logout they keep direct sign-in.
- Onboarding has no Terms, Privacy or checkbox controls. Start stays single-flight, retries local persistence failures and opens the existing `/(public)/auth-pending` route.
- Keep Google account selection/session/owner provisioning/logout unchanged. Existing sign-in document links remain; no new legal-consent, privacy/source/AI permission or server policy is activated.
- Light-theme Start uses isolated `colorTokens.onboarding.start = #2D7264`; other primary actions and dark theme remain unchanged.

## Review focus

- No examples write financial records; local first-launch completion is the only Start write.
- No duplicate navigation while local persistence is pending; failure is retryable.
- No language selector or separate visible brand-name text on login; logo remains accessible.
- Loading has no image/name, one progress description and the same motion/readiness lifecycle.
- Both locales, reduced motion and smaller scrollable layouts remain supported.

### Task 1: Onboarding and existing sign-in

Files: `apps/mobile/app/(public)/welcome.tsx`, `src/features/onboarding/FirstLaunchOnboardingScreen.tsx`, `src/features/auth/GoogleAuthScreen.tsx`, their tests, localization and isolated color token.

- [x] Meaningful RED tests for route separation, no legal controls, no sign-in language selector and approved copy.
- [x] Reuse existing Welcome/component/navigation and refine only sign-in presentation.
- [x] Pass focused tests, review and isolated source screenshot inspection; do not infer native visual acceptance from the source preview.

### Task 2: Simple loading and final delivery

Files: `src/design-system/components/feedback/StartupLoading.tsx`, its test and `src/features/shell/AppEntryStartup.test.tsx`.

- [x] RED tests for absent startup branding and absent separate login name.
- [x] Delete startup logo/name, keep circle/message and update progress label; preserve motion/readiness.
- [x] Finish expanded startup/auth/onboarding/shell regression:65 suites /363 tests; TSC/lint0, boundaries1254 files and diff checks passed.
- [x] Independent review: no blockers. Private phone snapshots before/after are exact for16 projections,13 transactions and2026-13; APK/Metro unchanged.
- [x] Record final validation; commit and push on the existing branch follow. Assess new CI separately. Existing Voice fixture source-pin failure is unrelated to this UI diff and is not bypassed.
