# Native DEV account deletion — 16 October 2026

Continuation of the earlier reliability acceptance, on the same worktree and `codex/voice-promoted-operating-2026-10-13` branch. This report covers the new request to activate and exercise deletion inside a native DEV application.

## Isolation and implementation

The existing DEV installation shares the protected owner's identity. A separately installed **Masarifi Dev Privacy** variant therefore runs the same mobile feature code with its own Android package, storage, deep-link scheme, Metro port and existing Clerk Development instance. The ordinary installation and original DEV session were not replaced or cleared.

The canonical Staging `/dev-privacy` prefix reaches a separate API configured with Development keys. Build and runtime checks require the exact variant, HTTPS prefix, test publishable key and live-service mode; noncanonical reserved-path variants are rejected. No credentials are committed. The local launcher exposes start/config only, protecting the existing native project from an accidental prebuild. Google authentication returns to the separate variant's scheme; ordinary and original DEV callbacks retain their prior values.

The API reuses the already-qualified backend image. Its deletion consumer is restricted to the one newly created, marked disposable Development identity. It does not run global privacy/security/export/retention jobs. The ordinary API, assistant and Voice services were not replaced. Original container configuration/image/start/restart pins are preserved; the previous isolated deletion pair remains stopped.

## Actual native acceptance

Authentication setup used the real native Clerk SDK and a reserved fictional Development phone/OTP. No token or freshness claims were injected. Phone-login UI and live Google account login are not claimed as tested.

The account-deletion feature itself was exercised through visible Android controls and native confirmation dialogs:

| Step | Actual result |
| --- | --- |
| Confirm deletion | POST 202; the screen distinguishes scheduled deletion from completion and displays the governed deadline |
| Confirm cancellation | DELETE 204; the screen confirms cancellation and the server request remains cancelled |
| Confirm a new deletion | POST 202 with a new server identifier and a new deadline |
| Leave and reopen security settings | GET 200 restores the same request and deadline without a second submission |
| Reload the separate native bundle and reopen settings | GET 200 restores the same persisted request and deadline |

Observed HTTP durations were 536 ms, 1,105 ms, 326 ms and 333 ms respectively. These measure the HTTP portion only, excluding native interaction and Clerk token acquisition. They are functional samples, not a latency benchmark.

The final request's real cooling-off deadline is **2026-10-16 16:32:28.196068 UTC / 19:32:28 Riyadh**. No timestamps or cooling-off policy were changed. At 15:35 UTC, the disposable profile and its native provider session remained active; the protected owner remained active with the same 22 confirmed undeleted transactions. The disposable native account has one automatically created zero-balance financial account and no transactions; it has no registered device record, so registered-device cleanup is covered by the earlier isolated qualification rather than this native sample.

Actual completion occurred at **16:32:37.892850 UTC**, after the unmodified deadline. The database recorded the completed request and a profile tombstone with identifying fields cleared. Clerk subsequently returned 404 for both the disposable user and its native session, with zero active sessions. The protected owner remained active with the same 22 undeleted transactions.

The native completion UI did **not** pass: after external deletion, the old client still showed its authenticated error state, and Refresh failed during Clerk token acquisition before making another status request. This is a confirmed limitation of this historical one-hour flow. The subsequent immediate-deletion implementation introduces a separate completion capability to recover after intentional session revocation; it requires its own qualification and is not covered by the results in this report.

Under this historical policy, financial/planning records outside the registered deletion handlers remained retained, as explicitly disclosed on the screen. The disposable's zero-balance account remained. This is not evidence of complete financial erasure or of the newly requested immediate policy.

Additional button tests by the user reached the existing deletion rate limit. Their rejected GET/POST returned 429 and did not alter the scheduled request or deadline, confirmed by a read-only database observation. This exposed a recovery issue: failed restoration offered a new-delete button before the saved request's status was known. The panel now requires successful restoration before offering a new request, keeps the saved identifiers, and offers an explicit read-only refresh retry. Rate limiting has its own Arabic/English message rather than a misleading connection error. The existing rate policy was not increased or reset.

The corrected source was loaded into the separate native variant. An actual status GET returned 429; the Android screen showed the new Arabic rate-limit explanation and Refresh deletion status, with no new-delete button. Both the native screenshot and the guarded UI observation confirm the behavior. The original DEV Metro and authenticated session were preserved.

## Source verification

- Native variant and journal service boundary: `2e7a7da1`; final frozen mobile run passed 490 suites / 3,274 tests, zero failed or pending.
- Separate authentication callback: `cc48039f58352b33cbad863dc2b03653a0c3c10d`; regression first failed because it returned the ordinary scheme, then all 22 provider-boundary tests passed. TypeScript, scoped ESLint and app-shell/assistant boundaries passed. The final combined full mobile run passed **490 suites / 3,275 tests**, zero failed or pending, in 255.926 seconds.
- Saved-request recovery: `8b84d846`; both 429/503 restoration regressions first failed, then all 14 panel tests passed. TypeScript, scoped ESLint and frontend/app-shell/assistant boundaries passed. The final combined full mobile run passed **490 suites / 3,277 tests**, zero failed or pending, in 261.019 seconds.
- Backend image remains revision `c430442b`, previously qualified by 249 suites / 1,874 tests; this continuation makes no backend source or schema changes.

Private evidence is stored outside Git under `D:/Masarifi-preservation-2026-10-16/reliability/`, principally `privacy-mobile/`, `dev-privacy-native-runtime/` and `clerk-development-private/native-dev/`. These retain guarded dispatch receipts, native screenshots, HTTP observations and provider/DB proofs. Never publish the credential files or replay consumed deployment, identity-creation, sign-in or deletion dispatches.
