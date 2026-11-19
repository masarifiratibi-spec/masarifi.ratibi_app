# Dashboard functional acceptance review, 19 November 2026

The local audit ran on Windows against branch `codex/voice-promoted-operating-2026-10-13` at committed HEAD `3fd103c7`. The first full Admin checks ran before the concurrent monitoring implementation. The browser journeys used loopback Next.js, Chromium and simulated data. The November 14 VPS packet remains blocked. This review did not change hosted services, data, accounts or permissions.

## Visible destinations

The live navigation function returns five groups and 28 destinations. All 28 matched the actual sidebar builder, route permission resolver and historical route inventory. Each destination was opened in Chromium at both 1440 and 390 CSS pixels.

| Group | Destinations | Local observations |
| --- | --- | --- |
| Platform (1) | Overview | Dashboard rendered. Changing platform recomputed the distinct customer figures in the fixture. |
| Customers and support (6) | Customers, support overview, tickets, categories, feedback, temporary access requests | All six headings rendered. Customer filtering, masked summary, temporary request creation, overlap handling and separated review passed in the fixture. |
| Operations (3) | Imports, bank parsers, AI overview | All three headings rendered. Import confirmation and the safe AI operational summary passed. |
| System Health (9) | Health overview, API, database, storage, providers, AI usage limits, queues, job runs, schedules | Eight headings rendered. AI usage limits correctly showed the missing `operations.settings.read` permission for this test identity. Range switching and navigation into a fixture job passed. |
| Governance (9) | Social media, security, audit, data exports, account deletion, retention, admin team, roles, settings | Eight headings rendered. Social media correctly showed the same permission denial. Admin-team keyboard/dialog and settings revision journeys passed. |

Across the 56 route/viewport combinations, all returned HTTP 200 and none overflowed horizontally. Twenty-six destinations rendered page headings at both widths. The two operations-settings destinations rendered explicit permission denials at both widths. Component suites independently exercised permitted readers, scoped changes and read-only states for those two screens. The browser probe checked route state and layout. The journey tests supplied the interaction evidence. These local checks exercise simulated records and identities.

The historical route file still describes 106 pages. Comparing the filesystem yielded **108 pages**, comprising all 106 catalogued pages and the public `/privacy` and `/terms` pages. Both additional pages rendered a heading at both widths with HTTP 200 and no horizontal overflow. The full Admin suite also passed English and Arabic legal document assertions. Add these as public entries when refreshing the inventory. The original 28 live navigation entries remain accurate.

## Checks performed

| Check | Result |
| --- | --- |
| Admin `npm test -- --maxWorkers=4` | 1,080 tests passed in 114 files on the starting tree. |
| Admin `npm run typecheck` and `npm run lint` | Both passed. |
| Selected API Jest suites for support access DTOs, projection, service authorization, permission manifest, support and RBAC controller routing | 52 tests passed in 6 suites. Controller tests use a fixture principal, stub service and overridden guards. |
| Next shell with `playwright.recovery-shell.config.ts` | Five applicable desktop/mobile journeys passed. Five project-specific cases skipped by design. |
| Additional desktop Playwright journeys | Eleven distinct selected journeys passed across the initial run and a final run covering the failed and unrun cases. The first run stopped after 3 failures, with 4 passes and 4 unrun. The three initial failures were two aborted page navigations and a timeout entering a fixture job. All three passed on the later run. |
| Current VPS packet `python -B -m unittest discover -p 'test_*.py'` | 78 passed on Windows, with 3 Linux file-lock tests skipped. The stored Linux qualification for the same executable packet source passed all 81 in run 43542481161. |
| Artifact and source integrity | All 30 packet files match manifest digests. The source-specific ZIP and inner archive for artifact 14086067555 matched the immutable pins. The verifier checked 584 source files, 52,794 archive entries, 44 internal links and 74 static assets. Committed Admin and the two report inputs matched source fd834905 and build JnPTcIfQ1KSXKIwHFmZEy. |

The old candidate excludes the concurrent working-tree changes. Its 13-gate Foundation result (43542487668) and archived Linux qualification apply to the pinned source. A new candidate that incorporates changes needs fresh qualification. The default recovery PostgreSQL test cluster was not listening on port 55442 and the local Docker engine was unavailable. The SQL-backed recovery browser suite and the complete five-viewport CI matrix were not rerun in this audit.

## Findings from the starting source

1. The audited Admin shell accepted `JOB-*` fixture detail links and returned `forbidden` for live job UUIDs. The API requires UUIDs and the list links to the real run ID. Extend the exact one-segment route match to the backend UUID format, retaining the existing `jobs.runs.read` permission and rejecting malformed IDs and nested paths. Cover a real-shaped UUID in the shell tests. The pre-existing browser fixture used a `JOB-*` ID, so its pass missed this defect.
2. The audited shell mapped a real-shaped incident UUID to the generic `security.events.read` permission. The incident component and controller require `security.incidents.manage`, which the shell already selects for fixture `INC-*` IDs. Map the UUID detail path to the incident permission too. An authorized incident manager holding only the necessary incident permission could otherwise be denied entry.
3. The negative array assertion at line 72 of `apps/admin-web/src/features/foundation/navigation.test.ts` on 3fd103c7 only fails when *all* listed IDs are present. It mixes three legitimate visible IDs with excluded ones. Assert each genuinely excluded ID separately and keep the legitimate IDs in the positive tests.

All three source findings were repaired in `e512e428`. That commit accepts the valid UUID shapes, retains the distinct permissions and asserts individual excluded navigation items. The new artifact qualification below covers this source.

## Support actors and candidate

The saved private and redacted actor inventories both matched their manifest hashes. One historical customer selector had a matching staging Clerk session on October 12. The second came from an inert October 28 proposal. Neither carries a current VPS profile and session attestation. The inventories have no verified assignee or reviewer. The last actual dashboard browser observation on November 14 reached sign-in. On November 19 the initial in-app browser could not attach the staging dashboard. The subsequently connected Brave profile opened the normal dashboard URL and redirected to the first-party Clerk page titled “Sign in to Masarifi Staging.” It offered Apple, Google or email, with no existing signed-in principal. Neither inventory includes a verified staff login selector. The normal staging sign-in tab was retained for the operator. Current actor qualification is **0 of 3 verified**, with 3 awaiting authenticated context.

To qualify the accounts, obtain a trusted redacted current receipt or access to an already-authenticated approved session for each of three distinct test identities. The customer needs a current active profile and a recent authentication when consenting. The operator needs `admin.overview.read` and `support.access.read/request/use`. The independent reviewer needs `admin.overview.read` and `support.access.read/approve/revoke`. Bind opaque subject digests to the effective permissions and active, enabled, unexpired assignments. The independent revoker must differ from the assignee. Role labels and fixture actor selection alone do not establish those facts.

The packet's fourteen hosted cases remain unverified on the candidate. They cover persisted creation, fresh owner consent, independent approval, masked account-status workspace, assigned end, external revoke, expiry, stale-version conflict, replay after an uncertain result, wrong owner, wrong assignee, self-review, session continuity and protected-service continuity. This report contains no credentials, real actor identifiers or customer records.

## Newly built Linux Admin candidate

The isolated Linux build used exact commit `e512e4280c69f6fcb40b1626cbd3d4ee62c3f721`, Admin Git tree `8eaf8bff1e40f277ebc0fcfe9927b998e7a1abd5`, Node 24.16.0, npm 11.17.0 and the committed lock. Fresh installation added 662 packages. Typecheck and the production Next.js build passed and generated 88 of 88 static pages, alongside the dynamic routes. The packaging block from the canonical workflow produced a new Linux archive. Integrity checks used the actual checkout's Git objects. The embedded public API and Clerk values matched the five admitted configuration hashes, including mode, environment and mock setting. Only public configuration and the known placeholder server secret were supplied.

| Artifact | Result |
| --- | --- |
| New Next build ID | `OZNHj4MArklVCJK6xmzt5` |
| Local ZIP | 263,862,406 bytes, SHA256 `e126f960760a791d67e9aa9a688da603aedb1b8738aacea90b6d9b3225c2b547` |
| Inner runtime tar.gz | 263,860,663 bytes, SHA256 `c2c1e4179a40f432724436d40dcc61d68813ef96eb723de080a431d1ce5cd02e` |
| Build manifest | SHA256 `b7bbd5c365440481eebdad2c0a6d2d0786481300708ec4341c53b82bf249edda` |
| Scoped canonical source archive | SHA256 `37c0af1749b4e6f04a657851c7a2bfcb11d1ea285c197ce95815a4bfff55a2a8` |
| Archive verifier | 584 source files, 52,794 entries, 44 internal links, 74 static assets |
| Disposable Linux packet controls | 81 passed, zero skipped, in a network-disabled Linux container |

The verified archive was unpacked into a fresh disposable Linux volume and started separately with the pinned linux/amd64 runtime at registry digest `53a7a4530dfa0fb9b296d0c5bca3c330bf308fa7160fd7966cea681d092ca2c5`. Registry config digest `fbbe2a5ac5a540add77c05927b1f1009f9fb49f13f8dfdc07cd4f3b2747327a8` and runtime Node 24.20.0 matched. The non-root 1000:1000 container used a read-only root and runtime volume, temporary writable cache, 512 MiB memory limit, no network and no published port. It stayed running, with zero restarts and no OOM. An in-container HTTP GET of the new build's static manifest returned 200 and the expected SHA256 `9476e0afd3f9da68a64e6ec58631191fd3eaca62c9f5a377e7517fe9a89e59ea`. The same running archive returned a page heading and HTTP 200 for English privacy and Arabic terms. Dedicated test containers and volumes were removed.

The verifier rechecked the same archive against follow-up commit `5d71ca5d7c1a0a29be76d18c0d68db3c4b6e6962`. The Admin tree, both report inputs and all four shared legal source JSONs were unchanged. The two canonical report inputs are `apps/api/src/reports/reports.admin.ts` at Git blob `10f59518295b60e348a11cc3623e6d44b57f3b78` and `apps/api/src/reports/reports.admin-types.ts` at Git blob `ca0f7c4610b806b758a7eb65404152cafe238746`. Their SHA256s are `8d84a76a4a1a21fa3c734da656f8fcea67d1d5b457e3b9ca1a60f00bf0270efb` and `cd6ab17f290a3499c10289acb0c43365546c355f08554000ba3828668fc4a28c`, respectively. The existing verifier's scope excludes the four legal JSON imports. This audit separately bound their byte digests to the source and checked them at the compatible head. Backend report delivery and API code outside those two Admin compilation inputs need their own qualification.

A separate Chromium fixture compiled the exact production monitoring view, hook and live repository adapter, and replaced only identity and the HTTP data source. At 1440 and 390 pixels the 24-hour observation showed 20 completed requests, 10% server errors, p95 of 48 ms and partial coverage. All four status denominators matched the submitted fixture. Clicking 7d showed unavailable metrics for absent evidence, 1h showed measured zero requests and unavailable error rate, and 30d showed stale telemetry. Each viewport issued the expected four GET requests with no external requests. The cold-start test and this feature fixture are separate observations. Hosted monitoring still requires an authenticated reader and a bounded comparison to actual journal totals.

The new ZIP is a local artifact and has no GitHub artifact ID. The November 14 packet still references a different build and its older two-module support-access overlay. Hosting the new release requires a reviewed immutable candidate for the changed API/report runtime, collector inputs and mounts, current public configuration and host admission, route coverage and reversible trial. The three authenticated test actors, protected runtime observations and trial approval are still outstanding. No artifact was uploaded or deployed.

Local evidence is stored under `.superpowers/sdd/2026-11-19-admin-local-checks/linux/`. The branch-compatible archive, human-readable manifest, source verification and cold-start receipt are in `e512e4280c69/` as `artifact.local.zip`, `manifest.json`, `verification.json`, `compatible-head.json` and `cold-start.json`. The adjacent `preparation.json` and `monitoring-browser.json` record the build environment and feature observations.
