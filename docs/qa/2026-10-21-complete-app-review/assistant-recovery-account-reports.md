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

## Physical findings and follow-up

The ordinary API and dedicated Assistant worker were activated with predecessor images retained for rollback. Offline module-graph checks and health/hash checks passed. Preparing the images initially failed on a local base-image reference and then a missing existing planning helper; both were resolved before activation. No schema migration was needed, and unrelated containers/configuration remained unchanged.

The physical Assistant question after deployment completed in 2.986 seconds, one attempt and one dispatch, with a confirmed-spending amount matching the independent posting query. The first APK candidate at `1757eb58` was built with a fresh bundle, verified against its sources/native repairs, and installed as an ordinary package update. Per-account EGP totals and its scoped Arabic Assistant explanation matched the independent income/expense/net oracle.

Acceptance then found two drill-down defects: the live mapper discarded the server's contributing-record count, and a raw category UUID from the report was compared with locally mapped category IDs, hiding matching transactions. Follow-up preserves the count for visible/accessibility output and normalizes only the local category filter, retaining the server transport ID. Both defects were reproduced before repair and passed after repair. The first APK candidate is therefore not the final accepted artifact.

The effective source-account projection is also restricted to editable income/expense. A deterministic real PostgreSQL regression proves that a transfer reversal retains its explicit source role even when membership UUID ordering differs. The follow-up integration run, including actual refund/reversal compensation, passed 5 suites/27 tests. Final report/core-finance/home mobile regression passed 40 suites/229 tests, and the full mobile typecheck passed. The category-filter regression covers both canonical local IDs and raw server IDs.

Final mobile rebuild, installation and physical re-test are pending at this checkpoint. Private operational evidence is stored outside the repository under the dated Assistant/report preservation folder. Update this section with the final artifact and phone outcome before delivery.
