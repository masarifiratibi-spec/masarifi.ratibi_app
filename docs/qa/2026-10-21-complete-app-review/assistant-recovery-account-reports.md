# Assistant transient recovery and per-account reports — 2026-10-23

## Scope

Ordinary Staging application and Assistant worker. Account reporting is available to every owner and newly created account through the existing selector; there is no account allowlist. DEV application data and unrelated server runtimes are outside the changes.

## Assistant incident and repair

Sanitized ordinary-worker evidence identified one request that completed after approximately 184 seconds. Its first finance read failed with a database query timeout; recording the retry state also timed out. The claim remained leased until recovery. The model call on the successful attempt took about 1.9 seconds; the worker had not restarted.

The worker now retains a transiently failed status update and retries that same fenced write on its next poll. This recovery path does not submit another model request or repeat finance reads. A stale claim response clears the retained update, and permanent failures do not loop. The original failure is logged before attempting the status write.

Regression observed red before repair, green after: two failed cases became passing. Related Assistant/health/error tests: 211 passed; transient classifier tests: 9 passed. Real isolated PostgreSQL finance-tool integration: 53 passed. The separate queue suite requiring its original fixed-port fixture was skipped and is not counted as a pass.

## Account reports

- Public summary accepts validated owned account IDs; scope participates in the cache key. Missing or foreign accounts return an error without falling back to global results.
- Selected account supplies its native currency to totals, categories, charts, Assistant report context and transaction drill-down.
- Scoped totals use confirmed signed postings so edits and account moves cancel correctly. Transfer principal is excluded; fees remain with the paying account. Refunds follow the receiving account and original category.
- Ledger list category projection includes the owned original category for refunds, and account membership/projection uses effective postings after account edits.
- All-accounts reporting remains available. Scoped PDF/file export is explicitly unavailable with disabled actions; it never silently exports all accounts.
- Removed the displayed estimated-exchange-rate support line requested by the user. Exchange-rate calculations are unchanged.

Real PostgreSQL tests ran only on a freshly cloned disposable local database. The source synthetic database was read through a dump, not modified. This fixture uses the existing local queue shim and does not qualify the complete hosted platform.

Report API unit/contract/security: 121 passed. Account summary, legacy summary, ledger read and ledger revision integration: 22 passed, including two owners, SAR/EGP, new empty accounts, fees, refunds, account moves and invalid scope. Final mobile report/home regression: 38 suites, 172 passed. API build/typecheck and changed-file typed lint passed; full mobile typecheck passed at 1280 MB after the initial 768 MB process exhausted its heap.

## Deployment and physical acceptance

Pending at this source checkpoint. No server activation, new APK installation or post-change physical acceptance is claimed here. Private operational evidence is stored outside the repository under the dated Assistant/report preservation folder. Update this section with the actual runtime and phone outcome before final delivery.
