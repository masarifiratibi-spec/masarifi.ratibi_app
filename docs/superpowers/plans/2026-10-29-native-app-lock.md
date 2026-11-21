# Native App Lock Implementation Plan

> For agentic workers: use superpowers:executing-plans inline under sole gpt-6.1-sol/xhigh ownership; user forbids delegation and routine approval pauses.

Goal: remove custom Masarifi PIN, preserve existing protected data, use optional OS-managed release authentication and suppress only identified DEV App Lock prompts.
Architecture: installed Expo55 LocalAuthentication plus existing owner storage, session gates and UI components. Versioned native preference; legacy data retained read-only. No new library or infrastructure.
Tech Stack: Expo55 / React Native / TypeScript / Zustand / SecureStore / Jest.
Spec: ../specs/2026-10-29-native-app-lock-design.md

## Global constraints

Use only D:/Masarifi-integration-2026-10-10 and current branch; no Git stage/commit/push. Preserve original financial data/draft/12applied operations, Clerk, financial authorization, OS security, hidden features and Events gate. No protected deployment/schema/worker action. Preserve preimages and accepted historical evidence. Sol implementation/self-review plus independent automated/device evidence; no independent agent review claim.

## Review focus

- Release with copied DEV/public opt-out values still requires native lock when enabled.
- Expired/logged-out/deleted/wrong-owner sessions cannot gain access via the DEV decision.
- Legacy PIN credentials, corrupted values and encryption keys remain untouched during compatibility hydration.
- Cancelled/unavailable/late native result cannot unlock another owner; persistence failure remains locked/retryable.
- Credential-only Android device can enable and use native App Lock; no custom fallback appears.

### Task 1: DEV identity and native compatibility contract

Files: client-runtime.ts/tests; domain/app-shell.ts/tests; storage/app-shell-storage.ts/tests; contracts/app-shell-service.ts.
Consumes: existing native package/runtime identity, owner hash and protected preferences. Produces: strict DEV predicate via isAppLockEnabled; native PrivacyLockPreference {enabled,autoLockDuration,appLockStatus}; owner-scoped native preference with read-only legacy fallback.
- [x] Write runtime opt-out/anti-release-bypass and compatibility/no-secret-mutation regressions; watch relevant failures.
- [x] Implement minimal runtime/schema/storage contract without touching database keys or legacy secret bytes.
- [x] Run affected tests; expected zero failures. Preserve original test preimages and adapt obsolete PIN expectations to explicit native/legacy cases.

### Task 2: Native-only lifecycle, unlock and settings

Files: state/app-shell.ts/tests/app-shell-live.test.ts; security/UnlockScreen.tsx/tests, privacy-lock.ts/tests; services/platform/biometric-service.ts/tests; shell/resolve-entry-route.ts/tests, ProtectedRouteGate.tsx/tests; app/security/settings.tsx, unlock.tsx, app/_layout.tsx; localization/ar.ts/en.ts; retire PIN-only routes/components/native KDF and obsolete tests.
Consumes: Task1 native preference/DEV predicate. Produces: native-only locked/retry/success UI and current-owner transitions with existing Clerk/logout/deletion fences preserved.
- [x] Write native fallback/credential-only/cancel/stale-result and cached-owner DEV admission regressions; watch them fail for missing behavior.
- [x] Implement existing native service with disableDeviceFallback=false, secure enrollment, optional native lock configuration and focused async guards. Remove obsolete custom PIN paths; keep shared crypto/authentication.
- [x] Run affected state/storage/security/routing and owner-lifecycle/security regressions, typecheck, changed-file lint and existing boundary gates. Expected passing assertions, no type/lint errors; report retained warnings separately.

### Task 3: Xiaomi verification, review and dependency record

Files: current evidence/strategy/task overlay and evidence workspace progress.md.
Consumes: tested source and existing phone/Metro. Produces: bound DEV/device results and explicit remaining release/human blockers.
- [x] Refresh offline queue/draft/native producer guard, preserve process/settings identity. Load corrected JS through normal Reload; verify source provenance and no PIN/native prompt on identified DEV startup and ordinary/background-return routes.
- [x] Inspect exact original draft fingerprint and12applied IDs; restore Arabic/Home/All Accounts/October/offline; close observers.
- [x] Perform security self-review and record independent automation/device evidence. Build only through existing authorized local tools if safe; actual native credential success requires human and suitable release-like artifact, never forge it.
- [x] Append the explicit product decision and T02/T04/T05/T06/T20–T22 acceptance overlay to the simplified strategy, preserve immutable original plan and old evidence. Consolidate blockers and eligible-work assessment; do not start T07 while T06 blocked.

## Execution outcome — 29 October2026

Tasks1–2 implemented; Task3 safe local/DEV work completed with explicit limits. The combined affected run passed22suites/372tests; the lazy-route follow-up passed2suites/11tests (9rechecked), giving374unique affected checks across23suites. Post-route typecheck/lint pass. Existing guard-permitted release compilation/manifest/Hermes bundle passes. Actual Xiaomi AR/EN Settings/navigation/background-return and original local data pass within the DEV slice. CDP loaded-source hash remains unverified; bounded DEV provenance is recorded separately from release source-map proof.

- [ ] Native release acceptance: use the existing approved signing path and a compatible artifact; verify a data-preserving package/signer/install plan first. Packaging stopped at the existing upload-signing guard. Do not disable it, debug-sign a release, uninstall or clear the existing DEV account.
- [ ] Actual native fingerprint/device-credential success, cancellation and return on Xiaomi require the suitable artifact and private human interaction. Fresh sign-in/actual logout remain NOT_RUN on the preserved phone; automated Clerk/session/logout fences pass.
- [ ] Full T06 remains blocked by KEEP_GATE and original conditional coverage. T07+ remains NOT_STARTED; no dependency waiver or protected action is implied.
