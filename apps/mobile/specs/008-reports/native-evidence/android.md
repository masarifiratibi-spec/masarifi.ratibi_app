# Android Native Evidence

Date: 2026-08-10

Status: PARTIAL PASS - EXECUTABLE MATRIX RUN; TWO GAPS REMAIN

Environment:

- Physical Android device `RK8XB00N33K`, package `com.masarifi.mobile`.
- Device unlocked (`deviceLocked=0`) and real Expo development build loaded through Metro.
- Physical display 1080x2340 at density 450; font scale restored to 1.0 after testing.
- Synthetic local data and the mock recipient `qa@example.com` only.

## Executed matrix

| Scenario | Result | Retained evidence |
|---|---:|---|
| Monthly, three-month, half-year, and annual ranges | PASS | `android-2026-08-10/monthly.xml`, `three-months.xml`, `half-year.xml`, `annual.xml` |
| Global masked and visible report values | PASS | `visible-values.xml`, `unmasked-values.xml` |
| Category and Other drill-down to canonical filtered transactions | PASS | `drilldown.xml`, `other-transactions.xml` |
| Return to unchanged report period and scroll context | PASS after fix | `return-action.xml`, `return-preserved-scroll.xml` |
| Recipient verification and annual/day-28 detailed schedule | PASS | `schedule-verified.xml`, `schedule-saved-annual-day28.xml` |
| Pause/resume and next-delivery projection | PASS | `schedule-paused.xml`, `schedule-resumed.xml`, `schedule-status.xml` |
| Summary/detailed preview provenance and privacy warning | PASS | `preview-summary.xml`, `preview-detailed.xml` |
| Send-test plus simulated download/share history | PASS | `output-send-test.xml`, `output-simulated.xml` |
| Offline report from local canonical data | PASS | `offline-local-report.xml` |
| 320x568, 200% text, adaptive tablet, RTL, themes, grayscale, reduced motion | PARTIAL PASS | See `visual-qa.md` and the retained Android UI trees. |
| TalkBack semantics and hidden-value announcements | PASS | `talkback.xml`, `talkback-hidden-values.xml` |

The native drill-down run exposed a defect: opening report-origin transactions and returning
landed on Home or reset Reports to the top. The route now carries a sanitized Reports origin,
renders an explicit Back action, and persists the Reports scroll offset. The focused regression
tests and the repeated device journey pass.

## Open native gaps

- The development build exposes successful and simulated output actions but no UI-selectable
  in-flight/late-result scenario. Automated service/repository tests cover late-result invariants,
  but the requested native late-result journey was not converted into a pass.
- The development build uses its normal 500-record mock source and has no native selector for the
  10,000-record fixture. T082 remains open; see `performance.md`.

Device settings were restored after testing: English, system theme, normal motion, balances not
globally hidden, TalkBack off, accessibility services empty, font scale 1.0, physical size/density,
Wi-Fi/data enabled, and night mode returned to its original value.
