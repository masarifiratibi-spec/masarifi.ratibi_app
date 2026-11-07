# Dashboard UI and integration repair evidence

Date: 7 November 2026, Asia/Riyadh. Base: `e13a90549788d22b56432377a4cff7da5481f43e`. Repository: `D:/Masarifi-integration-2026-10-10`; same `ratibi` branch `codex/voice-promoted-operating-2026-10-13`.

## Readiness result

Dashboard source is qualified for review. Hosted activation and post-deployment acceptance are **not completed**. The authenticated existing dashboard was inspected and real GETs/search were exercised; candidate source has not replaced it. No financial/customer write, campaign, deletion, replay, mobile install, session reset, permission change, database migration, firewall change or service restart was performed.

The human selected the existing Tajawal/DM Sans typography and the existing staging host. The inherited performance files and unrelated untracked work remain outside these commits. iOS remains paused; its uncommitted files were not integrated.

## Defects and corrections

| ID | Reproduction / actual result | Cause and correction | Evidence / limit |
|---|---|---|---|
| UI-01 | `/admin`, Arabic/English, 1440 through390: five/six-digit chart tick labels extended beyond SVG bounds and lost leading digits. | Negative left chart margins. Reserve80px for Y axes and positive margins in both area/bar charts. Keep raw values; change misleading "in thousands" subtitles to actual customer/item units. | Initial browser RED; final15-case browser matrix passes. Tests require nonempty labels on both charts before bounds checks. Synthetic before/after screenshots. |
| UI-02 | `/admin`, dark theme: white attention text on RGB121,169,159 had approximately2.63:1 contrast. Translucent descriptions were weaker. | The interactive teal token also controlled the card background. Give the card separate deep-teal surface, foreground and muted-text tokens. | Dark theme is asserted; computed text alpha is composited before contrast checks; threshold4.5:1. Inspected screenshots. This attention panel is demo-only in current live navigation. |
| UI-03 | Switch `/admin` to English: metric notes, compact money/count values, plan labels and chart summaries retained Arabic. | English mock summary requests were ignored; fixture plans used translated text as keys. Honor locale in the mock response, preserve numeric amounts/currency, use canonical plan keys and translated demo summary. | Browser RED/GREEN and existing authoritative-value repository tests. Live financial formatting is retained; unknown currency cannot become an invented amount/unit. |
| UI-04 | AI usage limits without `operations.settings.read` rendered a blank region. | Component returned null for pending/denied states. Render existing loading/access-denied components. | Focused RED/GREEN; local browser route now shows an explicit alert under the restricted synthetic session. No permission expansion. |
| INT-01 | Hosted privacy export/deletion/retention GETs returned403 `RECENT_AUTH_REQUIRED`; the UI said only "Try again." | Privacy views discarded query errors. Pass them to the existing error component so the required authentication step is explained. | Three focused REDs then GREEN; list and detail error paths corrected. No authentication bypass, logout or challenge was executed. Hosted policy remains unchanged. |
| INT-02 | Hosted `/admin/jobs/queues`: HTTP200 contained53 registered job rows but the page displayed "Unable to load Queue Overview." | Both client schemas capped this registry aggregate at50. Accept up to128 rows, retain strict row validation and reject129; match label length to the128-character wire key. Use classification+job label as React identity. | Actual authenticated GET and SQL/source trace;53-row RED/GREEN, long-key coverage,129-row rejection. SQL registry aggregation is not a50-row cursor page. No server contract change. |
| INT-03 | Queue null age appeared as0 seconds; unknown health appeared as degraded; unknown freshness text claimed telemetry was current. | Preserve null age as unavailable, distinguish measured zero, render explicit unknown badges for operational health/provider/queue cards, and explain stale/unknown freshness honestly. | Rendered-view RED/GREEN;49 system-health cases pass. No job retry/cancel was performed. |

## Actual hosted observations

- Existing authenticated entry: `https://staging.masarifiratibi.com/admin`. The separately inspected apex domain displayed a parked-domain page; no DNS change was made.
- Browser-observed API origin: `https://api.staging.masarifiratibi.com`; Clerk JS origin: `https://clerk.staging.masarifiratibi.com`. Mocks and role switching were absent from the real UI.
- Current browser HTML advertised Next build **`RfJI7jhDb6BdroFc-2TBT`**. It differs from the historical October build `zA2N1Ieyy_M2GHbAZKZaw`. `/admin-release.json` returned404 in the authenticated browser. Therefore the old3039/unit snapshot is not accepted as a fresh serving-unit identity.
- Access context, overview, customer listing, support overview/tickets/categories, feedback, imports, institution coverage, AI overview, social links, security overview/events, audit, team, roles, general settings and job runs/schedules returned200 in the observed journeys. Client-pending samples were not counted as completed reads merely because a heading appeared.
- A deliberately nonexistent customer search returned200 with an empty array and the visible empty state; the filter was cleared afterward. Overview unique-customer totals agreed between its summary and analytics responses. Missing revenue remained null/unavailable; missing health measurements were not presented as healthy.
- Privacy/retention reads require recent authentication. Their403 receipts are a real acceptance limit, not a reason to alter access rules. Queue registry reads succeeded; the hosted queue UI remains affected until the reviewed source is deployed.
- SSH22 timed out using the retained operator identity and pinned host. A new hPanel browser-console tab was opened read-only; terminal input did not produce a verified command result. Its incomplete input and the created console/tab were closed. No firewall rule was opened, and no host command result is claimed. The native-window inspection rejected in the earlier turn was not repeated.

## Verification receipts

Private command logs/screenshots/traces remain under `.superpowers/sdd/2026-11-07-dashboard-production/` (ignored). Published images contain only synthetic data.

| Check | Accepted result |
|---|---|
| Final Admin unit suite |108 files,1029 tests passed; `unit-delivery.log` |
| Affected operations unit suite |4 files,49 tests passed; `operations-final.log` |
| Strengthened visual regression |15/15 passed across1440/1280/1024/768/390; `final-ui2.log` |
| Affected health/job browser journeys |12/12 passed at1440/390; `operations-browser.log` |
| Existing desktop/mobile journeys |48 initially passed,35 viewport-inapplicable skips,3 failures. All3 failed cases subsequently passed in an isolated rerun (`recheck2.log`); no guard was relaxed. |
| Source route inventory/browser sweep |106 page patterns inventoried;106 local visits without page exceptions or document overflow; corrected dynamic examples and7 focused390px rechecks are recorded separately. This is route/render coverage, not106 end-to-end business acceptances. |
| TypeScript / full ESLint |Both exit0, empty diagnostic logs; `typecheck-delivery.log`, `lint-delivery.log` |
| Exact final-source production build |Next16.3.8 build/types/static generation exit0; `build-delivery.log`. Live mode, mocks disabled, actual observed public API/Clerk bindings. A noncredential validation-only server-secret placeholder was used locally. This build does not prove hosted authentication and is not the deployable runtime artifact. |
| Review |Fresh read-only reviewer; test gaps and queue display/label findings corrected and regression-tested. No independent whole-product or infrastructure certification. |

The initial concurrent route/journey run showed Fast Refresh reloads, missing development chunks and timeouts. Logs are retained; the three failures were rechecked alone. The first build caught a nullable-currency type error, subsequently corrected. An intermediate strengthened chart test used a Recharts wrapper class absent in the installed version; it was corrected against the actual DOM, and the accepted15-case run requires real labels. Failed/interrupted attempts are not counted as passing.

## Remaining acceptance limits

Hosted source/build/unit/environment/rollback binding needs fresh read-only reconciliation. Actual target-runtime credentials must remain on the host; no fake build-validation secret may be promoted. No deployment approval is requested from an unverified host binding.

No new live customer/provider writes were performed. Local HTTP/SQL recovery evidence from October remains historical and reusable only for unchanged inputs; its stopped database was not reset/upgraded to manufacture a fresh receipt. Real provider completion, current SQL write lifecycle, hosted candidate authentication, full role/owner negative acceptance and post-deployment browser acceptance remain distinct gates. Billing is explicitly unavailable; advanced content/marketing surfaces outside live navigation are not newly certified. Some retained operational pages still use English labels within Arabic mode.

Artifact verification caught the workstation Git archive CRLF conversion. The source bundle was regenerated with `core.autocrlf=false`; all15 archived file hashes now equal the committed canonical Git blobs. The manifest pins the corrected archive; no source behavior changed.

Synthetic visual evidence: [before Arabic/light1440](synthetic-before-ar-light-1440.png), [before Arabic/dark1440](synthetic-before-ar-dark-1440.png), [after English/dark1440](synthetic-after-en-dark-1440.png), [after Arabic/light390](synthetic-after-ar-light-390.png).
