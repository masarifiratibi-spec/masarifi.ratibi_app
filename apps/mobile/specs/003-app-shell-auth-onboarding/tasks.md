# Tasks: App Shell, Navigation, Authentication, and Progressive Onboarding

**Input**: Design documents from `specs/003-app-shell-auth-onboarding/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/app-shell-auth-onboarding-contract.md`, and `quickstart.md`

**Tests**: Required by the specification, plan, and constitution. Each behavior group starts
with the smallest failing test, then implements only enough behavior to pass it.

**Organization**: Tasks are ordered and grouped by user story. Every task names one concrete
change, its exact file path, and a command or observable result that independently verifies it.

## Phase 1: Setup

**Purpose**: Add the single native dependency and automated boundary needed by SPEC-003.

- [X] T001 Install the Expo SDK 51-compatible `expo-local-authentication` package and update `package.json` and `package-lock.json`; verify `npx expo install --check` reports dependencies are up to date.
- [X] T002 Configure `expo-local-authentication`, the iOS Face ID usage description, and Android `READ_SMS` permission in `app.json`; verify `npx expo config --type public` includes the plugin, Face ID text, and Android permission without adding any iOS SMS permission.
- [X] T003 Add `scripts/check-app-shell-boundaries.mjs` plus `check:app-shell` in `package.json` to reject provider SDK imports, production secrets, sensitive logging, feature-local raw colors, and SMS routes outside Android platform files; verify the script reports its scanned file count and exits 0 on the current baseline.
- [X] T004 Record fresh baseline results for `npx jest --runInBand`, `npm run typecheck`, `npm run lint`, `npm run check:foundation`, `npm run check:design-system`, and `npm run check:app-shell` in `specs/003-app-shell-auth-onboarding/quickstart.md`; verify each command has an explicit PASS or existing-failure note.

---

## Phase 2: Foundational App-Shell Infrastructure

**Purpose**: Establish shared typed state, persistence, entry gating, localization, analytics,
and provider composition required by every story.

**Critical**: Finish this phase before starting any user-story phase.

- [X] T005 Add failing tests for `AuthenticationSession`, `NavigationContext`, `OnboardingProgress`, permission, keyword, tracking, privacy-lock, and profile-step validation in `src/domain/app-shell.test.ts`; verify `npx jest --runInBand src/domain/app-shell.test.ts` fails because the domain module is missing.
- [X] T006 Implement the SPEC-003 enums, schemas, entities, constants, and transition guards in `src/domain/app-shell.ts`; verify `npx jest --runInBand src/domain/app-shell.test.ts` passes all foundational domain cases.
- [X] T007 Define typed `AuthService`, `OnboardingService`, `TrackingPermissionService`, `BiometricService`, and `AppShellStorage` contracts in `src/services/contracts/app-shell-service.ts`; verify `npm run typecheck` accepts mock-shaped compile fixtures without importing provider SDKs.
- [X] T008 Add failing native/web persistence tests for session, onboarding, keyword, tracking, pending destination, and lock records in `src/storage/app-shell-storage.test.ts`; verify the targeted Jest run fails before the storage boundary exists.
- [X] T009 Implement sensitivity-split persistence in `src/storage/app-shell-storage.ts` using SecureStore for native session/lock records and AsyncStorage for non-sensitive onboarding/tracking records, with explicit preview-only web fallback; verify `src/storage/app-shell-storage.test.ts` passes corrupt, missing, save, load, and clear cases.
- [X] T010 Add failing hydration, session, onboarding, pending-route, and lock action tests in `src/state/app-shell.test.ts`; verify the targeted Jest run fails before the store exists.
- [X] T011 Implement one `useAppShellStore` owner in `src/state/app-shell.ts` with atomic hydrate, authenticate, expire, sign-out, onboarding, route, lock, and reset actions; verify `src/state/app-shell.test.ts` passes without duplicating locale/theme state from `src/state/preferences.ts`.
- [X] T012 Add failing entry-gate precedence tests for hydration, authentication, local unlock, onboarding, valid deep link, invalid deep link, and Home fallback in `src/features/shell/resolve-entry-route.test.ts`; verify the targeted Jest run fails before the resolver exists.
- [X] T013 Implement the pure ordered gate resolver in `src/features/shell/resolve-entry-route.ts`; verify `src/features/shell/resolve-entry-route.test.ts` passes and contains no router side effects.
- [X] T014 Add failing error-mapping tests for offline, cancellation, expiry, rate limit, permission, biometric, persistence, and unknown mock errors in `src/features/shell/app-shell-errors.test.ts`; verify the targeted Jest run fails before mappings exist.
- [X] T015 Implement stable localized error codes and recovery actions in `src/features/shell/app-shell-errors.ts`; verify `src/features/shell/app-shell-errors.test.ts` passes and no raw error message is returned to UI callers.
- [X] T016 Add deterministic signed-out, authenticated, expired, Android, iOS, conservative-platform, permission, keyword, tracking, and lock fixtures in `src/test-utils/app-shell-fixtures.ts`; verify `npm run typecheck` and confirm the file contains no real phone, OTP, account, or financial value.
- [X] T017 [P] Add the full Arabic `appShell` message namespace for public, auth, OTP, onboarding, permissions, tracking, navigation, security, progressive setup, state, and recovery labels in `src/localization/messages/ar.ts`; verify no new value is empty or copied from English.
- [X] T018 [P] Add the exact matching English `appShell` message namespace in `src/localization/messages/en.ts`; verify every new key has a non-empty English value.
- [X] T019 Add localization parity and forbidden-hard-coded-label tests in `src/localization/app-shell-messages.test.ts`; verify `npx jest --runInBand src/localization/app-shell-messages.test.ts` passes with identical Arabic and English key sets.
- [X] T020 Add failing event-name and sensitive-payload rejection tests for auth, onboarding, permission, navigation, and security events in `src/analytics/app-shell-events.test.ts`; verify the targeted Jest run fails before the event boundary exists.
- [X] T021 Implement typed event names and a no-op frontend recorder that rejects phone, OTP, PIN, message, account, identifier, and amount payload keys in `src/analytics/app-shell-events.ts`; verify `src/analytics/app-shell-events.test.ts` passes.
- [X] T022 Add failing provider tests for one hydration call, app-state forwarding, locale preservation, and non-sensitive startup fallback in `src/state/AppShellProvider.test.tsx`; verify the targeted Jest run fails before the provider exists.
- [X] T023 Implement `AppShellProvider` in `src/state/AppShellProvider.tsx` to hydrate once, observe app foreground/background state, and expose shell readiness without rendering protected children early; verify `src/state/AppShellProvider.test.tsx` passes.
- [X] T024 Add `AppShellProvider` inside the existing design-system/foundation providers in `app/_layout.tsx`; verify the existing provider tests plus `src/state/AppShellProvider.test.tsx` pass without creating a second QueryClient or theme provider.
- [X] T025 Replace the temporary `app/index.tsx` menu with a non-sensitive hydration screen that redirects only through `resolveEntryRoute`; verify `src/features/shell/resolve-entry-route.test.ts` passes and the old validation routes remain directly reachable for QA.
- [X] T026 Run `npx jest --runInBand src/domain/app-shell.test.ts src/storage/app-shell-storage.test.ts src/state/app-shell.test.ts src/features/shell src/localization/app-shell-messages.test.ts src/analytics/app-shell-events.test.ts`; verify every foundational suite passes before starting US1.

**Checkpoint**: The app can hydrate and resolve a safe destination using one typed state owner.

---

## Phase 3: User Story 1 - Enter Masarifi Securely (Priority: P1) - MVP

**Goal**: Complete phone and Google passwordless mock authentication, session restoration,
identity-conflict recovery, and the public route group.

**Independent Test**: From signed out, complete phone and Google success paths and exercise
invalid, expired, resend, rate-limit, cancellation, offline, conflict, restored, and expired-session
fixtures; every case must end in an authenticated session or one specific recovery action.

### Tests for User Story 1

- [X] T027 [P] [US1] Add failing mock-auth contract tests for new/known phone identity, new/known Google identity, cancellation, offline failure, restore, expiry, sign-out, and sign-out-all in `src/services/mocks/auth-service.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T028 [P] [US1] Add failing phone/country-code validation tests for empty, malformed, supported, and mixed-direction values in `src/features/auth/phone-validation.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T029 [P] [US1] Add failing OTP state-machine tests for six digits, five-minute expiry, 30-second resend, five invalid attempts, replacement invalidation, and injected clock behavior in `src/features/auth/phone-verification.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T030 [P] [US1] Add failing identity-conflict transition tests for detection, re-verification, link success, cancellation, and failure in `src/features/auth/identity-conflict.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T031 [P] [US1] Add failing accessible form tests for phone preservation, field correction, submit loading, and keyboard reachability in `src/features/auth/PhoneAuthForm.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T032 [P] [US1] Add failing OTP form tests for six slots, English numerals, resend announcement, error focus, paste, and duplicate-submit prevention in `src/features/auth/OtpVerificationForm.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T033 [P] [US1] Add failing Google selector tests for loading, cancellation, failure, conflict, re-verification prompt, and success in `src/features/auth/GoogleAccountSelector.test.tsx`; verify the targeted Jest run fails before implementation.

### Implementation for User Story 1

- [X] T034 [US1] Implement deterministic passwordless phone/Google/session fixtures behind `AuthService` in `src/services/mocks/auth-service.ts`; verify `src/services/mocks/auth-service.test.ts` passes all contract cases.
- [X] T035 [US1] Implement country-code and phone validation with Zod in `src/features/auth/phone-validation.ts`; verify `src/features/auth/phone-validation.test.ts` passes and returns localized error codes rather than prose.
- [X] T036 [US1] Implement the injected-clock OTP state machine in `src/features/auth/phone-verification.ts`; verify `src/features/auth/phone-verification.test.ts` passes without real timer waits.
- [X] T037 [US1] Implement identity-conflict transitions that never mutate before successful existing-method re-verification in `src/features/auth/identity-conflict.ts`; verify `src/features/auth/identity-conflict.test.ts` passes.
- [X] T038 [US1] Implement the labeled country/phone form with preserved values and pending-action guard in `src/features/auth/PhoneAuthForm.tsx`; verify `src/features/auth/PhoneAuthForm.test.tsx` passes at 200% text scaling fixtures.
- [X] T039 [US1] Implement the six-digit OTP form, resend countdown, correction path, and error announcement in `src/features/auth/OtpVerificationForm.tsx`; verify `src/features/auth/OtpVerificationForm.test.tsx` passes.
- [X] T040 [US1] Implement the mock Google account selector and conflict/re-verification surface in `src/features/auth/GoogleAccountSelector.tsx`; verify `src/features/auth/GoogleAccountSelector.test.tsx` passes without provider SDK imports.
- [X] T041 [US1] Add public-route integration tests for language, welcome, sign-in, sign-up, phone, OTP, Google, legal, and safe post-auth redirect behavior in `src/features/auth/AuthRoutes.test.tsx`; verify the targeted Jest run fails before route implementation.
- [X] T042 [US1] Implement language selection and persistence in `app/(public)/language.tsx`; verify the language cases in `src/features/auth/AuthRoutes.test.tsx` pass in RTL and LTR.
- [X] T043 [US1] Implement the localized product welcome and explicit sign-in/create-account actions in `app/(public)/welcome.tsx`; verify its route test passes with no generic unlabeled Continue action.
- [X] T044 [P] [US1] Implement the passwordless method chooser for returning users in `app/(public)/sign-in.tsx`; verify its route test reaches phone and Google routes.
- [X] T045 [P] [US1] Implement the passwordless method chooser for new users in `app/(public)/sign-up.tsx`; verify its route test reaches the same phone and Google contracts without password fields.
- [X] T046 [US1] Integrate `PhoneAuthForm` with mock code creation in `app/(public)/phone.tsx`; verify valid input creates one attempt and invalid input preserves the form.
- [X] T047 [US1] Integrate `OtpVerificationForm`, resend replacement, and authenticated store transition in `app/(public)/otp.tsx`; verify valid, invalid, expired, and rate-limited route tests pass.
- [X] T048 [US1] Integrate Google selection, cancellation, conflict re-verification, and session transition in `app/(public)/google.tsx`; verify all Google route tests pass and cancelled flow creates no session.
- [X] T049 [P] [US1] Implement bilingual legal/privacy links and a safe back path in `app/(public)/legal.tsx`; verify its route test exposes no placeholder legal acceptance or sensitive value.
- [X] T050 [US1] Add the public stack layout and signed-in redirect guard in `app/(public)/_layout.tsx`; verify authenticated users cannot remain on a public credential route.
- [X] T051 [US1] Integrate session restore, expiry, local sign-out, and simulated sign-out-all with `useAppShellStore` in `src/features/auth/session-controller.ts`; verify the auth service and store tests pass together.
- [X] T052 [US1] Add the complete phone, Google, restored-session, expired-session, and identity-conflict journey test in `src/features/auth/AuthenticationJourney.test.tsx`; verify the test passes from a reset fixture without relying on US2-US6 screens.
- [X] T053 [US1] Run `npx jest --runInBand src/services/mocks/auth-service.test.ts src/features/auth src/state/app-shell.test.ts`; verify every US1 suite passes before marking the MVP story complete.

**Checkpoint**: Phone and Google mock authentication are independently usable and testable.

---

## Phase 4: User Story 2 - Reach Value Through Platform-Honest Onboarding (Priority: P1)

**Goal**: Route authenticated Android, iOS, and unknown-platform users through honest,
skippable onboarding that always reaches Home with manual and voice fallback.

**Independent Test**: Complete Android grant/deny/permanent-deny/skip paths, iOS alternative
capture, and unknown-platform fallback; confirm every path reaches Home and iOS never exposes SMS.

### Tests for User Story 2

- [X] T054 [P] [US2] Add failing platform-path tests for Android, iOS, unknown, unavailable, and changed-on-resume results in `src/features/onboarding/platform-path.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T055 [P] [US2] Add failing onboarding-step tests for Android order, iOS order, conservative order, optional skip, completed-step preservation, and earliest-incomplete resume in `src/features/onboarding/onboarding-progress.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T056 [P] [US2] Add failing permission contract tests for not-requested, granted, denied, permanently-denied, revoked, unavailable, open-settings, and education-before-request behavior in `src/services/platform/tracking-permission-service.test.ts`; verify the targeted Jest run fails before adapters exist.
- [X] T057 [P] [US2] Add failing permission education accessibility/content tests in `src/features/onboarding/PermissionEducation.test.tsx`; verify the test requires purpose, data use, benefit, denial result, privacy, disable, uncertain review, and manual/voice fallback content.
- [X] T058 [P] [US2] Add failing Android/iOS/conservative route-content tests that forbid SMS routes and labels on iOS in `src/features/onboarding/PlatformOnboardingRoutes.test.tsx`; verify the targeted Jest run fails before routes exist.
- [X] T059 [P] [US2] Add failing interruption/resume tests for app close, background, permission prompt return, skipped steps, and no repeated education in `src/features/onboarding/OnboardingResume.test.tsx`; verify the targeted Jest run fails before integration.

### Implementation for User Story 2

- [X] T060 [US2] Implement deterministic platform-path selection with conservative fallback in `src/features/onboarding/platform-path.ts`; verify `src/features/onboarding/platform-path.test.ts` passes.
- [X] T061 [US2] Implement ordered applicable-step and resume calculations in `src/features/onboarding/onboarding-progress.ts`; verify `src/features/onboarding/onboarding-progress.test.ts` passes without router imports.
- [X] T062 [P] [US2] Implement the deterministic permission adapter for automated tests and non-native previews in `src/services/mocks/tracking-permission-service.ts`; verify mock cases in `src/services/platform/tracking-permission-service.test.ts` pass.
- [X] T063 [P] [US2] Implement Android `PermissionsAndroid` status/request/settings mapping in `src/services/platform/tracking-permission-service.android.ts`; verify contract tests cover each mapped result and the file contains no SMS-reading API.
- [X] T064 [P] [US2] Implement the iOS/web unavailable adapter in `src/services/platform/tracking-permission-service.ts`; verify iOS/web tests return no request action and no SMS capability.
- [X] T065 [US2] Implement onboarding persistence operations behind `OnboardingService` in `src/services/mocks/onboarding-service.ts`; verify completed, skipped, reset, and resume cases in `src/features/onboarding/onboarding-progress.test.ts` pass through the service.
- [X] T066 [US2] Implement a safe-area, keyboard-aware, localized onboarding scaffold with progress and skip slots in `src/features/onboarding/OnboardingScaffold.tsx`; verify a new `src/features/onboarding/OnboardingScaffold.test.tsx` passes at 320x568 and 200% text.
- [X] T067 [US2] Implement the complete permission explanation and explicit Enable tracking/Not now actions in `src/features/onboarding/PermissionEducation.tsx`; verify `PermissionEducation.test.tsx` passes without requesting permission during render.
- [X] T068 [US2] Implement the authenticated onboarding stack guard and persisted resume redirect in `app/(onboarding)/_layout.tsx`; verify `OnboardingResume.test.tsx` opens the earliest incomplete applicable route.
- [X] T069 [US2] Implement Android automatic-tracking value introduction in `app/(onboarding)/tracking-intro.tsx`; verify route tests show this before any profile-completion prompt.
- [X] T070 [US2] Implement education-then-request behavior and every recovery action in `app/(onboarding)/android-sms-permission.tsx`; verify no adapter request occurs until the user activates the education CTA.
- [X] T071 [P] [US2] Implement iOS manual, voice, and available approved capture choices in `app/(onboarding)/ios-capture-options.tsx`; verify the iOS route test contains zero SMS permission labels or actions.
- [X] T072 [P] [US2] Implement optional iOS automation education with capability-based omission in `app/(onboarding)/ios-automation.tsx`; verify unavailable options are not rendered and skipping remains available.
- [X] T073 [US2] Implement a conservative manual/voice demonstration for unknown platform state in `src/features/onboarding/ConservativeCaptureDemo.tsx`; verify its component test contains no SMS claim and exposes both fallback actions.
- [X] T074 [US2] Implement the default safe capture demonstration with source and correction controls in `app/(onboarding)/tracking-demo.tsx`; verify no financial mock is added for failed, OTP, marketing, duplicate, conflicting, or low-confidence fixtures.
- [X] T075 [US2] Implement onboarding completion persistence and Home redirect in `app/(onboarding)/complete.tsx`; verify profile completion is not required and completed onboarding is not repeated.
- [X] T076 [US2] Add route selection from successful authentication into Android, iOS, or conservative onboarding in `src/features/auth/session-controller.ts`; verify the existing US1 tests still pass plus platform route tests pass.
- [X] T077 [US2] Add the complete Android, iOS, unknown-platform, skip, denial, permanent-denial, revoke, offline, and resume journey test in `src/features/onboarding/OnboardingJourney.test.tsx`; verify all paths end at a usable Home fixture with manual and voice capture.
- [X] T078 [US2] Run `npx jest --runInBand src/features/onboarding src/services/platform/tracking-permission-service.test.ts src/services/mocks/tracking-permission-service.ts`; verify every US2 suite passes and the iOS SMS-forbidden assertions remain green.

**Checkpoint**: Platform-honest onboarding is independently demonstrable after authentication.

---

## Phase 5: User Story 3 - Configure Automatic Tracking Preferences (Priority: P2)

**Goal**: Let Android users manage approved keyword groups and select safe automatic,
review-all, or paused behavior before the demonstration.

**Independent Test**: Add/search/filter/disable/delete/restore keywords and exercise every
tracking mode against clear, uncertain, failed, OTP, marketing, duplicate, conflict, and
low-confidence fixtures; no unsafe fixture may be silently added.

### Tests for User Story 3

- [X] T079 [P] [US3] Add failing keyword normalization, empty, duplicate, origin, deletion, disable, restore, and last-enabled warning tests in `src/features/onboarding/keyword-rules.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T080 [P] [US3] Add failing fixture tests for all eleven groups and Arabic/English coverage in `src/services/mocks/default-keywords.test.ts`; verify the test identifies missing group or language fixtures.
- [X] T081 [P] [US3] Add failing keyword editor tests for search, language filter, add, delete, disable, restore, duplicate error, warning confirmation, and screen-reader labels in `src/features/onboarding/KeywordEditor.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T082 [P] [US3] Add failing tracking-mode selector tests for recommended default, review-all, paused, descriptions, and selected-state accessibility in `src/features/onboarding/TrackingModeSelector.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T083 [P] [US3] Add failing detection-policy tests for the full message fixture matrix under all three modes in `src/features/onboarding/tracking-policy.test.ts`; verify the targeted Jest run fails before implementation.

### Implementation for User Story 3

- [X] T084 [US3] Implement keyword normalization and immutable add/delete/disable/restore operations in `src/features/onboarding/keyword-rules.ts`; verify `src/features/onboarding/keyword-rules.test.ts` passes.
- [X] T085 [P] [US3] Add complete Arabic and English default keyword fixtures for the eleven approved groups in `src/services/mocks/default-keywords.ts`; verify `src/services/mocks/default-keywords.test.ts` passes with at least one enabled default per group and language.
- [X] T086 [US3] Extend `src/storage/app-shell-storage.ts` with validated keyword-rule load/save/reset operations; verify the keyword persistence cases in `src/storage/app-shell-storage.test.ts` pass and corrupt data falls back to defaults.
- [X] T087 [US3] Implement keyword search, language filter, custom editing, default toggling, restore, and final-rule confirmation in `src/features/onboarding/KeywordEditor.tsx`; verify `src/features/onboarding/KeywordEditor.test.tsx` passes.
- [X] T088 [US3] Implement the three tracking modes with recommended-default explanation in `src/features/onboarding/TrackingModeSelector.tsx`; verify `src/features/onboarding/TrackingModeSelector.test.tsx` passes.
- [X] T089 [US3] Implement the pure mode-and-classification decision table in `src/features/onboarding/tracking-policy.ts`; verify `src/features/onboarding/tracking-policy.test.ts` passes every matrix row.
- [X] T090 [US3] Implement the keyword configuration route and persist only validated changes in `app/(onboarding)/tracking-keywords.tsx`; verify route tests preserve changes after interruption and show no parser-confidence tuning controls.
- [X] T091 [US3] Implement tracking preference selection and persistence in `app/(onboarding)/tracking-preferences.tsx`; verify automatic-clear is initially selected and all three choices resume correctly.
- [X] T092 [US3] Integrate the selected tracking policy into `app/(onboarding)/tracking-demo.tsx`; verify clear automatic mode exposes source/edit/undo/report actions and unsafe fixtures never add.
- [X] T093 [US3] Add a focused Android keyword-and-mode journey test in `src/features/onboarding/TrackingConfigurationJourney.test.tsx`; verify it passes independently with the mock permission already granted.
- [X] T094 [US3] Run `npx jest --runInBand src/features/onboarding/keyword-rules.test.ts src/services/mocks/default-keywords.test.ts src/features/onboarding/KeywordEditor.test.tsx src/features/onboarding/TrackingModeSelector.test.tsx src/features/onboarding/tracking-policy.test.ts src/features/onboarding/TrackingConfigurationJourney.test.tsx`; verify every US3 suite passes.

**Checkpoint**: Tracking preferences are independently configurable and safe under the fixture matrix.

---

## Phase 6: User Story 4 - Navigate the Core Application Reliably (Priority: P2)

**Goal**: Deliver the five-tab authenticated shell, approved Accounts and assistant entry points,
safe context return, RTL/LTR direction, modal behavior, and protected deep-link resolution.

**Independent Test**: Navigate all primary tabs and secondary entry points in Arabic and English,
then repeat through protected deep links and back actions; every destination and return context
must remain correct without exposing a sixth tab.

### Tests for User Story 4

- [X] T095 [P] [US4] Add failing tab-shell tests for exact Home/Transactions/Add/Reports/More order, central Add action, permanent Reports tab, selected state, and 44x44 targets in `src/features/shell/AppTabs.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T096 [P] [US4] Add failing navigation-context tests for Accounts and assistant entry/return from every approved source in `src/features/shell/navigation-context.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T097 [P] [US4] Add failing RTL/LTR tests for tab order, back direction, modal close, and non-directional icon stability in `src/features/shell/ShellDirection.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T098 [P] [US4] Add failing protected-deep-link tests for signed-out, locked, onboarding-incomplete, valid, invalid, and unavailable target states in `src/features/shell/ProtectedNavigation.test.tsx`; verify the targeted Jest run fails before route integration.

### Implementation for User Story 4

- [X] T099 [US4] Implement typed approved routes and safe return-context helpers in `src/features/shell/navigation-context.ts`; verify `src/features/shell/navigation-context.test.ts` passes and rejects credential or sensitive query parameters.
- [X] T100 [US4] Implement the localized custom tab presentation from the existing design-system tab primitive in `src/features/shell/AppTabs.tsx`; verify `src/features/shell/AppTabs.test.tsx` passes without raw colors or feature-local icons.
- [X] T101 [US4] Configure protected Expo Router tabs and central Add behavior in `app/(tabs)/_layout.tsx`; verify tab-shell and protected-navigation tests pass.
- [X] T102 [P] [US4] Implement the Home shell placeholder with Accounts, assistant, manual capture, voice capture, and progressive-setup slots in `app/(tabs)/home.tsx`; verify no SPEC-004 financial totals are fabricated.
- [X] T103 [P] [US4] Implement localized non-fabricated destination placeholders in `app/(tabs)/transactions.tsx`, `app/(tabs)/add.tsx`, and `app/(tabs)/reports.tsx`; verify each route has one clear purpose and no production financial behavior.
- [X] T104 [P] [US4] Implement the More destination with Accounts, assistant, Profile, Security, and sign-out entry points in `app/(tabs)/more.tsx`; verify every control has a unique accessible label and destination.
- [X] T105 [P] [US4] Implement the representative Accounts destination and safe return action in `app/accounts/index.tsx`; verify entry from Home, More, filter context, and account selection preserves the origin.
- [X] T106 [P] [US4] Implement the representative assistant destination and safe return action in `app/assistant/index.tsx`; verify entry from Home, More, report, and budget context preserves the origin without changing financial data.
- [X] T107 [US4] Implement the authentication-required modal with safe destination retention in `app/modals/auth-required.tsx`; verify cancellation exposes no protected content and successful auth resumes only a valid target.
- [X] T108 [US4] Integrate Expo Linking input with the pure gate resolver in `src/features/shell/deep-link-controller.ts`; verify `src/features/shell/ProtectedNavigation.test.tsx` passes malformed, unavailable, and protected links without loops.
- [X] T109 [US4] Apply locale-derived direction and directional-icon rules across `AppTabs`, Accounts, assistant, and modal routes; verify `src/features/shell/ShellDirection.test.tsx` passes in Arabic and English.
- [X] T110 [US4] Add an end-to-end shell journey test covering every primary and secondary destination in `src/features/shell/NavigationJourney.test.tsx`; verify it passes from an authenticated, unlocked, onboarding-complete fixture.
- [X] T111 [US4] Run `npx jest --runInBand src/features/shell app`; verify all US4 and existing route suites pass without snapshot-only assertions.

**Checkpoint**: The authenticated shell is stable and independently navigable in RTL and LTR.

---

## Phase 7: User Story 5 - Protect and Resume My Session (Priority: P2)

**Goal**: Add six-digit PIN setup/recovery, temporary lock, native biometric adapter, auto-lock,
session-expiry precedence, sign-out behavior, hidden balances, and app-switcher privacy.

**Independent Test**: Exercise PIN creation, mismatch, five failures, timed unlock, biometric
availability/results, forgot-PIN re-authentication, session expiry, background lock, sign-out,
and app-switcher preview protection without losing financial data.

### Tests for User Story 5

- [X] T112 [P] [US5] Add failing PIN validation and transition tests for six digits, mismatch, five attempts, 30-second lock, retry, reset, and injected clock in `src/features/security/privacy-lock.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T113 [P] [US5] Add failing biometric contract tests for supported, unsupported, not-enrolled, enabled, cancelled, failed, and OS-locked states in `src/services/platform/biometric-service.test.ts`; verify the targeted Jest run fails before adapters exist.
- [X] T114 [P] [US5] Add failing secure lock-persistence tests for save/load/replace/clear, corrupt value, sign-out, and forgotten-PIN behavior in `src/storage/app-shell-storage.test.ts`; verify the new cases fail before implementation.
- [X] T115 [P] [US5] Add failing PIN form tests for labels, English numerals, secure entry, mismatch focus, loading, accessibility, and keyboard reachability in `src/features/security/PinForm.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T116 [P] [US5] Add failing unlock-screen tests for PIN fallback, biometric results, countdown announcement, session-expiry precedence, and protected-content blocking in `src/features/security/UnlockScreen.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T117 [P] [US5] Add failing app-state privacy tests for timeout, immediate lock, background masking, foreground reveal reset, and app-switcher cover in `src/features/security/AppPrivacyGate.test.tsx`; verify the targeted Jest run fails before implementation.

### Implementation for User Story 5

- [X] T118 [US5] Implement pure PIN validation, attempt counting, 30-second lock, reset, and injected-clock transitions in `src/features/security/privacy-lock.ts`; verify `src/features/security/privacy-lock.test.ts` passes without real waits.
- [X] T119 [P] [US5] Implement deterministic biometric fixtures behind `BiometricService` in `src/services/mocks/biometric-service.ts`; verify mock cases in `src/services/platform/biometric-service.test.ts` pass.
- [X] T120 [P] [US5] Implement Expo Local Authentication availability, enrollment, authentication, cancellation, failure, and lockout mapping in `src/services/platform/biometric-service.ts`; verify contract tests pass and UI files do not import Expo Local Authentication directly.
- [X] T121 [US5] Extend `src/storage/app-shell-storage.ts` with native secure lock credential operations and explicit preview-only web behavior; verify all lock persistence tests pass and raw PIN values never enter AsyncStorage.
- [X] T122 [US5] Extend `useAppShellStore` lock actions for configure, fail, temporary lock, unlock, reset, biometrics, background, and session-expiry precedence in `src/state/app-shell.ts`; verify `src/state/app-shell.test.ts` passes the new transitions.
- [X] T123 [US5] Implement reusable six-digit create/confirm/change/reset form modes in `src/features/security/PinForm.tsx`; verify `src/features/security/PinForm.test.tsx` passes.
- [X] T124 [US5] Implement PIN and biometric unlock behavior with countdown and account-auth precedence in `src/features/security/UnlockScreen.tsx`; verify `src/features/security/UnlockScreen.test.tsx` passes.
- [X] T125 [US5] Implement background/foreground, auto-lock, sensitive-reveal reset, and non-sensitive preview cover in `src/features/security/AppPrivacyGate.tsx`; verify `src/features/security/AppPrivacyGate.test.tsx` passes.
- [X] T126 [US5] Wrap protected route content with `AppPrivacyGate` inside `app/_layout.tsx`; verify signed-out, expired, backgrounded, and locked fixtures never mount protected tabs.
- [X] T127 [US5] Implement local unlock routing and biometric fallback in `app/security/unlock.tsx`; verify the unlock-screen route test reaches the original safe destination only after success.
- [X] T128 [P] [US5] Implement PIN creation entry in `app/security/pin/create.tsx`; verify invalid or mismatched setup stores no credential and routes to confirmation only after six digits.
- [X] T129 [P] [US5] Implement PIN confirmation and successful save in `app/security/pin/confirm.tsx`; verify a match enables the configured lock and clears transient PIN input.
- [X] T130 [P] [US5] Implement existing-PIN verification and replacement in `app/security/pin/change.tsx`; verify failure leaves the original credential active.
- [X] T131 [P] [US5] Implement forgot-PIN account re-authentication, PIN reset, biometric disablement, and data retention in `app/security/pin/forgot.tsx`; verify the route test preserves onboarding/profile data and removes only lock credentials.
- [X] T132 [US5] Implement auto-lock duration, biometric enable/disable, hide-balances, change-PIN, and forgot-PIN controls in `app/security/settings.tsx`; verify unavailable biometrics are disabled with an explanatory label.
- [X] T133 [US5] Integrate session expiry, local sign-out, and simulated sign-out-all into `app/(tabs)/more.tsx`; verify all actions clear protected history and sign-out-all is labeled as a simulation in the mock phase.
- [X] T134 [US5] Add a complete PIN, biometrics, background, expiry, reset, and sign-out journey test in `src/features/security/SecurityJourney.test.tsx`; verify financial fixture data survives PIN reset but not protected rendering while locked.
- [X] T135 [US5] Run `npx jest --runInBand src/features/security src/services/platform/biometric-service.test.ts src/storage/app-shell-storage.test.ts src/state/app-shell.test.ts`; verify every US5 suite passes.

**Checkpoint**: Local privacy and session recovery are independently testable without production-auth claims.

---

## Phase 8: User Story 6 - Complete My Profile Gradually (Priority: P3)

**Goal**: Show optional, dismissible profile-completion progress that reads owning-feature state,
updates after completion, and remains deliberately reopenable without blocking Home.

**Independent Test**: Render zero, partial, complete, unavailable, dismissed, and reopened states;
the card must show only applicable incomplete steps and never block a Home action.

### Tests for User Story 6

- [X] T136 [P] [US6] Add failing derivation tests for six profile steps, owning-feature completion, unavailable destinations, ordering, and zero-complete state in `src/features/onboarding/profile-completion.test.ts`; verify the targeted Jest run fails before implementation.
- [X] T137 [P] [US6] Add failing progress-card tests for incomplete-only rows, dismissal, reopen action, large text, RTL/LTR, and non-blocking layout in `src/features/onboarding/ProfileCompletionCard.test.tsx`; verify the targeted Jest run fails before implementation.
- [X] T138 [P] [US6] Add failing dismissal persistence tests across restart and sign-in restore in `src/storage/app-shell-storage.test.ts`; verify the new cases fail before implementation.

### Implementation for User Story 6

- [X] T139 [US6] Implement profile-step derivation from owning-feature summaries without duplicating their data in `src/features/onboarding/profile-completion.ts`; verify `src/features/onboarding/profile-completion.test.ts` passes.
- [X] T140 [US6] Extend `src/storage/app-shell-storage.ts` and `src/state/app-shell.ts` with profile-card dismiss/reopen preference only; verify persistence and store tests pass without storing account, salary, budget, obligation, or savings values.
- [X] T141 [US6] Implement the localized optional progress card and step destinations in `src/features/onboarding/ProfileCompletionCard.tsx`; verify `src/features/onboarding/ProfileCompletionCard.test.tsx` passes.
- [X] T142 [US6] Integrate `ProfileCompletionCard` below the primary Home shell content in `app/(tabs)/home.tsx`; verify Home remains usable when every step is incomplete and when text is scaled to 200%.
- [X] T143 [US6] Add a deliberate reopen action under Profile/Settings in `app/(tabs)/more.tsx`; verify dismissed progress stays hidden across restart until this action is used.
- [X] T144 [US6] Add a complete dismiss, restart, reopen, complete-elsewhere, and all-complete journey test in `src/features/onboarding/ProfileCompletionJourney.test.tsx`; verify the test passes independently from real SPEC-004/SPEC-007 data.
- [X] T145 [US6] Run `npx jest --runInBand src/features/onboarding/profile-completion.test.ts src/features/onboarding/ProfileCompletionCard.test.tsx src/features/onboarding/ProfileCompletionJourney.test.tsx src/storage/app-shell-storage.test.ts`; verify every US6 suite passes.

**Checkpoint**: Progressive profile completion is optional, persistent, and independently verifiable.

---

## Phase 9: Polish and Cross-Cutting Verification

**Purpose**: Prove the integrated SPEC-003 contract across automation, privacy, localization,
native platforms, and existing SPEC-001/SPEC-002 boundaries.

- [X] T146 [P] Add cross-story accessibility tests for screen-reader order, names, roles, errors, live announcements, 44x44 targets, and 200% text scaling in `src/features/shell/AppShellAccessibility.test.tsx`; verify the targeted Jest run passes for public, onboarding, tab, and lock fixtures.
- [X] T147 [P] Add cross-story RTL/LTR and mixed-direction tests for phone, OTP, timer, tabs, back controls, and safe route labels in `src/features/shell/AppShellLocalization.test.tsx`; verify the targeted Jest run passes in Arabic and English.
- [X] T148 [P] Add cross-story loading, offline, error, permission, disabled, interruption, and recovery-state tests in `src/features/shell/AppShellStates.test.tsx`; verify every state exposes one valid next action without raw errors.
- [X] T149 Add regression tests proving foundation validation routes and the design-system gallery remain directly reachable after the production root redirect in `src/features/shell/ValidationRoutesRegression.test.tsx`; verify the targeted Jest run passes.
- [X] T150 Run `npx jest --runInBand`; verify all Jest suites pass with zero failed tests and record suite/test counts in `specs/003-app-shell-auth-onboarding/quickstart.md`.
- [X] T151 Run `npm run typecheck`; verify TypeScript exits 0 and record the result in `specs/003-app-shell-auth-onboarding/quickstart.md`.
- [X] T152 Run `npm run lint`; verify ESLint exits 0 and record the result in `specs/003-app-shell-auth-onboarding/quickstart.md`.
- [X] T153 Run `npm run check:foundation`, `npm run check:design-system`, and `npm run check:app-shell`; verify all three boundary checks exit 0 and record scanned-file counts in `specs/003-app-shell-auth-onboarding/quickstart.md`.
- [X] T154 Run `npx expo install --check` and `npx expo config --type public`; verify dependencies are compatible and native permission/plugin output matches T002, then record both results in `specs/003-app-shell-auth-onboarding/quickstart.md`.
- [X] T155 Run the three privacy/scope `rg` commands from `specs/003-app-shell-auth-onboarding/quickstart.md`; verify no excluded feature, provider secret, sensitive log payload, parser implementation, or iOS SMS route is found, then record the exact results.
- [ ] T156 Validate the full Android phone/Google auth, onboarding grant/deny/permanent-deny/revoke/skip, deep-link, keyword, tracking-mode, PIN, biometric, background, and app-switcher matrix in an Expo development build; verify each matrix row has device/API and pass/fail evidence in `specs/003-app-shell-auth-onboarding/quickstart.md`.
- [ ] T157 Validate Android at 320x568 logical pixels, 200% font scale, Arabic RTL, English LTR, light/dark themes, keyboard open, TalkBack, and reduced motion; verify clipping, focus, announcement, target-size, and navigation-direction results are recorded in `specs/003-app-shell-auth-onboarding/quickstart.md`.
- [ ] T158 Validate the iOS authentication, no-SMS onboarding, approved alternatives, deep links, PIN, Face ID, VoiceOver, background, and app-switcher matrix on macOS/Xcode hardware; verify `specs/003-app-shell-auth-onboarding/quickstart.md` records device/OS and pass/fail evidence or an explicit Windows-host blocker.
- [X] T159 Re-read `specs/003-app-shell-auth-onboarding/spec.md` and map FR-001 through FR-045 plus SC-001 through SC-014 to completed task IDs in a final traceability section of `specs/003-app-shell-auth-onboarding/quickstart.md`; verify every requirement and criterion has implementation and verification evidence or a named blocker.
- [X] T160 Review all SPEC-003 production code against `specs/003-app-shell-auth-onboarding/contracts/app-shell-auth-onboarding-contract.md` and remove unsupported behavior; verify no contract section is unimplemented without a corresponding blocker in `specs/003-app-shell-auth-onboarding/quickstart.md`.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 Setup**: Starts immediately.
- **Phase 2 Foundation**: Depends on T001-T004 and blocks all user stories.
- **US1 (T027-T053)**: Starts after T026; this is the authentication MVP.
- **US2 (T054-T078)**: Starts after T026 and integrates with US1 only at T076-T077.
- **US3 (T079-T094)**: Starts after US2 provides the onboarding routes and default demo.
- **US4 (T095-T111)**: Starts after T026; protected-route integration uses US1/US2 fixtures.
- **US5 (T112-T135)**: Starts after T026; route integration depends on the US1 session and US4 shell.
- **US6 (T136-T145)**: Starts after the US4 Home and More destinations exist.
- **Phase 9 Polish**: Starts after every story selected for release is complete.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 Authentication (MVP)
                    -> US2 Platform Onboarding -> US3 Tracking Configuration
                    -> US4 Navigation Shell -> US5 Session Protection
                                           -> US6 Progressive Profile
All selected stories -> Polish and Native QA
```

### Within Each Story

1. Add the named failing tests and run the targeted command.
2. Implement pure domain behavior before services or UI.
3. Implement mock/platform adapters before route integration.
4. Implement components before route files that consume them.
5. Run the story journey test and targeted story command before its checkpoint.

## Parallel Opportunities

- T017 and T018 can run in parallel after the message namespace is agreed.
- US1 test tasks T027-T033 touch separate files and can run in parallel.
- US2 test tasks T054-T059 and adapter tasks T062-T064 touch separate files and can run in parallel within their dependency groups.
- US3 test tasks T079-T083 can run in parallel; T085 can run beside T084.
- US4 test tasks T095-T098 and placeholder routes T102-T106 can run in parallel after shared route types exist.
- US5 test tasks T112-T117, adapter tasks T119-T120, and route tasks T128-T131 can run in parallel within their dependency groups.
- US6 test tasks T136-T138 can run in parallel.
- Cross-story test tasks T146-T148 can run in parallel after all selected stories are integrated.

## Parallel Example: User Story 2

```text
Task T054: platform-path tests
Task T055: onboarding-progress tests
Task T056: permission-service contract tests
Task T057: permission-education component tests
Task T058: platform-route tests
Task T059: interruption/resume tests
```

After those tests exist and fail for their intended missing behavior:

```text
Task T062: mock permission adapter
Task T063: Android native permission adapter
Task T064: iOS/web unavailable adapter
```

## Implementation Strategy

### MVP First

1. Complete T001-T026.
2. Complete T027-T053 for US1.
3. Stop and run the US1 independent test plus the full regression suite.
4. Demo passwordless phone/Google authentication and safe session restoration.

### Recommended Product Increment

1. Add US2 so authenticated users can reach Home through honest platform onboarding.
2. Add US4 so Home and primary destinations use the production shell.
3. Add US3 tracking configuration, then US5 privacy protection, then US6 progressive completion.
4. Complete T146-T160 before claiming the full SPEC-003 checkpoint.

## Notes

- `[P]` means different files and no dependency on another incomplete task in the same group.
- `[US1]` through `[US6]` map exactly to the six stories in `spec.md`.
- Do not mark a test task complete unless its initial run failed for the intended missing behavior.
- Do not mark an implementation task complete until its named targeted verification passes.
- Keep SMS parsing, production auth, financial dashboards, camera/receipt features, investments,
  provider secrets, and iOS SMS behavior outside this task list.
