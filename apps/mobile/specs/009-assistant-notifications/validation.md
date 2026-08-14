# SPEC-009 Validation Evidence

## T141 static gates

| Command | Exit | Evidence |
|---|---:|---|
| `npm run typecheck` | 0 | `tsc --noEmit` completed without errors. |
| `npm run lint` | 0 | ESLint completed with 0 errors and 12 warnings. |
| `npm run check:foundation` | 0 | Foundation boundaries passed, 715 files checked. |
| `npm run check:design-system` | 0 | Design-system boundaries passed, 715 files checked. |
| `npm run check:app-shell` | 0 | App-shell boundaries passed, 715 files checked. |
| `npm run check:core-finance` | 0 | Core-finance boundaries passed, 715 files checked. |
| `npm run check:voice-capture` | 0 | Voice-capture boundaries passed, 27 files checked. |
| `npm run check:financial-planning` | 0 | Financial-planning boundaries passed, 715 files checked. |
| `npm run check:reports` | 0 | Reports boundary check passed. |
| `npm run check:assistant-notifications` | 0 | Assistant notifications boundary check passed. |

Audit-fix rerun (2026-08-13): `npm run typecheck`, `npm run lint`, and all eight `check:*` scripts exited 0. ESLint completed with zero warnings; boundary checks scanned 712 files (voice scope: 27).

## T142 full automated regression gate

| Command | Exit | Evidence |
|---|---:|---|
| `node scripts/check-assistant-notifications-boundaries.test.mjs` | 0 | Feature boundary self-test passed. |
| `npm run test -- --runInBand` | 1 | npm 11.17.0 consumed `--runInBand` as an npm config and ran worker-mode Jest; initial run exposed SPEC-009 regressions in timezone defaults and tracking notification test seams. |
| `npx jest --runInBand src/storage/secure-preferences.test.ts src/features/tracking/review-resolution.test.ts src/features/tracking/AutomaticReviewJourney.test.tsx src/features/tracking/automatic-tracking-undo.test.ts src/storage/automatic-tracking-financial-effects.test.ts src/features/tracking/AutomaticTrackingJourney.test.tsx` | 0 | Focused regression rerun passed: 6 suites, 11 tests. |
| `npm run typecheck` | 0 | TypeScript completed after the regression fixes. |
| `npx jest --runInBand` | 0 | Full Jest passed: 313 suites, 835 tests. Existing warnings only: one React `act(...)` warning in `HomeAccessibility` output and Jest open-handle notice after completion. |
| `npx jest --runInBand src/storage/database.test.ts src/storage/assistant-notifications-repository.test.ts src/services/mocks/assistant-notifications-service.test.ts src/storage/subscriptions-repository.test.ts src/storage/support-repository.test.ts` | 0 | Schema-v7 and idempotency proof passed: 5 suites, 41 tests, covering v7 migration/tables/indexes plus notification, assistant, subscription, and support replay/idempotency invariants. |

Audit-fix rerun (2026-08-13): `npx jest --maxWorkers=1 --workerIdleMemoryLimit=1200MB` passed 313 suites and 841 tests. `--detectOpenHandles` identified two test-owned TanStack Query GC timers; the test now clears its client, and the focused open-handle rerun exits cleanly. The stale Home accessibility query was replaced by its existing module seam, removing the React `act(...)` warning in the focused rerun.

## T143 performance fixture

| Item | Evidence |
|---|---|
| Test hardware/runtime | Windows `win32` x64, Node `v24.16.0`, 20 logical processors, about 13 GB RAM from Node `os` module. Detailed CIM CPU/RAM probe was denied by Windows permissions. |
| Warm-up command | `npx jest --runInBand src/features/notifications/assistant-notifications-performance.test.tsx` exited 0: 1 suite, 1 test, test body 3 ms. |
| Measured command | `npx jest --runInBand src/features/notifications/assistant-notifications-performance.test.tsx` exited 0: 1 suite, 1 test, test body 2 ms, Jest time 0.961 s. |
| Fixture counts | 1,000 notification events and 1,000 assistant responses. |
| First useful content | `1 ms` from `countMountedAssistantNotificationRows`, below the 2,000 ms threshold. |
| Maximum mounted rows | `99`, below the `<100` threshold. |
| Log/privacy check | Jest output contained only test suite/status/timing text; no SPEC-009 source record, snapshot, question, answer, notification body, protected value, secret, or user-authored content appeared in logs. |
| Follow-up typecheck | `npm run typecheck` exited 0. |

## T144 Android development-build validation

Evidence folder: `specs/009-assistant-notifications/evidence/android-t144`.

| Item | Result | Evidence |
|---|---|---|
| Device connection | PASS | `adb devices` listed `RK8XB00N33K device`; model `SM-A165F`, Android `16`, physical size `1080x2340`, dark mode `yes`, font scale `1.0`. |
| Audit-fix launch smoke (2026-08-13) | PASS | The same USB device was detected, `com.masarifi.mobile/.MainActivity` became the focused app, and `evidence/android-t144/spec009-current.xml` captured the live bilingual language-choice surface. This is a launch smoke only and does not close the blocked scenario rows below. |
| Native module freshness | PASS after rebuild | Initial dev build failed with missing `ExpoPushTokenManager` (`native-missing-module.png`). Rebuilt/reinstalled with `expo-notifications (0.28.19)` autolinked; `npx expo run:android --no-bundler` reported `BUILD SUCCESSFUL`. |
| App launch and localization shell | PARTIAL PASS | `black-screen.xml` captured Arabic RTL language picker text; `english-after-select.xml` captured English LTR landing copy. Screenshots of the React surface were black on this device, so XML dumps were retained as the usable evidence. |
| Auth/onboarding entry to protected app | PASS | `signin.xml`, `after-google.xml`, `after-google-account.xml`, and `after-not-now.xml` show deterministic Google mock sign-in, onboarding skip, and protected home shell. |
| Hidden values in protected shell | PASS | `after-not-now.xml` exposes hidden financial values only as localized hidden-value accessibility text, not raw balances. |
| Notification center route | PARTIAL PASS | `notifications.xml` shows `/notifications` with unread count, Mark all read, all eight filters, empty state, and localized headings. Seeded dense/source event matrix, persistence after restart, mark-read, duplicate, and delete-only source checks were not executed on device. |
| Notification preferences route | PARTIAL PASS | `notification-preferences.xml`, `notification-preferences-lower.xml`, and `notification-preferences-summary.xml` show permission state, phone/category switches, quiet hours, timezone, active days, daily summary, weekly summary, and weekday choices. |
| Permission education and OS prompt | PASS | `permission-education-visible.xml` shows the in-app education step; `system-permission.xml` shows Android system permission prompt. After Allow, `adb shell cmd appops get com.masarifi.mobile POST_NOTIFICATION` returned `Default mode: allow`. |
| Permission/system-settings recovery states | PARTIAL | Native grant was proven. Denied, permanently denied, restored, unavailable, and settings recovery were not all manually cycled on the physical phone. |
| Foreground/background/cold local notification response | PARTIAL PASS | The continuation run presented a foreground native notification and handled its View response on the physical device. Background/cold branches remain covered by controller automation rather than three separate device captures. |
| View/Edit/Undo quick actions and unlock/revalidation | PARTIAL PASS | `spec009-native-shade-expanded.xml` proves Android rendered View, Edit, and Undo actions. `spec009-native-view-response.xml` proves View opened the canonical transaction detail. Edit/Undo delivery remains covered by automated controller/service tests. |
| Expired/changed action fallback | BLOCKED | Actual native expired-response delivery was not executed; automated controller/service tests cover logic only. |
| 200% text | BLOCKED | Device font scale remained `1.0`; no 200% physical-device capture was taken. |
| TalkBack | BLOCKED | TalkBack spoken traversal was not captured; UIAutomator XML is not a TalkBack proof. |
| Small phone | BLOCKED | Physical device size was `1080x2340`; no temporary small-display override was retained as evidence. |
| Offline recovery | BLOCKED | Device was not taken through airplane/offline recovery scenarios. |

### 2026-08-13 Android continuation (TalkBack and iOS excluded by user)

| Item | Result | Evidence |
|---|---|---|
| Protected session and privacy | PASS | Deterministic Google sign-in reached the protected shell. `spec009-auth-current.xml` proves hidden balance/income/expense output uses `Value hidden` and contains no raw amount. |
| Notification center | PASS for reachable states | `spec009-notifications-current.xml` proves the live route, unread count, Mark all read, all eight filters, and localized empty state. |
| English LTR | PASS | `spec009-step-language.xml` proves English landing copy and actions. Earlier Arabic RTL evidence remains in `black-screen.xml`. |
| Dark and light mode | PASS for launch/render | Device reported dark mode `yes`; the app was also rendered after temporary `cmd uimode night no` and captured in `spec009-light.xml`, then restored to dark mode. |
| 200% text | PASS for notification-center reachability | Font scale was temporarily set to `2.0`; `spec009-notifications-200.xml` proves the complete filter set and empty state remain reachable with reflow. Font scale was restored to `1.0`. |
| Small display | PARTIAL | A temporary `320x568` override was exercised and retained as `spec009-small-live.xml`; the development launcher intercepted one cold restart, so the full scenario matrix was not claimed. Display size was restored to physical `1080x2340`. |
| Offline | PARTIAL | Airplane mode was enabled, the installed application remained launchable from local state, and `spec009-offline.xml` was retained. Airplane mode was restored to `0`. No deterministic source fixture on this build exposed every offline mutation state. |
| Permission restoration | PASS for OS restoration | Permission was revoked and restored through ADB; final `appops` state reported `Default mode: allow`. The dev launcher intercepted the denied-state cold capture, so it is not claimed as UI proof. |
| Native notification View/Edit/Undo | PARTIAL PASS | A development-only validation route presented a real local notification. `spec009-native-shade-actions.xml` and `spec009-native-shade-expanded.xml` prove the notification and all three Android action buttons; `spec009-native-view-response.xml` proves View resolved the stored notification ID and opened transaction `transaction-1`. The run exposed and fixed two Android platform gaps: missing `financial-change` channel registration and missing foreground notification handler. Edit/Undo execution remains covered by focused automation, not separately claimed as physical taps. |
| Deep-link format observation | PASS with constraint | Path-style URLs such as `masarifi:///assistant` render the correct screen. Expo development builds also display a development-only router warning overlay for direct external URLs; production navigation uses typed in-app routes and notification IDs rather than arbitrary external URLs. |

The phone was restored after validation: physical display size, font scale `1.0`, dark mode enabled, airplane mode disabled, and notification permission allowed.

T144 is not marked complete because the development-build run proved the rebuilt Android baseline and several route/permission states, but did not execute all quickstart scenarios 1-9.

## T145 iOS and VoiceOver native validation

| Item | Result | Evidence |
|---|---|---|
| iOS simulator/device run | BLOCKED | Current workstation is Windows with no macOS/Xcode runtime available. |
| VoiceOver native traversal | BLOCKED | VoiceOver requires iOS/macOS tooling; no iOS evidence was available. |

Unavailable iOS/VoiceOver evidence is recorded as blocked, not passed.

## T146 requirements trace review

| Requirement | Task/test/evidence reference | Status / unmet item |
|---|---|---|
| FR-001 | T005-T019, T031-T046; `src/domain/notifications.test.ts`, `src/storage/assistant-notifications-repository.test.ts`, `src/services/mocks/assistant-notifications-service.test.ts`; Android `notifications.xml`. | Automated PASS; Android seeded full event matrix not executed. |
| FR-002 | T005-T019, T031-T038; notification domain/repository/service/screen tests. | Automated PASS. |
| FR-003 | T041-T044; automatic tracking and voice integration tests. | Automated PASS. |
| FR-004 | T041-T044 plus planning owner notification integration tests. | Automated PASS. |
| FR-005 | T041-T044, T047-T059; policy/service tests for budget, salary, savings, report, and summaries. | Automated PASS. |
| FR-006 | T060-T084; assistant service/action/screen tests. | Automated PASS. |
| FR-007 | T098-T115 and T123-T130; settings/security/support event tests. | Automated PASS. |
| FR-008 | T032-T038; `NotificationCenterScreen.test.tsx`; Android `notifications.xml`. | Automated PASS; Android empty/filter route only. |
| FR-009 | T031-T040; notification service/query/repository tests. | Automated PASS. |
| FR-010 | T047-T059; policy/phone adapter tests; Android permission evidence. | PARTIAL: native local presentation/actions not executed. |
| FR-011 | T039-T040; response controller tests. | Automated PASS; actual native View/Edit/Undo not executed. |
| FR-012 | T033, T039-T040; safe navigation/fallback tests. | Automated PASS; actual native expired fallback not executed. |
| FR-013 | T031, T041-T044, T059; dedupe/idempotency tests. | Automated PASS. |
| FR-014 | T049-T056; preference query/screen tests; Android preference XML. | PASS with Android partial proof. |
| FR-015 | T047-T059; policy/service tests. | Automated PASS. |
| FR-016 | T047-T059; quiet-hour timezone policy tests; Android preference XML. | Automated PASS; manual native quiet-hour delivery not executed. |
| FR-017 | T059; summary grouped-count/covered-period tests. | Automated PASS; native scheduled delivery not executed. |
| FR-018 | T048-T055; phone adapter/preference tests; Android appops grant. | PASS for grant; denied/permanent/unavailable native cycling not executed. |
| FR-019 | T047-T059, T131-T140; privacy/masking tests; Android protected-shell XML. | PASS with Android hidden-value evidence. |
| FR-020 | T033, T050, T131-T140; state matrix tests. | Automated PASS. |
| FR-021 | T060-T073; assistant consent service/screen tests. | Automated PASS. |
| FR-022 | T060-T073; assistant journey/localization tests. | Automated PASS. |
| FR-023 | T060-T073; assistant query/home/conversation tests. | Automated PASS. |
| FR-024 | T060-T073; assistant service structured-answer tests. | Automated PASS. |
| FR-025 | T060-T073; assistant context/snapshot tests. | Automated PASS. |
| FR-026 | T060-T073; structured label/evidence tests. | Automated PASS. |
| FR-027 | T060-T073; no-invented-values tests. | Automated PASS. |
| FR-028 | T060-T073; insufficient/stale/conflict tests. | Automated PASS. |
| FR-029 | T060-T073; educational redirect tests. | Automated PASS. |
| FR-030 | T060-T073 and T098-T115; personalization disablement tests. | Automated PASS. |
| FR-031 | T060-T073, T131-T140; assistant states tests. | Automated PASS. |
| FR-032 | T074-T084; assistant action proposal tests. | Automated PASS. |
| FR-033 | T074-T084; preview disclosure tests. | Automated PASS. |
| FR-034 | T074-T084; edit/cancel/return tests. | Automated PASS. |
| FR-035 | T074-T084; revalidation/version/entitlement tests. | Automated PASS. |
| FR-036 | T074-T084; pending/succeeded/failed/offline/stale/replay tests. | Automated PASS. |
| FR-037 | T085-T097; subscription screen/service tests. | Automated PASS. |
| FR-038 | T085-T097; offer/catalog tests. | Automated PASS. |
| FR-039 | T085-T097; trial eligibility tests. | Automated PASS. |
| FR-040 | T085-T097; lifecycle state tests. | Automated PASS. |
| FR-041 | T085-T097; operation replay/pending guard tests. | Automated PASS. |
| FR-042 | T085-T097; failure/cancel preservation tests. | Automated PASS. |
| FR-043 | T085-T097; restore tests. | Automated PASS. |
| FR-044 | T085-T097; downgrade/expiry/read-only tests. | Automated PASS. |
| FR-045 | T085-T097; representative-payment wording tests. | Automated PASS. |
| FR-046 | T098-T115; profile/settings journey tests. | Automated PASS. |
| FR-047 | T098-T115; application settings tests. | Automated PASS. |
| FR-048 | T098-T115; security/PIN/session tests. | Automated PASS. |
| FR-049 | T098-T115, T131-T140; secret masking/accessibility tests. | Automated PASS. |
| FR-050 | T098-T115; privacy request/local delete tests. | Automated PASS. |
| FR-051 | T098-T115; tracking/assistant disablement tests. | Automated PASS. |
| FR-052 | T098-T115; export/account deletion request and local reset tests. | Automated PASS. |
| FR-053 | T098-T115; preserved input/failure tests. | Automated PASS. |
| FR-054 | T116-T130; support service/journey/route tests. | Automated PASS. |
| FR-055 | T116-T130; support validation/draft tests. | Automated PASS. |
| FR-056 | T116-T130; ticket list/detail tests. | Automated PASS. |
| FR-057 | T116-T130; support context integration tests. | Automated PASS. |
| FR-058 | T116-T130; support submission-state tests. | Automated PASS. |
| FR-059 | T026-T030 and T140; analytics allowlist/privacy tests. | Automated PASS. |
| FR-060 | T131-T136; Arabic/English localization parity tests; Android language XML. | PASS with partial Android proof. |
| FR-061 | T132, T137; accessibility tests. | Automated PASS; physical 200%/TalkBack not executed. |
| FR-062 | T131-T140; design-system/boundary/accessibility tests. | Automated PASS. |
| FR-063 | T133, T138; state matrix tests. | Automated PASS. |
| FR-064 | T135, T140; privacy-output/analytics tests; Android hidden-value XML. | PASS with Android hidden-value evidence. |
| FR-065 | T048-T059, T085-T130; deterministic representative outcome tests. | Automated PASS; native local notification actions not executed. |
| SC-001 | T033-T038, T144 Android center evidence. | BLOCKED for acceptance percentage: no usability sample. |
| SC-002 | T039-T040 automated response controller tests. | Automated PASS; native quick-action percentage not proven. |
| SC-003 | T047-T059, T135-T140 automated privacy/policy tests. | Automated PASS; native denied/quiet/summary manual matrix partial. |
| SC-004 | T049-T056, T144 preference evidence. | BLOCKED for acceptance percentage: no usability sample. |
| SC-005 | T060-T073 automated assistant tests. | BLOCKED for acceptance percentage: no usability sample. |
| SC-006 | T060-T073 automated assistant edge-state tests. | Automated PASS. |
| SC-007 | T074-T084 automated action-preview tests. | Automated PASS. |
| SC-008 | T085-T097 automated subscription tests. | BLOCKED for acceptance percentage: no usability sample. |
| SC-009 | T085-T097 automated subscription lifecycle tests. | Automated PASS. |
| SC-010 | T098-T115 automated settings/security tests. | BLOCKED for acceptance percentage: no usability sample. |
| SC-011 | T116-T130 automated support tests. | BLOCKED for acceptance percentage: no usability sample. |
| SC-012 | T131-T140 automated i18n/accessibility tests; T144 partial Android evidence. | BLOCKED for native 200% Android/TalkBack/iOS/VoiceOver proof. |
| SC-013 | T131-T140 automated language/privacy checks. | BLOCKED for satisfaction rating: no usability sample. |
| SC-014 | T143 performance fixture. | PASS: 1,000 notifications and 1,000 responses, first useful content 1 ms, max mounted rows 99. |

The feature is not marked fully complete because T144 and the usability/native acceptance criteria still have unproven items.

## T147 usability measurement status

No usability study sample or imported measurement package was available in this workspace.

| Criterion | Sample | Result |
|---|---|---|
| SC-001 notification identification | 0 users | BLOCKED: no user measurement; automated tests cannot be converted into a 90% rate. |
| SC-004 preference configuration | 0 users | BLOCKED: no user measurement. |
| SC-005 assistant answer interpretation | 0 users | BLOCKED: no user measurement. |
| SC-008 subscription understanding | 0 users | BLOCKED: no user measurement. |
| SC-010 profile/application change and destructive-action consequence | 0 users | BLOCKED: no user measurement. |
| SC-011 help/support success | 0 users | BLOCKED: no user measurement. |
| SC-013 trust/safety rating | 0 users | BLOCKED: no user measurement. |
