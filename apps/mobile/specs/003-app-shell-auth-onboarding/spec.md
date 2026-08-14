# Feature Specification: App Shell, Navigation, Authentication, and Progressive Onboarding

**Feature Branch**: Not created (no branch hook configured)

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "Create SPEC-003 - App Shell, Navigation, Authentication, and Progressive Onboarding from the Masarifi Mobile Frontend SpecKit Master."

## Clarifications

### Session 2026-08-06

- Q: Should sign-in and account creation use separate credential flows? -> A: Use one passwordless identity flow; a new verified phone or Google identity creates the mock account, while a known identity signs in.
- Q: What verification-code limits should the mock phone flow use? -> A: Use a six-digit code valid for five minutes, allow resend after 30 seconds, permit five invalid attempts per code, and invalidate the previous code on resend.
- Q: How should a Google identity conflict be resolved? -> A: Never link automatically; require successful re-verification with the existing sign-in method before mock linking, and leave the account unchanged if cancelled or failed.
- Q: Which state takes priority when startup or a deep link encounters multiple gates? -> A: Resolve account authentication first, then any required local app unlock, then incomplete onboarding, and finally the valid requested destination or Home.
- Q: What local PIN and recovery policy should the frontend represent? -> A: Use a six-digit PIN, lock for 30 seconds after five invalid attempts, and require account re-authentication to reset the PIN while retaining financial data and disabling biometrics.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enter Masarifi Securely (Priority: P1)

As a new or returning user, I can sign in or create an account with my phone number or a
Google account, recover from common authentication problems, and reach the correct next
screen without losing entered information.

**Why this priority**: Authentication is the required entry point for every protected product
journey and must establish trust before financial information is shown.

**Independent Test**: Complete phone and Google mock authentication from a signed-out state,
including cancellation, validation, expired-code, conflict, and restored-session cases, and
verify each case ends in a clear next action.

**Acceptance Scenarios**:

1. **Given** a signed-out user with a valid phone number, **When** they request and enter the
   valid mock one-time code, **Then** an authenticated session is created and the correct
   onboarding or Home destination opens.
2. **Given** an invalid or expired one-time code, **When** verification fails, **Then** the
   phone number and entered context remain available and the user can correct, resend, or
   change the number.
3. **Given** a user choosing Google sign-in, **When** the mock account selection succeeds,
   **Then** the user enters the same post-authentication decision flow as phone users.
4. **Given** Google sign-in is cancelled, fails, or conflicts with an existing account,
   **When** the result is returned, **Then** no partial session is created and the user sees a
   specific recovery or account-linking path.
5. **Given** a valid saved session, **When** the application starts, **Then** the session is
   restored without repeating authentication or completed onboarding.

---

### User Story 2 - Reach Value Through Platform-Honest Onboarding (Priority: P1)

As a newly authenticated user, I receive an onboarding journey that explains the best capture
experience available on my device, lets me skip optional setup, and still gives me access to a
usable Home screen.

**Why this priority**: Masarifi's automatic-first promise depends on presenting Android
tracking early while remaining honest and fully useful on iOS and after permission denial.

**Independent Test**: Run first launch on Android and iOS, grant and decline every optional
permission, and verify each path reaches Home with accurate platform messaging and usable
manual and voice capture entry points.

**Acceptance Scenarios**:

1. **Given** a newly authenticated Android user, **When** onboarding starts, **Then** automatic
   financial-message tracking is introduced before salary, budget, obligation, or savings setup.
2. **Given** an Android user has not yet seen permission education, **When** they choose to
   enable tracking, **Then** Masarifi explains the requested access, its value, data treatment,
   denial outcome, privacy details, and disable path before the operating-system prompt appears.
3. **Given** an Android user skips, denies, or permanently denies the permission, **When** they
   continue, **Then** onboarding remains completable and Home provides manual and voice capture
   plus an appropriate path to revisit tracking settings.
4. **Given** a newly authenticated iOS user, **When** onboarding starts, **Then** Masarifi
   explains that direct SMS inbox tracking is unavailable and presents manual, voice, and
   approved optional iOS alternatives without showing an SMS permission action.
5. **Given** any optional onboarding step, **When** the user skips it, **Then** completed steps
   remain recorded and the user is not blocked from Home.

---

### User Story 3 - Configure Automatic Tracking Preferences (Priority: P2)

As an Android user who opts into tracking, I can review keyword signals and choose how clear
or uncertain detected activity should be handled before seeing a safe demonstration.

**Why this priority**: Users need understandable control over automation before trusting it
with financial records.

**Independent Test**: Configure default and custom keywords, select each tracking mode, and
run clear, uncertain, duplicate, failed, marketing, OTP, and conflicting mock messages to
verify that no unsafe item is silently added.

**Acceptance Scenarios**:

1. **Given** default keywords are available by financial event group, **When** the user adds,
   searches, disables, deletes, filters, or restores keywords, **Then** duplicates are prevented
   and default versus custom behavior is clear.
2. **Given** disabling the final active keyword in a group would weaken matching, **When** the
   user attempts it, **Then** a warning explains the effect before the change is applied.
3. **Given** the recommended mode is selected, **When** a clear eligible mock transaction is
   detected, **Then** it may be added with visible source and correction controls while an
   uncertain item is sent for review.
4. **Given** a failed, OTP, marketing, duplicate, low-confidence, or amount-conflicting message,
   **When** it is evaluated in any automatic mode, **Then** it is not silently added as a
   financial record.
5. **Given** the user selects review-all or paused mode, **When** the preference is saved,
   **Then** the demonstration and later tracking status accurately reflect that choice.

---

### User Story 4 - Navigate the Core Application Reliably (Priority: P2)

As an authenticated user, I can move predictably among Home, Transactions, Add, Reports, and
More, reach Accounts and the assistant from their approved entry points, and return without
losing my place.

**Why this priority**: The shell is the stable frame for every later financial feature and
must keep primary destinations understandable in both reading directions.

**Independent Test**: Navigate every primary destination and approved secondary entry point in
Arabic RTL and English LTR on small and large phones, including deep links, back actions, an
open keyboard, and an interrupted session.

**Acceptance Scenarios**:

1. **Given** an authenticated user on any primary tab, **When** they select Home, Transactions,
   Add, Reports, or More, **Then** the selected destination is clear and the primary tab bar
   remains stable, with Add presented as the central primary action.
2. **Given** a user opens Accounts from Home, More, transaction filters, or transaction entry,
   **When** they finish or go back, **Then** they return to the originating context.
3. **Given** a user opens the assistant from Home, More, or a contextual insight, **When** the
   destination opens, **Then** the originating context is available without adding another
   primary tab.
4. **Given** Arabic or English is active, **When** forward, back, tab, modal, and sheet
   navigation are used, **Then** reading order and directional controls match the locale while
   non-directional icons keep their meaning.

---

### User Story 5 - Protect and Resume My Session (Priority: P2)

As a security-conscious user, I can protect access with a PIN and available biometrics, choose
an auto-lock duration, hide balances, recover from session expiry, and sign out safely.

**Why this priority**: The shell controls access to sensitive financial information and must
remain private across foreground, background, lock, and expired-session states.

**Independent Test**: Exercise PIN creation and change, failed attempts, temporary lock,
biometric enable and disable, app backgrounding, session expiry, single-device sign-out, and
sign-out-all using representative sensitive data.

**Acceptance Scenarios**:

1. **Given** a user creates a PIN, **When** confirmation does not match, **Then** no PIN is
   saved and the user receives a clear correction path.
2. **Given** five consecutive invalid PIN attempts, **When** the fifth attempt fails,
   **Then** access enters a 30-second lock state that explains when the user can retry.
3. **Given** supported biometrics are enabled, **When** biometric verification succeeds or
   fails, **Then** access is granted only on success and PIN remains an available fallback.
4. **Given** the app is backgrounded, locked, or shown in the app switcher, **When** sensitive
   content could be previewed, **Then** balances and protected content remain obscured.
5. **Given** a session expires during a protected journey, **When** the user returns, **Then**
   re-authentication is requested without exposing protected content, and safe non-sensitive
   navigation context is restored after success.
6. **Given** the user signs out or signs out all devices, **When** the mock action completes,
   **Then** local session state and protected navigation history are cleared and the public
   entry journey is shown.

---

### User Story 6 - Complete My Profile Gradually (Priority: P3)

As a user already inside Masarifi, I can optionally complete my name, first account, salary,
budget, obligation, and savings goal over time without a persistent setup prompt dominating
the product.

**Why this priority**: Progressive completion improves later financial value but must not
delay the first useful experience.

**Independent Test**: Enter Home with zero, partial, and complete profile data; dismiss and
resume setup; and verify progress reflects completed items without blocking any core action.

**Acceptance Scenarios**:

1. **Given** profile setup is incomplete, **When** Home appears, **Then** a dismissible progress
   entry lists only relevant incomplete steps and does not obscure the financial overview.
2. **Given** the user completes a suggested step elsewhere, **When** they return to Home,
   **Then** progress updates without requiring the step to be repeated.
3. **Given** the user dismisses progressive setup, **When** they return in later sessions,
   **Then** the prompt respects the dismissal and remains available through a deliberate entry
   point rather than dominating every session.

### Edge Cases

- The app starts offline with no session, a valid saved session, an expired session, or a
  partially restored session.
- A phone number is malformed, unsupported, changed after requesting a code, or rate-limited.
- A one-time code is incomplete, invalid, expired, resent repeatedly, or submitted twice.
- Google sign-in is cancelled, interrupted, fails, or returns an account already associated
  with another sign-in method.
- The app closes or is backgrounded during authentication, permission education, the operating-
  system prompt, keyword editing, tracking demonstration, or PIN setup.
- Android SMS permission is unavailable, denied, permanently denied, granted then revoked, or
  reported inconsistently after returning from device settings.
- Platform detection is temporarily unavailable or returns an unsupported platform state.
- All keywords in one group are disabled, a custom keyword duplicates a default keyword, or
  a keyword contains only whitespace or unsupported content.
- The selected tracking mode changes while a mock detection is pending.
- A deep link targets a protected, onboarding, missing, or unavailable platform-specific route.
- The user changes language or text size in the middle of authentication or onboarding.
- Arabic text expands, mixed-direction phone values appear, or the keyboard covers a primary action.
- Biometrics are unsupported, not enrolled, locked by the operating system, cancelled, or
  removed after being enabled.
- A temporary app lock and an expired account session occur at the same time.
- Progressive setup points to a feature with an unsaved draft or temporarily unavailable data.

## Requirements *(mandatory)*

### Scope Boundaries

This specification defines the public entry journey, authenticated shell, primary navigation,
mock authentication, session presentation, platform-aware onboarding, Android tracking setup
preferences, optional profile completion, and local privacy-lock experiences. Detailed account,
transaction, report, tracking-engine, notification, assistant, subscription, and production
identity behavior belongs to later specifications. Camera capture, receipt scanning, production
authentication, production SMS analysis, backend authorization, and production secrets are excluded.

### Functional Requirements

- **FR-001**: The application MUST provide public routes for splash, language selection,
  welcome, sign-in, sign-up, phone entry, one-time-code verification, Google sign-in, and legal
  information without exposing protected financial content.
- **FR-002**: First launch MUST allow the user to select Arabic or English before relying on
  language-dependent authentication or onboarding content, and the selection MUST persist.
- **FR-003**: The authenticated shell MUST provide five stable primary destinations in this
  order of meaning: Home, Transactions, Add, Reports, and More, with Add presented as the central
  primary action and Reports retained as a permanent destination.
- **FR-004**: Accounts MUST be reachable from the Home balance area, Home accounts area, More,
  transaction filters, and transaction account selection without becoming a sixth primary tab.
- **FR-005**: The assistant MUST be reachable from the Home header, contextual assistant or
  insight content, More, and applicable report or budget insights without becoming a sixth
  primary tab.
- **FR-006**: Navigation MUST preserve the originating context when users open and close
  secondary screens, pickers, filters, reviews, dialogs, and authentication-required surfaces.
- **FR-007**: Protected routes MUST redirect unauthenticated users to the appropriate public
  entry and MUST resume only a safe, valid destination after all required gates are completed.
  Startup and deep-link gates MUST resolve in this order: account authentication, required local
  app unlock, incomplete onboarding, then the still-valid requested destination or Home.
- **FR-008**: Phone authentication MUST support country-code selection, phone validation, mock
  code delivery, code verification, resend timing, phone-number correction, and success. A newly
  verified phone identity MUST create the mock account, while a known identity MUST sign in
  through the same passwordless flow.
- **FR-009**: Phone authentication MUST represent incomplete, invalid, expired, too-many-attempts,
  resend-unavailable, loading, offline, and mock-service-failure states while preserving valid
  user input after recoverable failures. The mock code MUST contain six digits, expire after five
  minutes, allow resend after 30 seconds, permit no more than five invalid submissions per code,
  and become invalid immediately when a replacement code is issued.
- **FR-010**: Google authentication MUST support a mock account selector, loading, cancellation,
  failure, existing-account conflict, account-linking suggestion, and success without creating
  a partial session after an unsuccessful outcome. A new verified Google identity MUST create
  the mock account, while a known identity MUST sign in through the same passwordless flow. An
  existing-account conflict MUST NOT link identities automatically; mock linking MUST require
  successful re-verification with the account's existing sign-in method, and cancellation or
  failure MUST leave the account, identities, and session unchanged.
- **FR-011**: Authentication actions MUST prevent duplicate submission and MUST describe the
  exact correction or retry action without displaying raw provider errors.
- **FR-012**: The shell MUST restore a valid local mock session, represent session expiry,
  require authentication for protected actions, and support sign-out and sign-out-all mock flows.
- **FR-013**: Sign-out MUST clear local authenticated state and protected navigation history;
  sign-out-all MUST additionally present the simulated all-session outcome without claiming
  production server enforcement.
- **FR-014**: After first authentication, the application MUST determine the device platform
  and route the user to the corresponding onboarding journey before Home unless onboarding was
  already completed. An incomplete onboarding journey MUST be resolved before a protected deep
  link opens its final destination.
- **FR-015**: Android onboarding MUST introduce automatic financial SMS tracking before asking
  for salary, budgets, obligations, savings goals, or other optional profile information.
- **FR-016**: Android MUST show in-app permission education before requesting operating-system
  SMS access, covering the permission, purpose, user benefit, analyzed data, denial outcome,
  privacy explanation, disable path, and available manual fallback.
- **FR-017**: SMS permission and every optional onboarding step MUST be skippable; skipping,
  denial, permanent denial, revocation, or feature unavailability MUST still lead to a usable
  Home experience with manual and voice capture.
- **FR-018**: Permission recovery MUST distinguish not-requested, granted, denied, permanently
  denied, revoked, and unavailable states and provide the next valid action for each state.
- **FR-019**: iOS onboarding MUST NOT display or imply direct SMS inbox access and MUST instead
  introduce manual capture, voice capture, and only approved optional iOS automation paths.
- **FR-020**: Platform detection failure MUST use a conservative shared onboarding path that
  makes no SMS capability claim and allows access to manual and voice capture.
- **FR-021**: Android users who opt into tracking MUST be able to view keyword groups for
  expense, income, transfer, withdrawal, deposit, refund, subscription, installment, fee,
  failed transaction, and reversal signals.
- **FR-022**: Keyword management MUST allow search, language filtering, custom-keyword addition,
  custom-keyword deletion, default-keyword disabling, default restoration, duplicate prevention,
  and a warning before all keywords in a group are disabled.
- **FR-023**: Keyword content MUST be normalized for duplicate detection, reject empty entries,
  distinguish default from custom entries, and explain that keywords are one matching signal
  rather than a guarantee of classification.
- **FR-024**: Tracking preferences MUST offer automatic addition for clear transactions,
  review of every detected transaction, and paused tracking; the recommended initial selection
  MUST automatically add clear items and send uncertain items for review.
- **FR-025**: Automatic mode MUST NOT silently add failed transactions, one-time-code messages,
  marketing messages, duplicates, unresolved amount conflicts, or insufficient-confidence items.
- **FR-026**: The tracking demonstration MUST reflect the selected preference and MUST present
  any mock automatic addition with its source plus immediate edit, undo, or report-incorrect paths.
- **FR-027**: Onboarding progress MUST persist after interruption and MUST resume at the earliest
  incomplete applicable step without repeating completed consent or permission requests.
- **FR-028**: Onboarding completion MUST record the applicable platform path and selected
  preferences, then open Home without requiring profile completion.
- **FR-029**: Home MUST offer a dismissible progressive-completion entry for name, first account,
  salary, budget, obligation, and savings goal, showing only incomplete applicable steps.
- **FR-030**: Progressive profile completion MUST remain optional, update when steps are completed
  elsewhere, respect dismissal across sessions, and remain reachable through a deliberate
  settings or profile entry.
- **FR-031**: Users MUST be able to create, confirm, change, and recover from a forgotten local
  six-digit PIN through clearly labeled mock flows, and mismatched confirmation MUST NOT save a
  PIN. Forgotten-PIN recovery MUST require successful account re-authentication, retain financial
  data, replace the local PIN, and disable biometric unlock until the user enables it again.
- **FR-032**: Repeated invalid PIN attempts MUST produce a temporary lock state with an
  understandable retry condition and no exposure of protected content. Five consecutive invalid
  attempts MUST trigger a 30-second lock before another attempt is accepted.
- **FR-033**: Where device biometrics are available and enrolled, users MUST be able to enable
  or disable biometric unlock; PIN MUST remain the fallback after cancellation or failure.
- **FR-034**: Users MUST be able to select an auto-lock duration and hide balances; protected
  content MUST be obscured whenever the application locks, enters the background, or appears in
  the app switcher.
- **FR-035**: App lock and account-session expiry MUST remain distinct states; when both apply,
  account re-authentication MUST take precedence before protected content is restored.
- **FR-036**: Authentication and onboarding forms MUST preserve entered data after validation
  errors and recoverable navigation, and MUST warn before abandoning meaningful unsaved input.
- **FR-037**: The shell and every entry journey MUST provide applicable loading, empty, error,
  offline, partial, permission-required, permission-denied, permission-permanently-denied,
  disabled, and pending states with a clear recovery or fallback action.
- **FR-038**: All user-facing authentication, navigation, onboarding, permission, privacy, and
  security content MUST be complete in Arabic RTL and English LTR with no hard-coded feature text.
- **FR-039**: Phone numbers, country codes, one-time codes, dates, timers, and financial values
  MUST use English numerals and remain correctly ordered and readable in both layout directions.
- **FR-040**: Directional navigation controls MUST mirror when their meaning depends on
  direction, while platform, security, brand, and non-directional action icons MUST retain meaning.
- **FR-041**: Every interactive control MUST have a clear accessibility name, state, and action,
  a target of at least 44 by 44 logical pixels, visible focus, and a non-color status indicator.
- **FR-042**: Authentication, onboarding, shell navigation, PIN, and permission journeys MUST
  remain completable with a screen reader, reduced motion, 200% text scaling, an open keyboard,
  and the smallest supported phone viewport without hiding required content or actions.
- **FR-043**: All screens MUST use approved semantic design values and MUST protect sensitive
  information from lock-screen text, raw errors, analytics, screenshots or previews generated
  by the app, and app-switcher presentation.
- **FR-044**: Authentication, permission, session, and onboarding analytics definitions MUST
  exclude phone numbers, one-time codes, account identifiers, message content, financial
  amounts, and other sensitive values.
- **FR-045**: All authentication, permission, platform, session, tracking, and biometric behavior
  in this frontend phase MUST use typed mock or platform-boundary contracts and MUST NOT claim
  production identity, authorization, SMS analysis, or cross-device enforcement.

### Constitution Requirements *(mandatory)*

- **Platform behavior**: Android receives education-led SMS setup with skippable permission and
  manual or voice fallback. iOS receives an honest alternative-capture journey and never an SMS
  permission claim. Unknown platform states use the conservative shared fallback.
- **Financial trust**: Onboarding creates no hidden financial changes. Mock detected activity
  follows the selected review preference, exposes its source, and provides correction. Protected
  values remain hidden while signed out, locked, backgrounded, or shown in previews.
- **Localization and accessibility**: Arabic RTL and English LTR have complete content and
  navigation parity; English numerals remain readable in mixed-direction content; journeys work
  with screen readers, reduced motion, large text, visible focus, and minimum touch targets.
- **UI states and tokens**: The shell and entry journeys consume the approved semantic design
  system and cover authentication, session, permission, platform, offline, error, disabled,
  loading, interruption, and recovery states.
- **Verification**: Focused tests cover route guards, mock authentication state transitions,
  code expiry and resend, permission mapping, platform routing, onboarding resume, keyword
  duplicate handling, tracking preference safety, PIN lock, privacy masking, and critical
  first-launch journeys; visual QA covers both platforms, languages, themes, phone sizes,
  keyboard, large text, reduced motion, screen readers, and app-switcher privacy.

### Key Entities

- **Authentication Session**: The user's local mock authenticated state, including identity
  method, lifecycle status, restoration result, expiry state, and sign-out scope.
- **Phone Verification Attempt**: A mock phone authentication attempt with country code, phone
  value, six-digit code, delivery status, verification status, five-minute expiry, 30-second
  resend availability, five-attempt limit, and replacement-code invalidation state.
- **Onboarding Progress**: The applicable platform journey, completed and skipped steps,
  permission education state, tracking preferences, completion state, and resume point.
- **Permission State**: The current user-understandable state of an optional platform permission,
  including not requested, granted, denied, permanently denied, revoked, and unavailable.
- **Keyword Rule**: A default or custom matching signal with event group, language, normalized
  value, enabled state, and restore or deletion behavior.
- **Tracking Preference**: The user's choice between automatic clear additions, review-all, and
  paused behavior, including the recommended initial selection.
- **Navigation Context**: The public, onboarding, tab, secondary, modal, or protected destination
  plus a safe return destination and locale direction.
- **Privacy Lock Preference**: The local PIN, biometric availability and enablement, auto-lock
  duration, five-attempt limit, 30-second temporary lock state, recovery result, hidden-balance
  preference, and preview-protection state.
- **Profile Completion Step**: An optional financial setup milestone with completion, dismissal,
  applicability, and destination state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of representative new users complete either phone or Google mock
  authentication on the first attempt within 2 minutes, excluding time intentionally spent
  waiting for a resend timer.
- **SC-002**: 100% of tested invalid, expired, cancelled, conflict, offline, and rate-limited
  authentication cases preserve recoverable user input and present a specific next action.
- **SC-003**: At least 90% of Android test users can explain what SMS access enables, what data
  is considered, and how to skip or disable it before they reach the operating-system prompt.
- **SC-004**: 100% of Android permission outcomes, including skip, denial, permanent denial,
  revocation, and unavailability, reach a usable Home screen with manual and voice capture.
- **SC-005**: Acceptance testing finds zero SMS permission requests or direct SMS inbox claims
  anywhere in the iOS journey.
- **SC-006**: At least 90% of users complete the applicable onboarding path or intentionally
  skip optional steps within 3 minutes after authentication.
- **SC-007**: 100% of failed, one-time-code, marketing, duplicate, conflicting, and low-confidence
  mock messages are prevented from silent automatic addition in every tracking preference mode.
- **SC-008**: At least 90% of representative users correctly navigate to each primary tab,
  Accounts, and the assistant on the first attempt without assistance.
- **SC-009**: 100% of interrupted onboarding journeys resume at the earliest incomplete
  applicable step and do not repeat completed permission prompts or consent decisions.
- **SC-010**: Every critical shell, authentication, onboarding, permission, and PIN journey is
  completable in Arabic RTL and English LTR at 200% text scaling on a 320 by 568 logical-pixel
  viewport without clipped values, hidden actions, or incorrect navigation direction.
- **SC-011**: Acceptance testing finds zero protected financial values in signed-out screens,
  temporary-lock states, app-switcher previews, user-facing raw errors, or analytics examples.
- **SC-012**: 100% of tested session-expiry, sign-out, sign-out-all, PIN failure, and biometric
  failure cases prevent access to protected content and provide the correct recovery path.
- **SC-013**: Progressive profile completion never blocks Home or another core action, and at
  least 90% of users can dismiss it or reopen it intentionally on the first attempt.
- **SC-014**: Every tested interactive control meets the minimum 44 by 44 logical-pixel target,
  and all critical journeys remain understandable with color, animation, and haptics removed.

## Assumptions

- Individual personal-finance users are the Core V1 audience, consistent with SPEC-001.
- Authentication, account selection, session restoration, sign-out-all, and identity conflicts
  are frontend simulations backed by replaceable typed contracts; backend authorization and
  production account linking remain outside this specification.
- Phone authentication uses a six-digit mock one-time code with the defined five-minute expiry,
  30-second resend delay, and five-attempt limit; no real SMS delivery is required in this phase.
- Language selection is available on first launch and can later be changed in settings without
  repeating completed onboarding.
- The recommended Android tracking preference is automatic addition for clear eligible activity
  with uncertain activity routed to review.
- iOS optional automation education may describe approved Shortcuts, App Intents, Share Extension,
  widget, or quick-action concepts only when the corresponding capability is present; manual and
  voice capture are always the baseline fallback.
- PIN, biometric, auto-lock, and app-switcher privacy are device-local frontend experiences in
  this phase and do not imply production account recovery or remote device enforcement.
- Profile completion destinations may initially use representative or mock feature screens owned
  by later specifications; absence of those details does not block entry to Home.
- Portrait phones are the primary experience; tablets adapt the mobile hierarchy and do not copy
  the Admin Dashboard layout.
