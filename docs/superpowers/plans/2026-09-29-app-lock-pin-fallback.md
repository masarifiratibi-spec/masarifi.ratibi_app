# App Lock PIN Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure local Masarifi App PIN fallback while preserving exactly-once Android Face/Fingerprint unlock, Clerk session boundaries, and existing app data.

**Architecture:** Restore the repository's prior owner-scoped PIN path using the existing SecureStore and `@noble/hashes` dependencies, but reject its former plaintext compatibility format. Coalesce native biometric requests at the platform-service boundary, keep PIN/biometric orchestration in the lock screen, and let the existing app-shell state persist lockout and navigation state.

**Tech Stack:** React Native, Expo Router, Expo LocalAuthentication, Expo SecureStore, Expo Crypto, Zustand, Zod, `@noble/hashes`, Jest, React Native Testing Library, ADB, EAS.

**Spec:** `docs/superpowers/specs/2026-09-29-app-lock-pin-fallback-design.md`

## Global Constraints

- Run Mobile npm commands from `apps/mobile` unless a step says otherwise.
- Staging only; Production remains untouched.
- Do not create, rotate, revoke, replace, or modify integration credentials.
- The Masarifi App PIN is exactly six decimal digits and is never persisted or logged in plaintext.
- Device screen-lock credentials are not an App PIN; Android device-credential fallback remains disabled.
- One unlock attempt may own at most one active native biometric request.
- Five wrong PIN attempts persist a 30-second lockout; no failure deletes financial data.
- Clerk authentication is evaluated before App Lock and cannot be bypassed by PIN or biometrics.
- Preserve the existing Samsung installation and app data; use only in-place APK updates.
- Every production behavior change follows red-green-refactor.
- Do not add a package: the required crypto, storage, biometric, and UI dependencies already exist.

## Review Focus

- A corrupt or former plaintext PIN credential must be rejected and routed to secure recovery, never treated as a verifier.
- A stale biometric success after `Use PIN instead`, unmount, or cancellation must not unlock or navigate.
- Restarting during a PIN lockout must preserve the remaining lockout and failed-attempt state.
- An existing biometric-only user without a PIN must retain Face unlock and have only account-verified PIN recovery when biometrics are unusable.
- A stored PIN credential with a signed-out or expired Clerk session must never expose the App Lock unlock path.

---

### Task 1: PIN credential and lock-state primitives

**Files:**
- Modify: `apps/mobile/src/domain/app-shell.ts:182`
- Modify: `apps/mobile/src/domain/app-shell.test.ts`
- Modify: `apps/mobile/src/features/security/privacy-lock.ts`
- Modify: `apps/mobile/src/features/security/privacy-lock.test.ts`

**Interfaces:**
- Produces: `pinCredentialSchema` and `PinCredential` in `domain/app-shell.ts`.
- Produces: `isValidPin(pin: string): boolean`.
- Produces: `createPinCredential(pin: string, confirmation: string, randomBytes?: (length: number) => Promise<Uint8Array>): Promise<{ credential: PinCredential } | { error: 'invalid' | 'mismatch' }>`.
- Produces: `verifyPin(pin: string, credential: PinCredential): Promise<boolean>`.
- Produces: `createPinLock(now?: number): PrivacyLockPreference` and `failUnlock(lock: PrivacyLockPreference, now: number): PrivacyLockPreference`.

- [ ] **Step 1: Write failing credential-schema and PIN primitive tests**

Add assertions that six digits are accepted; shorter, longer, and nonnumeric values are rejected; two equal PINs create a `pbkdf2-sha256:120000:<32 hex>:<64 hex>` credential; mismatches fail; correct verification succeeds; wrong verification fails; malformed and `pin:123456` values are rejected; comparison uses the stored salt and iteration count.

- [ ] **Step 2: Write failing lockout transition tests**

Assert that `createPinLock()` starts locked with PIN configured and biometrics disabled, attempts one through four remain locked, attempt five sets `temporarily_locked` and `lockedUntil = now + 30_000`, and attempts never exceed five.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
npm test -- --runInBand src/domain/app-shell.test.ts src/features/security/privacy-lock.test.ts
```

Expected: FAIL because the strict credential schema and PIN functions do not exist and the current helper creates biometric-only state.

- [ ] **Step 4: Implement the minimum credential and state primitives**

Use the already installed `getRandomBytesAsync`, `pbkdf2Async`, SHA-256, and byte utilities. Keep the KDF constants private, parse bounded iterations from the credential, and compare derived bytes without early exit.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Step 3 command. Expected: PASS with no warnings or logged PIN values.

- [ ] **Step 6: Commit the primitive layer**

```powershell
git add -- apps/mobile/src/domain/app-shell.ts apps/mobile/src/domain/app-shell.test.ts apps/mobile/src/features/security/privacy-lock.ts apps/mobile/src/features/security/privacy-lock.test.ts
git commit -m "feat(mobile): add secure App PIN primitives"
```

### Task 2: Owner-scoped PIN persistence and restart-safe state

**Files:**
- Modify: `apps/mobile/src/services/contracts/app-shell-service.ts:140`
- Modify: `apps/mobile/src/storage/app-shell-storage.ts:20`
- Modify: `apps/mobile/src/storage/app-shell-storage.test.ts`
- Modify: `apps/mobile/src/state/app-shell.ts:35`
- Modify: `apps/mobile/src/state/app-shell.test.ts`
- Modify: `apps/mobile/src/state/app-shell-live.test.ts`
- Modify: `apps/mobile/src/test-utils/app-shell-fixtures.ts`

**Interfaces:**
- Consumes: `pinCredentialSchema`, `PinCredential`, `createPinLock`, and `failUnlock` from Task 1.
- Produces in `AppShellStorage`: `loadPinCredential()`, `savePinCredential(credential)`, and the existing `clearPinCredential()`.
- Produces in app-shell state: `pinCredential`, `configurePrivacyLock(credential, now?)`, `updatePinCredential(credential)`, and `recordFailedUnlock(now)`.

- [ ] **Step 1: Write failing storage tests**

Assert that native credentials use owner-scoped SecureStore keys, web preview uses the existing AsyncStorage preview namespace, corrupt/plaintext credentials load as `null`, a valid legacy unscoped PBKDF2 credential migrates once to the owner key, and invalid legacy/owner credentials are removed rather than copied.

- [ ] **Step 2: Write failing state hydration and lockout tests**

Assert that hydration derives `pinConfigured` from a validated credential, preserves an active five-attempt lockout across restart, does not reset attempts on cold start, keeps an existing biometric-only lock with `pinConfigured: false`, resets attempts only after successful unlock, and clears both lock and credential on explicit App Lock reset.

- [ ] **Step 3: Run focused storage/state tests and verify RED**

```powershell
npm test -- --runInBand src/storage/app-shell-storage.test.ts src/state/app-shell.test.ts src/state/app-shell-live.test.ts
```

Expected: FAIL because PIN load/save and state actions are absent and current launch hydration resets PIN/attempt state.

- [ ] **Step 4: Restore the storage contract and owner-scoped implementation**

Validate every loaded credential with `pinCredentialSchema`. Preserve a valid owner credential, migrate only a valid unscoped PBKDF2 credential, delete invalid/plaintext legacy values, and never read a credential into logs or analytics.

- [ ] **Step 5: Restore and reconcile app-shell PIN state**

Load the credential alongside the privacy lock in demo and live hydration. Reconcile `pinConfigured` from credential presence. Preserve `invalidAttempts` and future `lockedUntil` on launch, normalize only an expired lockout, and keep the existing biometric-only state usable when no credential exists.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the Step 3 command. Expected: PASS.

- [ ] **Step 7: Commit persistence and state**

```powershell
git add -- apps/mobile/src/services/contracts/app-shell-service.ts apps/mobile/src/storage/app-shell-storage.ts apps/mobile/src/storage/app-shell-storage.test.ts apps/mobile/src/state/app-shell.ts apps/mobile/src/state/app-shell.test.ts apps/mobile/src/state/app-shell-live.test.ts apps/mobile/src/test-utils/app-shell-fixtures.ts
git commit -m "feat(mobile): persist owner-scoped App PIN state"
```

### Task 3: Coalesced biometric requests and recoverable error mapping

**Files:**
- Modify: `apps/mobile/src/services/contracts/app-shell-service.ts:100`
- Modify: `apps/mobile/src/services/platform/biometric-service.ts`
- Modify: `apps/mobile/src/services/platform/biometric-service.test.ts`
- Modify: `apps/mobile/src/services/mocks/biometric-service.ts`

**Interfaces:**
- Extends `BiometricService` with `cancel(): Promise<void>`.
- Keeps `authenticate(): Promise<BiometricResult>` but coalesces concurrent callers onto one module-level native request.
- Maps no hardware/no enrollment/native unavailable errors to `unavailable`, Android lockout errors to `locked_out`, and user/app/system cancellation to `cancelled`.

- [ ] **Step 1: Write failing biometric-service tests**

Assert that two service instances calling `authenticate()` concurrently invoke Expo LocalAuthentication once and share the result; `cancel()` calls Android cancellation once; device fallback stays disabled; no hardware/enrollment returns `unavailable`; lockout and cancellation codes map correctly; a completed request permits one later retry.

- [ ] **Step 2: Run the focused service tests and verify RED**

```powershell
npm test -- --runInBand src/services/platform/biometric-service.test.ts
```

Expected: FAIL because the contract has no cancellation method and current service cancels/restarts every call.

- [ ] **Step 3: Implement one shared in-flight request at the platform boundary**

Reuse the active promise across instances/remounts. Clear it only when that same request settles. Keep cancellation explicit and keep `disableDeviceFallback: true`.

- [ ] **Step 4: Run the focused service tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit biometric request control**

```powershell
git add -- apps/mobile/src/services/contracts/app-shell-service.ts apps/mobile/src/services/platform/biometric-service.ts apps/mobile/src/services/platform/biometric-service.test.ts apps/mobile/src/services/mocks/biometric-service.ts
git commit -m "fix(mobile): serialize App Lock biometrics"
```

### Task 4: Exactly-once unlock screen with PIN fallback

**Files:**
- Create: `apps/mobile/src/features/security/PinForm.tsx`
- Create: `apps/mobile/src/features/security/PinForm.test.tsx`
- Modify: `apps/mobile/src/features/security/UnlockScreen.tsx`
- Modify: `apps/mobile/src/features/security/UnlockScreen.test.tsx`
- Modify: `apps/mobile/app/security/unlock.tsx`

**Interfaces:**
- Consumes: `verifyPin`, app-shell `recordFailedUnlock`, `unlock`, and the cancellable biometric service.
- `PinForm` consumes `disabled`, `errorMessage`, `loading`, and `onSubmit(pin)` and never exposes its value outside submission.
- `UnlockScreen` consumes `pinCredential`, `pinConfigured`, `biometricEnabled`, `biometricService`, `lockedUntil`, callbacks for invalid PIN/account recovery/unlock, and an injectable clock.

- [ ] **Step 1: Write failing PIN form tests**

Assert secure numeric six-digit entry, validation before submit, clearing after submit, disabled/lockout behavior, Arabic and English labels, and no plaintext PIN rendered outside the secure field.

- [ ] **Step 2: Replace the biometric-only tests with failing two-path regressions**

Cover automatic biometric success once, no second prompt after rerender/remount, manual `Use PIN instead`, stale biometric success ignored after switching to PIN, cancel/failure/unavailable/lockout exposing PIN, explicit retry, correct PIN exactly-once unlock, wrong PIN callback, temporary lockout expiry, and signed-out/expired session precedence.

- [ ] **Step 3: Run the focused UI tests and verify RED**

```powershell
npm test -- --runInBand src/features/security/PinForm.test.tsx src/features/security/UnlockScreen.test.tsx
```

Expected: FAIL because PIN UI/fallback props and stale-callback protection do not exist.

- [ ] **Step 4: Implement the minimum two-path screen**

Start one automatic biometric call on mount when enabled. Guard it with an attempt token, mounted state, and exactly-once completion ref. `Use PIN instead` invalidates the token, cancels native authentication, and shows `PinForm`. Non-success biometric results show the recoverable message and PIN mode; retry is manual.

- [ ] **Step 5: Connect the unlock route to current app-shell state**

Pass the owner credential and persisted lockout. Route both successful methods through one awaited `unlock()` followed by one `router.replace(resolveEntryRoute(...))`. When no PIN exists, expose only the account-verified setup recovery action.

- [ ] **Step 6: Run focused UI tests and verify GREEN**

Run the Step 3 command. Expected: PASS.

- [ ] **Step 7: Commit the unlock experience**

```powershell
git add -- apps/mobile/src/features/security/PinForm.tsx apps/mobile/src/features/security/PinForm.test.tsx apps/mobile/src/features/security/UnlockScreen.tsx apps/mobile/src/features/security/UnlockScreen.test.tsx apps/mobile/app/security/unlock.tsx
git commit -m "feat(mobile): add App PIN unlock fallback"
```

### Task 5: PIN setup, change, recovery, and settings

**Files:**
- Create: `apps/mobile/src/features/security/PinSetupScreen.tsx`
- Create: `apps/mobile/src/features/security/PinSetupScreen.test.tsx`
- Create: `apps/mobile/app/security/pin/create.tsx`
- Create: `apps/mobile/app/security/pin/change.tsx`
- Create: `apps/mobile/app/security/pin/forgot.tsx`
- Modify: `apps/mobile/app/security/settings.tsx`
- Modify: `apps/mobile/src/features/security/SecurityJourney.test.tsx`
- Modify: `apps/mobile/src/localization/messages/ar.ts`
- Modify: `apps/mobile/src/localization/messages/en.ts`
- Modify: `apps/mobile/src/features/shell/AppShellLocalization.test.tsx`
- Modify: `apps/mobile/src/features/shell/AppShellAccessibility.test.tsx`

**Interfaces:**
- Consumes: `createPinCredential`, `verifyPin`, `configurePrivacyLock`, `updatePinCredential`, `recordFailedUnlock`, and existing Clerk `authService`/`GoogleAccountSelector` recovery.
- `PinSetupScreen` owns create/confirm values only in component memory and emits one validated `PinCredential` through `onSave`.

- [ ] **Step 1: Write failing setup/change/recovery tests**

Assert two matching entries create a credential, mismatch never saves, abandoning/unmounting clears the first value, correct current PIN permits change, wrong current PIN is rejected and counted, forgotten PIN reset requires authenticated Clerk result, and a cancelled/failed account reauthentication leaves the lock intact.

- [ ] **Step 2: Write failing settings and localization tests**

Assert Create PIN for biometric-only users, Change/Reset PIN after setup, biometric toggle disabled until PIN exists, biometric enablement requires a successful native check, biometric disablement retains PIN App Lock, generic biometric fallback copy, and matching Arabic/English keys with RTL/LTR accessibility labels.

- [ ] **Step 3: Run the focused journey tests and verify RED**

```powershell
npm test -- --runInBand src/features/security/PinSetupScreen.test.tsx src/features/security/SecurityJourney.test.tsx src/features/shell/AppShellLocalization.test.tsx src/features/shell/AppShellAccessibility.test.tsx
```

Expected: FAIL because the PIN routes/setup component and settings actions do not exist.

- [ ] **Step 4: Implement the in-memory setup/change screens and routes**

Use one setup component rather than a route-global pending PIN. Keep recovery tied to the configured Clerk method available in Staging (Google for the current owner). Never reset the lock until reauthentication succeeds.

- [ ] **Step 5: Update settings and localized copy**

Reuse existing Masarifi form, button, grouped-list, spacing, and typography components. Do not redesign unrelated security/privacy settings.

- [ ] **Step 6: Run focused journey tests and verify GREEN**

Run the Step 3 command. Expected: PASS.

- [ ] **Step 7: Commit enrollment and settings**

```powershell
git add -- apps/mobile/src/features/security/PinSetupScreen.tsx apps/mobile/src/features/security/PinSetupScreen.test.tsx apps/mobile/app/security/pin/create.tsx apps/mobile/app/security/pin/change.tsx apps/mobile/app/security/pin/forgot.tsx apps/mobile/app/security/settings.tsx apps/mobile/src/features/security/SecurityJourney.test.tsx apps/mobile/src/localization/messages/ar.ts apps/mobile/src/localization/messages/en.ts apps/mobile/src/features/shell/AppShellLocalization.test.tsx apps/mobile/src/features/shell/AppShellAccessibility.test.tsx
git commit -m "feat(mobile): add App PIN enrollment and recovery"
```

### Task 6: Lifecycle, Clerk, route, and privacy-mask regression gate

**Files:**
- Modify: `apps/mobile/src/features/security/AppPrivacyGate.test.tsx`
- Modify: `apps/mobile/src/features/shell/ProtectedNavigation.test.tsx`
- Modify: `apps/mobile/src/features/security/SecurityJourney.test.tsx`
- Modify only if a new test proves a defect: `apps/mobile/src/features/security/AppPrivacyGate.tsx`
- Modify only if a new test proves a defect: `apps/mobile/src/features/shell/ProtectedRouteGate.tsx`
- Preserve unless a failing test proves otherwise: `apps/mobile/src/services/live/clerk-provider.tsx`
- Modify: `apps/mobile/src/services/live/clerk-provider.test.tsx`

**Interfaces:**
- Consumes all App Lock behavior from Tasks 1-5.
- Produces no new abstraction unless a failing integration test demonstrates a missing shared boundary.

- [ ] **Step 1: Add the remaining failing cross-flow regressions**

Exercise cold start, warm rerender, biometric-overlay `inactive -> active`, real `background -> active`, configured delayed lock, route remount while authentication is pending, authenticated Clerk session preservation, signed-out/expired Clerk precedence, and absence of repeated bridge synchronization.

- [ ] **Step 2: Run the cross-flow tests and verify RED where new behavior is missing**

```powershell
npm test -- --runInBand src/features/security/AppPrivacyGate.test.tsx src/features/shell/ProtectedNavigation.test.tsx src/features/security/SecurityJourney.test.tsx src/services/live/clerk-provider.test.tsx
```

Expected: new route-remount/two-path cases fail before the minimum integration is complete; existing transient-inactive and Clerk-bridge regressions remain green.

- [ ] **Step 3: Apply only the smallest integration fixes proven necessary**

Do not add delays or remount suppression. Keep transient overlays distinct from background events and retain the current Clerk effect dependency fix.

- [ ] **Step 4: Run all security/auth tests**

```powershell
npm test -- --runInBand src/features/security src/features/shell/ProtectedNavigation.test.tsx src/services/platform/biometric-service.test.ts src/services/live/clerk-provider.test.tsx src/state/AppShellProvider.test.tsx src/state/app-shell.test.ts src/storage/app-shell-storage.test.ts
```

Expected: PASS with no act warnings, update-depth errors, or unhandled promises.

- [ ] **Step 5: Commit regression integration**

Stage only files actually changed and commit:

```powershell
git commit -m "test(mobile): lock App PIN lifecycle regressions"
```

### Task 7: Full local verification and scoped review

**Files:**
- Review every file changed since `783a57a`.
- Do not modify `docs/handoffs/`.

**Interfaces:**
- Consumes the complete implementation.
- Produces a clean, reviewable exact commit SHA.

- [ ] **Step 1: Run formatting checks without bulk-writing unrelated files**

```powershell
npx prettier --check "src/**/*.{ts,tsx}" "app/**/*.{ts,tsx}"
```

- [ ] **Step 2: Run typecheck, lint, and frontend quality boundaries**

```powershell
npm run typecheck
npm run lint
npm run check:frontend-quality
```

Expected: zero errors; report any pre-existing warnings separately without weakening rules.

- [ ] **Step 3: Run the complete Mobile suite**

```powershell
npm test -- --runInBand --forceExit
```

Expected: all suites/tests pass; do not hide a failing test or increase timeouts.

- [ ] **Step 4: Review the diff for security and test quality**

Confirm no PIN logging, plaintext persistence, analytics/backend transport, device-credential fallback, data deletion, arbitrary delays, duplicated PIN system, credential changes, or unrelated UI refactor. Run `git diff --check` and verify `docs/handoffs/` is still untracked and untouched.

- [ ] **Step 5: Commit any review-only corrections through their own red-green cycle**

Do not squash away the evidence that each production behavior followed a failing test.

### Task 8: Exact-SHA CI and immutable artifacts

**Files:**
- No product-file changes unless CI exposes a reproducible defect.

**Interfaces:**
- Produces the exact verified Git SHA and CI run URL.
- Produces one device-compatible APK belonging to that SHA.

- [ ] **Step 1: Push the existing Staging branch**

Push `codex/ratibi-staging-security` to `ratibi/codex/masarifi-staging-environment`, verify the remote head equals local `HEAD`, and keep PR #8 attached.

- [ ] **Step 2: Require the complete PR gate**

Verify secrets, sentinel redaction, Mobile, application/API, Admin, Admin E2E, database/performance, security, and image jobs all succeed at the exact head SHA.

- [ ] **Step 3: Dispatch and verify the exact-SHA publication workflow**

Dispatch `backend-foundation.yml` with `run_k6=false`, verify its `headSha`, and require success. Because this implementation is Mobile-only, do not redeploy the unchanged backend/Admin runtime; record that Staging API remains on the already verified backend SHA unless code outside Mobile changed.

- [ ] **Step 4: Build and inspect the device-compatible APK**

Use the existing JDK 17, Android SDK, Staging public configuration, and device-compatible signer. Verify package `com.masarifi.mobile`, Staging API URL, version, architecture, signer SHA-256, and APK SHA-256 before installation.

- [ ] **Step 5: Install in place and prove data preservation**

Record package `firstInstallTime` and `lastUpdateTime`, run `adb install -r`, then confirm `firstInstallTime` is unchanged and `lastUpdateTime` advanced. Never uninstall or clear data.

### Task 9: Samsung physical acceptance and final EAS APK

**Files:**
- No code changes during acceptance unless a failure is reproduced test-first and restarts the exact-SHA gate.

**Interfaces:**
- Produces physical Face/PIN evidence and the final EAS build identity/hash.

- [ ] **Step 1: Prepare a clean cold-start Face test**

Clear logcat only, force-stop and launch Masarifi, and verify one `AuthService authenticate` call, one Samsung Face prompt, zero crash markers, and zero `Maximum update depth` errors.

- [ ] **Step 2: Stop for the owner Face action**

Leave the Samsung Face prompt visible. The owner completes Face Recognition and Samsung Confirm if required. Verify Masarifi enters the authenticated app once with no second prompt and the Clerk session remains valid.

- [ ] **Step 3: Stop for owner App PIN creation**

Navigate to the exact Create App PIN screen. The owner enters and confirms the chosen PIN directly on-device. Do not request or observe the PIN in chat or logs.

- [ ] **Step 4: Verify physical fallback paths**

Exercise biometric cancel -> PIN fallback, an intentionally wrong PIN -> remains locked, correct PIN -> unlock, explicit biometric retry, background/foreground, and cold restart. Do not deliberately change device enrollment or security settings; rely on automated coverage for no-hardware/no-enrollment states.

- [ ] **Step 5: Build one final EAS Staging APK from the same SHA**

Only after physical Face and PIN acceptance pass, submit the preview/internal Android EAS build. Verify its Git commit hash equals the exact CI SHA, then record build ID, artifact URL/path, package ID, signer identity, and downloaded APK SHA-256.

- [ ] **Step 6: Final verification report**

Report root causes, files changed, biometric fix, PIN fallback/security controls, regression/full-suite results, physical Face/PIN results, final Git SHA, CI/publication URLs, unchanged Staging backend version when applicable, device-compatible APK evidence, final EAS identity/hash, and anything still unverified. Explicitly confirm Production, Gmail, OpenRouter, and credentials were untouched.
