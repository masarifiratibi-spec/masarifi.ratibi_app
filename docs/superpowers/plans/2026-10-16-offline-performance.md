# Offline startup and finance read latency

Preserve DEV identity ownership, financial truth, durable drafts and receipt semantics. Reuse StateView and existing design tokens. Root owns runtime/device/deployment verification.

1. Add failing regressions for connection-vs-auth startup failures, recovery, and genuine HTTP server errors. Preserve transport failure provenance and render localized, honest connection recovery.
2. Add failing category preparation concurrency, retry and owner-change tests. Share preparation only within the captured owner/session and clear failed attempts.
3. Add failing Home account-once and concurrent transaction-start tests. Reuse fetched account metadata when reading balances and start independent reads together without altering totals/coverage.
4. Add failing local draft/offline and transaction identity-capture tests. Read drafts through a token-independent, current-session owner fence and reuse a captured identity within a single request.
5. Run focused suites, typecheck and required relevant boundary checks. Review the complete diff; report RED/GREEN evidence and remaining physical runtime measurements without claiming measured latency.

No dependencies, account deletion/auth-service edits, remote writes, device interaction or native Voice changes. Keep save/refetch behavior until a separately proven change safely preserves freshness.

## Review and verification

- Startup transport failures and timeouts now have an honest unavailable state, localized explanation and recovery action. The entry feedback uses the existing brand, theme and StateView in a safe-area, scrollable layout. Known Clerk `network_error` retry failures keep connection recovery; invalid configuration remains an error.
- Account/category/ledger GETs use the root-owned cached-read identity helper. Local drafts use the token-independent owner helper. Transaction listing captures one identity per page. Mutations retain fresh-token and receipt/refetch semantics.
- Category preparation shares one attempt within the current session and retries failures. Additional RED/GREEN regression: a new owner starts preparation while an old owner's request remains pending.
- Home reads account metadata once and starts ledger pagination concurrently. Additional RED/GREEN regression: a session change between ledger pages rejects the combined summary rather than mixing owners.
- Final focused verification: 12 suites, 300 tests passed. TypeScript passed. Targeted ESLint: zero errors and two pre-existing warnings. Foundation, design-system, app-shell, core-finance and Voice boundary checks passed. Changed-file whitespace check passed.
- One complete bounded mobile run finished without OOM: 478 passed / 9 failed suites; 3,186 passed / 14 failed tests (487 suites / 3,200 tests total, 389.549 seconds). This ran during parallel editing. A rerun of all nine failed suites passed seven suites / 102 tests, leaving two deletion journey tests for the deletion workstream. Offline timeout/storage and entry assertions now pass; the run is not recorded as a full green suite.
- Evidence is private under `D:/Masarifi-preservation-2026-10-16/reliability`, including RED/GREEN regressions, `offline-final-focus.txt`, `offline-final-typecheck.txt`, `offline-final-eslint.txt`, `offline-mobile-full-suite-bounded.txt` and `offline-full-failures-rerun.txt`. The six old repository-root offline logs were moved there with SHA-256 verification.
- Native startup/Home/manual/Voice timings and screenshots remain root-owned runtime verification. Request-count/concurrency tests establish removed work, not measured device latency. Existing `VOICE_TIMING` and `MANUAL_DIAG` provide timing-only Staging instrumentation; no save refresh or Voice posting behavior was changed.
