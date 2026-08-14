# UI Contract: App Shell, Authentication, and Progressive Onboarding

This contract defines behavior visible to users and boundaries consumed by later mobile features.
It does not define production identity, backend authorization, SMS parsing, or provider protocols.

## 1. Entry Gate Contract

Every startup, protected navigation, and deep link waits for local hydration and resolves in order:

1. Missing or expired account session -> public authentication.
2. Valid session requiring local unlock -> PIN or available biometrics.
3. Incomplete onboarding -> earliest incomplete applicable platform step.
4. Valid requested destination -> requested route.
5. Missing, invalid, or unavailable destination -> Home.

No protected tab shell or sensitive value appears before the resolver reaches the ready state.
Successful account re-authentication satisfies the current account gate; PIN remains a separate
local gate on later app resumes.

## 2. Public Authentication Contract

- Language selection is available before language-dependent authentication content.
- Phone and Google are passwordless methods in one identity flow.
- A newly verified identity creates the mock account; a known identity signs in.
- Authentication loading disables repeated submission without clearing recoverable input.
- Provider-shaped errors are mapped to calm correction, retry, change-method, or offline actions.
- No route, error, preview, or analytics event exposes phone values, OTP values, or identity tokens.

### Phone verification

- Country code and phone value are separately labeled and validated.
- The code has six digits, expires after five minutes, and accepts five invalid attempts.
- Resend becomes available after 30 seconds and invalidates the previous code.
- Invalid, incomplete, expired, rate-limited, offline, and failed states preserve the safe context.
- Changing the phone number invalidates the active verification attempt.

### Google identity conflict

- A conflict never links accounts automatically.
- Linking requires successful re-verification with the existing method.
- Cancellation or failure leaves account identities and session unchanged.

## 3. Session Contract

- A valid local mock session restores without repeating completed authentication or onboarding.
- Session expiry hides protected content and presents authentication before restoring a safe route.
- Sign-out clears the local session and protected route history.
- Sign-out-all displays a simulated result and never claims production cross-device enforcement.
- Authentication-required modals retain a safe return route and no sensitive parameters.

## 4. Navigation Contract

- The stable primary order is Home, Transactions, Add, Reports, and More.
- Add is the central primary action; Reports is permanent.
- Accounts opens from Home balance, Home accounts, More, transaction filters, and account selection.
- The assistant opens from Home header, contextual insights, More, reports, and budget insights.
- Accounts and assistant do not become primary tabs.
- Secondary routes, sheets, pickers, dialogs, and reviews return to their originating context.
- Directional controls mirror in Arabic RTL; utility, platform, security, and brand icons do not.

## 5. Android Onboarding Contract

- Automatic financial-message tracking is introduced before profile or financial planning setup.
- In-app education precedes the operating-system SMS permission prompt.
- Education explains requested access, purpose, analyzed data, value, denial outcome, privacy,
  disable path, uncertain-item review, and manual and voice fallback.
- Enable and Not now actions are both available; skipping never blocks Home.
- Permission UI distinguishes not requested, granted, denied, permanently denied, revoked, and
  unavailable with one valid next action for each state.
- Development-build permission requests remain behind a platform adapter; parsing belongs to SPEC-005.

## 6. iOS and Conservative Onboarding Contract

- iOS contains no SMS permission route, prompt, or direct inbox claim.
- iOS introduces manual and voice capture plus only available approved automation alternatives.
- Unknown or unsupported platform detection uses a conservative shared path with manual and voice
  demonstration and no SMS claim.
- Optional alternatives can be skipped without reducing core app access.

## 7. Keyword and Tracking Preference Contract

- Android setup exposes eleven approved financial keyword groups in Arabic and English.
- Search, language filter, add custom, delete custom, disable default, and restore defaults are supported.
- Duplicate and empty normalized values are rejected.
- Disabling the final enabled rule in a group requires an explicit consequence warning.
- Content states that keywords are one signal and do not guarantee classification.
- Modes are automatic clear, review all, and paused; automatic clear is selected initially.
- Failed, OTP, marketing, duplicate, conflicting, and low-confidence messages are never silently added.
- A mock automatic addition shows source, edit, undo, and report-incorrect actions.

## 8. Onboarding Resume and Completion Contract

- Completed and skipped optional steps persist after interruption.
- Resume opens the earliest incomplete applicable step without repeating completed education,
  consent, or permission requests.
- Completion records the platform path and selected preferences, then opens Home.
- Name, account, salary, budget, obligation, and savings setup remain optional after Home.

## 9. Local Lock and Biometrics Contract

- PIN setup and confirmation require six digits; mismatch stores nothing.
- Five consecutive invalid attempts create a 30-second lock with an announced retry time.
- Supported and enrolled biometrics may unlock the app; PIN remains the fallback.
- Unsupported, not enrolled, cancelled, failed, and operating-system lockout results have distinct UI.
- Forgotten-PIN recovery requires account re-authentication, resets the PIN, disables biometrics,
  and retains financial data.
- Auto-lock and background transitions hide sensitive content and reset foreground reveals.
- App-switcher previews remain protected regardless of the current hide-balances preference.

## 10. Progressive Profile Contract

- Home may show one dismissible progress entry containing only applicable incomplete steps.
- The entry never covers the primary financial overview or blocks a core action.
- Completion in an owning feature updates the same step without duplicate shell data.
- Dismissal persists; setup remains available through Profile or Settings.

## 11. Accessibility, Localization, and Design Contract

- Every visible string exists in Arabic and English message catalogs.
- English numerals remain readable for phone, OTP, timer, date, and financial content in RTL and LTR.
- Screens use existing semantic design tokens and SPEC-002 components.
- Controls expose accessible name, role, state, error, and action and measure at least 44 by 44.
- Critical journeys work at 200% text scaling, with screen readers, reduced motion, open keyboard,
  and 320 by 568 logical pixels.
- Loading, error, offline, permission, disabled, interrupted, and recovery outcomes do not rely on
  color, animation, haptics, or illustration alone.

## 12. Typed Service Boundary

The implementation provides replaceable contracts equivalent to:

```ts
interface AuthService {
  startPhone(input: PhoneInput): Promise<PhoneVerificationAttempt>;
  verifyPhone(input: VerificationInput): Promise<AuthResult>;
  resendPhone(sessionId: string): Promise<PhoneVerificationAttempt>;
  signInWithGoogle(): Promise<AuthResult>;
  reverifyConflict(input: ReverificationInput): Promise<AuthResult>;
  restoreSession(): Promise<AuthenticationSession>;
  signOut(scope: 'local' | 'all'): Promise<void>;
}

interface TrackingPermissionService {
  getState(): Promise<PermissionState>;
  requestAfterEducation(): Promise<PermissionState>;
  openSettings(): Promise<void>;
}

interface BiometricService {
  getAvailability(): Promise<BiometricAvailability>;
  authenticate(): Promise<BiometricResult>;
}
```

Names may adapt to existing code, but observable states and ownership cannot change without
updating this contract and specification.

## 13. Scope Guard

SPEC-003 must not add real SMS parsing, transaction classification, production authentication,
backend authorization, financial dashboards owned by SPEC-004, notification delivery, camera or
receipt capture, investments, production secrets, or unsupported iOS SMS behavior.

