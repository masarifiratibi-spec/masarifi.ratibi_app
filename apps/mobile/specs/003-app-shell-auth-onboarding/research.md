# Research: App Shell, Navigation, Authentication, and Progressive Onboarding

## Decision 1: Resolve every entry through one ordered gate

**Decision**: The root route resolves hydrated account authentication, required local unlock,
incomplete onboarding, and finally a still-valid requested destination or Home. Route groups
express navigation ownership; one pure resolver expresses gate precedence.

**Rationale**: This directly implements the clarified precedence, prevents protected-content
flashing, and makes startup and deep-link behavior independently testable.

**Alternatives considered**: Redirecting independently inside every screen duplicates guards and
creates loops; mounting tabs before hydration can expose stale or sensitive UI.

## Decision 2: Keep one owner for local app-shell state

**Decision**: Add one Zustand app-shell store for hydration status, mock session summary,
onboarding progress, safe pending destination, and local lock status. Continue using the existing
preference store for locale, theme, reduced motion, and hide-balances. Use TanStack Query only for
mock asynchronous service operations, not as a second session owner.

**Rationale**: The constitution requires one owner for server-shaped state. A single shell store
keeps route decisions synchronous after hydration and reuses the established project split.

**Alternatives considered**: A store per route creates cross-store ordering problems; duplicating
session state in Query and Zustand invites inconsistent guards.

## Decision 3: Use typed passwordless mock authentication

**Decision**: Phone and Google implement one passwordless identity contract. A new verified
identity creates a mock account and a known identity restores it. Mock fixtures deterministically
cover success, cancellation, expiry, rate limiting, offline behavior, and identity conflict.

**Rationale**: This matches the clarified product behavior while keeping the frontend replaceable
and free of provider secrets or accidental production-auth claims.

**Alternatives considered**: Separate sign-up credentials add unsupported product behavior;
direct Google or SMS-provider SDK integration violates the frontend-only phase.

## Decision 4: Make OTP behavior deterministic

**Decision**: The mock phone code is six digits, valid for five minutes, can be resent after 30
seconds, allows five invalid attempts, and is invalidated when replaced. Time is supplied through
a small clock dependency so tests do not wait in real time.

**Rationale**: Deterministic time and explicit limits make expiry, resend, and lockout behavior
fast and reliable to verify.

**Alternatives considered**: Real timers make tests slow and flaky; unconstrained attempts do not
represent the required failure states.

## Decision 5: Separate permission onboarding from SMS parsing

**Decision**: SPEC-003 owns education, request, state mapping, recovery, and fallback UI. The
Android platform adapter may request declared SMS access in a development build; all automated
tests use deterministic permission adapters. SMS reading, classification, sender rules, and
production eligibility remain in SPEC-005. iOS returns unavailable and has no SMS route.

**Rationale**: This proves the onboarding promise without coupling the shell to a parser or
claiming an unsupported iOS capability.

**Alternatives considered**: A UI-only fake cannot validate native permission recovery; adding
parsing here duplicates SPEC-005 and expands the security surface.

## Decision 6: Reuse existing platform capability states

**Decision**: Extend the existing permission-state model and `platform-capabilities` boundary
rather than creating another status vocabulary. Route content maps not-requested, granted,
denied, permanently denied, revoked, and unavailable to one valid next action each.

**Rationale**: The project already tests these states and the constitution favors one typed,
replaceable platform boundary.

**Alternatives considered**: Route-local booleans cannot distinguish denial recovery states and
would duplicate existing domain behavior.

## Decision 7: Persist by sensitivity, not by screen

**Decision**: Native mock session and local lock credential use SecureStore through one storage
boundary. Non-sensitive onboarding progress, keyword preferences, and tracking mode use
AsyncStorage. Web persistence is explicitly a preview-only mock and cannot enable biometrics or
claim secure local protection. Raw OTP, phone input drafts, and PIN form values are never logged,
placed in analytics, or retained after their flow ends.

**Rationale**: This reuses installed storage, minimizes sensitive persistence, and keeps platform
limitations honest.

**Alternatives considered**: Storing all shell state in AsyncStorage exposes sensitive values;
storing all preferences in SecureStore adds unnecessary serialized writes and size pressure.

## Decision 8: Use native biometrics behind one adapter

**Decision**: Use Expo Local Authentication behind a `BiometricService` that reports support,
enrollment, authentication result, and cancellation. PIN remains the fallback. Forgotten-PIN
recovery requires mock account re-authentication, resets the PIN, disables biometric unlock, and
retains financial data.

**Rationale**: The native library matches the existing Expo stack and keeps UI independent of
Face ID, fingerprint, and platform-specific errors.

**Alternatives considered**: Hand-written native modules are unnecessary; a visual-only switch
cannot prove availability, enrollment, cancellation, or lock behavior.

## Decision 9: Compose SPEC-002 components and existing privacy behavior

**Decision**: Build screens from the existing app bar, bottom tab, form, OTP, feedback, sheet,
dialog, skeleton, permission, and sensitive-value primitives. Extend a shared component only when
SPEC-003 needs behavior absent from its existing contract.

**Rationale**: Reuse preserves semantic tokens, themes, touch targets, RTL, reduced motion, and
masking without a feature-local style system.

**Alternatives considered**: Route-specific copies increase visual drift; a second component
library violates SPEC-002.

## Decision 10: Verify pure transitions first, native boundaries second

**Decision**: Unit-test gate resolution, auth and OTP state, keyword normalization, permission
mapping, onboarding resume, and PIN lock transitions. Component-test critical screens and route
guards with React Native Testing Library. Validate actual permissions, biometrics, deep links,
keyboard, background masking, and screen readers in development builds.

**Rationale**: Pure tests give fast deterministic coverage while native checks prove behavior
that Jest cannot faithfully represent.

**Alternatives considered**: Native-only testing is slow and incomplete on Windows; Jest-only
testing cannot prove operating-system prompts, biometrics, or app-switcher privacy.

