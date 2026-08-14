# Implementation Plan: App Shell, Navigation, Authentication, and Progressive Onboarding

**Branch**: `003-app-shell-auth-onboarding` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-app-shell-auth-onboarding/spec.md`

## Summary

Replace the temporary validation-menu entry with a guarded Expo Router shell that routes users
through language selection, passwordless mock authentication, platform-aware onboarding, local
privacy unlock, and the five approved primary destinations. Reuse the existing design system,
localization, preference store, SecureStore boundary, platform capability adapter, and testing
utilities. Add one small app-shell state owner plus typed mock services for authentication,
onboarding, permissions, biometrics, and session behavior. Keep real SMS parsing, production
identity, financial feature screens, and backend authorization outside SPEC-003.

## Technical Context

**Language/Version**: TypeScript 5.3.3, React 18.2, React Native 0.74.5

**Primary Dependencies**: Expo SDK 51, Expo Router 3.5, React Native Safe Area Context,
Expo SecureStore, Expo Linking, Expo Localization, Expo Local Authentication, Zustand,
TanStack Query, React Hook Form, Zod, i18next, and the existing Masarifi design system

**Storage**: Existing protected preference storage for locale, theme, and hidden balances;
SecureStore-backed mock session and local lock credential on native devices; AsyncStorage-backed
onboarding, keyword, and tracking preferences; web uses explicitly non-secure mock persistence

**Testing**: Jest and React Native Testing Library for route resolution, auth transitions,
validation, OTP timing, permission mapping, onboarding resume, keyword rules, app lock, privacy,
RTL/LTR, and accessibility; Android development build for permission, biometric, deep-link,
background, keyboard, and app-switcher checks; iOS native checks require macOS/Xcode

**Target Platform**: Android API 23+ with target API 34; iOS versions supported by Expo SDK 51;
web as a non-production preview fallback; portrait phones down to 320 by 568 logical pixels and
adaptive tablets

**Project Type**: Shared Expo and React Native mobile application with platform-aware routes

**Performance Goals**: Show the non-sensitive startup gate within 1 second after local hydration;
resolve local route guards without visible tab-shell flashing; keep ordinary shell interactions at
60 frames per second; show user-visible feedback within 1 second after a mock result is available

**Constraints**: Frontend-only mock identity; no production secrets or provider calls; Arabic RTL
and English LTR parity; 200% text scaling; 44 by 44 minimum targets; Android SMS education before
permission request; no SMS route or claim on iOS; manual and voice fallback after every permission
outcome; no raw PIN, OTP, phone, message, account, or financial value in logs or analytics

**Scale/Scope**: One authenticated shell, five primary tabs, public and onboarding route groups,
two passwordless mock sign-in methods, one Android tracking onboarding flow, one iOS alternative
flow, eleven keyword groups, three tracking modes, local PIN/biometric states, and six optional
profile-completion steps

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design: passed.*

- **Financial trust - PASS**: SPEC-003 does not silently change financial records. The tracking
  demo adds only a safe mock clear item under the chosen mode and exposes source, edit, undo, and
  report-incorrect actions. Sensitive content is blocked until all account and local lock gates pass.
- **Platform honesty - PASS**: Android receives education before the optional SMS permission
  request and retains manual and voice fallback for every outcome. iOS has no SMS route, request,
  or claim and receives only approved alternative-capture education.
- **Language and access - PASS**: Public, onboarding, shell, permission, and lock routes are fully
  specified for Arabic RTL and English LTR, English numerals, screen readers, 200% text scaling,
  reduced motion, visible focus, keyboard avoidance, and 44 by 44 targets.
- **Design system - PASS**: Screens compose existing semantic tokens and navigation, form,
  feedback, overlay, and privacy components. Required loading, error, offline, permission,
  disabled, interruption, and recovery states are part of the route and UI contracts.
- **Architecture and proof - PASS**: One app-shell store owns local shell state; service behavior
  remains behind typed replaceable adapters; no production credential or provider call enters the
  client. Focused automated and native scenarios are defined in quickstart.md.

## Project Structure

### Documentation (this feature)

```text
specs/003-app-shell-auth-onboarding/
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   `-- app-shell-auth-onboarding-contract.md
|-- data-model.md
|-- plan.md
|-- quickstart.md
|-- research.md
`-- spec.md
```

### Source Code (`apps/mobile`)

```text
app/
|-- (public)/
|   |-- _layout.tsx
|   |-- language.tsx
|   |-- welcome.tsx
|   |-- sign-in.tsx
|   |-- sign-up.tsx
|   |-- phone.tsx
|   |-- otp.tsx
|   |-- google.tsx
|   `-- legal.tsx
|-- (onboarding)/
|   |-- _layout.tsx
|   |-- tracking-intro.tsx
|   |-- android-sms-permission.tsx
|   |-- tracking-keywords.tsx
|   |-- tracking-preferences.tsx
|   |-- tracking-demo.tsx
|   |-- ios-capture-options.tsx
|   |-- ios-automation.tsx
|   `-- complete.tsx
|-- (tabs)/
|   |-- _layout.tsx
|   |-- home.tsx
|   |-- transactions.tsx
|   |-- add.tsx
|   |-- reports.tsx
|   `-- more.tsx
|-- accounts/
|   `-- index.tsx
|-- assistant/
|   `-- index.tsx
|-- security/
|   |-- pin/
|   |   |-- create.tsx
|   |   |-- confirm.tsx
|   |   |-- change.tsx
|   |   `-- forgot.tsx
|   |-- settings.tsx
|   `-- unlock.tsx
|-- modals/
|   `-- auth-required.tsx
|-- _layout.tsx
`-- index.tsx

src/
|-- domain/
|   `-- app-shell.ts
|-- features/
|   |-- auth/
|   |-- onboarding/
|   |-- shell/
|   `-- security/
|-- services/
|   |-- contracts/
|   |   `-- app-shell-service.ts
|   |-- mocks/
|   |   |-- auth-service.ts
|   |   `-- onboarding-service.ts
|   `-- platform/
|       |-- biometric-service.ts
|       `-- tracking-permission-service.ts
|-- state/
|   `-- app-shell.ts
|-- storage/
|   `-- app-shell-storage.ts
|-- localization/
|   `-- messages/
|       |-- ar.ts
|       `-- en.ts
`-- test-utils/
```

**Structure Decision**: Keep Expo Router files thin and organize behavior under the existing
feature-based `src` layout. Extend existing design-system, localization, preference, masking,
and platform-capability boundaries instead of introducing another UI kit or navigation layer.
Use one new app-shell store for hydrated shell state and one storage boundary split internally
by sensitivity. Keep focused tests beside the domain, service, store, component, and route they prove.

## Phase 0: Research Outcome

[research.md](research.md) records the decisions for route gating, state ownership, persistence,
passwordless mocks, OTP and PIN policy, permission separation, biometrics, localization, and
testing. All technical-context choices are resolved.

## Phase 1: Design Outcome

- [data-model.md](data-model.md) defines the session, verification, onboarding, permission,
  keyword, tracking, navigation, privacy-lock, and profile-completion entities and transitions.
- [contracts/app-shell-auth-onboarding-contract.md](contracts/app-shell-auth-onboarding-contract.md)
  defines observable route, authentication, onboarding, permission, lock, privacy, and fallback behavior.
- [quickstart.md](quickstart.md) defines automated checks and Android/iOS validation scenarios.

## Post-Design Constitution Re-check

The Phase 1 artifacts preserve one owner for shell state, typed service boundaries, platform
honesty, manual fallback, privacy masking, semantic design-system use, complete bilingual access,
and focused proof. No constitution violation requires an exception.

## Complexity Tracking

No constitution violations or additional project boundaries are required.
