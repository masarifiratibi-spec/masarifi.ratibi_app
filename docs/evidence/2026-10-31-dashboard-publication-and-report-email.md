# Staging dashboard publication and requested PDF email work

The human authorized publishing the qualified dashboard UI on Staging, preserving the existing phone/account/APK/Metro and financial data, and subsequently requested removal of report history, the original right-side PDF circle, a smaller footer and PDF **attachments** to the customer's account email. A later steering message prioritizes testing the actual report request before final delivery.

## Dashboard actually published

The source8678c586 presentation overlay was applied to six production files on the retained hosted Admin source, without replacing its working API/authentication contracts. All six canonical preimages matched; four retained files used CRLF, which was normalized only for these exact overlay comparisons. Targeted navigation/contract tests passed21 cases, and the production Next16.3.8 build/types/static routes succeeded.

An initial handover preflight refused `HOST_RESOURCES` before installing a service or changing Nginx. Actual available memory was1874MiB; free disk was14.02GiB, below the retained15GiB gate. Only the new candidate's generated351MiB build cache was removed, and45,082 individually content/size/mode/owner-identical dependency files were hardlinked to the existing read-only package files. Different files and all original files/services remained intact. This reclaimed duplicate blocks, giving15.24GiB free; runtime source, package contents and security controls did not change. Build cache is excluded from the final immutable artifact manifest.

The fresh phone gate matched all five original projections, including2026-13, with the original APK and Metro33696 and native producers off. A120-second watchdog/70-second rollback threshold guarded the single3038→3039 Nginx handover. The journal committed in3.802515983581543 seconds, with1722MiB available at admission. All36 Docker services and all three older native Admin services kept their identities/configuration/start state. No rollback, API replacement, migration or financial operation occurred in this dashboard handover.

| Actual publication binding | Value |
| --- | --- |
| Serving service |`masarifi-admin-ui-8678c586-01.service`|
| Loopback port / observed PID |3039 /1489262|
| Public build ID |`zA2N1Ieyy_M2GHbAZKZaw`|
| UI source |`8678c586f8a7de5d84b74f5da4b0a4ada10355ea`|
| Immutable artifact manifest SHA256 |`a69ce55252184110fb479b970a83caa4c6f8b4038a8f54826a3f6b6f2557b7d9`|
| Nginx SHA256 after conversion |`c24c2695a5fd2cab99e6701f63a6c00a4635e440606702c59ba12f4b5c47ae88`|
| Native unit SHA256 |`1a458cdbb727fb4bf73a6af2559671a784811017bdb2541bca38ea32c79d3af5`|

The actual authenticated Overview was ordinarily reloaded using the same account. The new Feedback navigation entry appeared under its existing permission. The390px Arabic light commands retained visible/accessible Export/Refresh names and44px heights; document overflow was absent. Arabic dark and English dark were inspected, and the original Arabic/light/default viewport was restored, again without horizontal overflow. The earlier complete15-case localhost responsive matrix is separate evidence. No CSV export or feedback lifecycle was replayed. A post-publication host check revalidated the new artifact/unit/public marker and every protected older service; public marker fields inherited from the older release describe historical qualification, not a new API rollout.

## Source/UI report changes

- Deleted the report-history route/screen/test and entry point, client listing contract/adapters/query and hidden preview/schedule history lists. Retained internal job/idempotency storage needed for correctness and existing backend records; no financial data was purged.
- Kept the original56dp PDF circle physically right in both directions. Reduced its inset reservation and the Reports bottom clearance together. On the same phone its new bounds were[882,2046][1036,2200]; the footer remained readable and history absent.
- The Reports and live Preview controls now use the same immediate themed “قد يستغرق هذا بعض الوقت” popup and PDF/email request. Preserve filters and account/currency/cycle/locale, resolve the primary verified email on the server, retain owner/scope fences, and reuse an uncertain POST's operation identity. A queued request is never labeled an email delivered. No direct file-picker/share action remains in the live export path.
- Added bounded exact-owner/attempt PDF reads and in-memory MIME attachments to the existing TLS-only SMTP transport. Retain stable Message-ID, disabled filesystem/URL attachments and ambiguous SMTP acceptance handling.

UI RED reproduced the old download behavior; popup/journey GREEN passed30 cases. Final affected mobile coverage passed21 suites/103 cases, with full TypeScript, exact lint and frontend boundaries passing. The live preview's legacy-control RED failed one case before its correction; its four preview cases subsequently passed. API report projects ran in isolated processes because the combined TS-Jest process exhausted its heap; that failure is retained. Those six project runs passed179 cases with45 existing live-only skips. Later final unit/build qualification is recorded separately; a stalled storage-body deadline test explicitly cancels the body, and worker startup/single-flight/shutdown tests include context-close timer disposal.

## Actual request is not yet accepted as working

During the human-prioritized actual check, the phone already displayed “تعذّر طلب التقرير بالبريد”. The guarded automation refused to click an absent underlying FAB; it did **not** press Retry, send a second request or open a new consumer window. Existing Nginx receipts showed successful summary GETs followed by a400 report POST. The serving API image remains32062a69 and still enforces the earlier recipient contract. The similarly named assistant/report container runs `assistant-agent-worker.js`, not a report-email poller. The running operations worker is scoped to sync retry. These are runtime gaps, rather than evidence of a successful email delivery.

The new dedicated email-worker context and additive read-only RPC select only manual PDF/email requests after a fixed activation floor, filtering before limit so101 old downloads cannot starve a new request. Exclude old work, schedules, expiry/deletion and unrelated jobs. Source migration/tests are prepared; **no hosted SQL, new API/worker image, SMTP send or financial test email has been applied by this evidence record**. The [compiled repair manifest](../reviews/2026-10-31-report-email-patches.json) and [design](../superpowers/specs/2026-10-31-report-email-delivery-design.md) make the proposed implementation reviewable. Concrete hosted candidate qualification and activation/actual PDF data/SMTP/inbox evidence remain required. Old finite S1 windows and canceled ZIP work are not resumed.

The additive function stays in the private schema with an empty search path, explicit worker-context validation and revoked public/API/client execution, following [Supabase function security guidance](https://supabase.com/docs/guides/database/functions). Its active-status predicate explicitly matches the retained partial index rather than relying on an implication through CASE; [PostgreSQL explains that predicate matching requirement](https://www.postgresql.org/docs/current/indexes-partial.html). The migration file was created through the installed pinned Supabase CLI. The local Docker engine is unavailable, so the new disposable PostgreSQL tests are not represented as locally executed. Connected read-only Staging metadata independently confirmed the new selector is absent, the existing worker read contract is present, and the actual tracked migration count is169. No real-owner fixture inserts or rollback-DDL testing was used to manufacture a database pass.

## GitHub evidence

On893de551 all three configured workflows completed successfully: [Backend Foundation333](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/41180506210), [Staging Client Regression85](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/41180506212) and [Voice Private Journal Preparation89](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/41180506220). The Joi18.3.1 dependency repair passed that run, including the backend image job. This does not claim the following email/RPC changes have already passed a fresh remote workflow or been deployed. Synthetic native preparation success still does not support the preserved schema16 phone with the production private reader capped at15.

The Arabic [client-plan handoff](../handoffs/2026-10-31-client-plan-handoff-ar.md) covers all62 client IDs and29 tasks, and the separate [behavior/operations report](../handoffs/2026-10-31-component-behavior-and-operations-ar.md) explains expected behavior and dependencies. Neither treats canceled, held or future release gates as completed.
