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

## Final artifact and phone outcome

Client source: `87ca3bcd4f9da6bc370a2cc8cace25f25c6a0f6e`, pushed to the existing `codex/voice-promoted-operating-2026-10-13` branch. Final ordinary arm64 APK:

`D:/Masarifi-builds/Masarifi-Ratibi-2026-10-23-87ca3bcd-arm64.apk`

SHA256: `33a645aa2776751e142018ab9ecdffcb1b6579f96d085a82ec01612cc5e81e99`.

The fresh-bundle release build passed. The verifier matched 18 actual bundled sources to the committed files and inspected the packaged SQLite/Screens repairs. Package/signing identity and standalone Staging configuration passed. Installation used an in-place update of `com.masarifi.mobile`; the installed base APK hash matched the saved artifact. No DEV package or data was modified.

The final phone run passed bounded checks for SAR/EGP income, expense and net totals against an independent confirmed-posting query; switching back from SAR to EGP; all-accounts reporting; correct category contributor counts; the previously empty EGP Health drill-down now showing its one matching transaction; and removal of the requested support phrase on Home. Confirmed income/expense counts and totals matched the earlier observation; these acceptance actions did not create financial transactions. A subsequent cold launch also loaded the all-accounts report and chart successfully. The final APK's scoped EGP Assistant question returned the correct total and record count in 7.651 seconds, one queue attempt and two model rounds for its scoped read.

One separate SAR net-worth/chart load displayed its existing retry state. A single manual retry recovered the correct balance/chart; no corresponding error was found in the bounded structured API-error inspection. The cause is **unconfirmed**, so this is retained as an observation, not claimed repaired by the Assistant worker change. Other per-account totals remained correct during that failure.

The ordinary file-output route currently displays its production-readiness gate, `إرسال التقارير غير مهيأ للإنتاج.` No export was activated or generated. The scoped-output rejection and disabled-action behavior are covered by automated tests; these tests do not prove a configured physical export flow. Screen reports and analytics are independent of this delivery gate.

Private receipts, sanitized worker diagnosis, deployment/hash preservation checks and phone snapshots remain outside the repository in the dated Assistant/report preservation folder. The disposable local fixture was stopped after tests; its source synthetic databases and unrelated server containers/configurations were unchanged.
