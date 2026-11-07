# Tracking navigation and new SMS — existing111 device recheck

Recheck completed; fixture cleanup is complete. **Residual speed issues remain open.** This report establishes actual behavior on111 and does not claim a performance fix.

## Scope

The user requested another check of the remaining delay, new SMS, and navigation into and out of Tracking. This is a targeted check on the existing primary Redmi installation, version 111. No APK build, install, service deployment, data reset, logout, new account or new profile has been performed. The separate approved Tracking copy remains local source only.

## Navigation evidence

- Two ordinary entries from More to Tracking and one intervening Back operation succeeded through guarded USB input. Both entries showed the existing 113 keywords. Both source switches initially remained off.
- The screen-only, timestamped 60-second recording completed normally. Private artifact: `W/task19-navigation.private.mp4`, SHA-256 `515c96da34b3928ddf0aa9764146c260350e7f6ffe6659158e8811f819dbadb9`.
- The native frame counters increased by 156 rendered frames and 14 janky frames across the observation interval. Of the 120 newly retained frame rows, four exceeded 100 ms; the maximum was 480.010857 ms. The two largest samples spent substantial time in animation/mounting and drawing, rather than GPU completion.
- This confirms residual rendering jank during the observed navigation exercise. It does not establish a permanent freeze, input-to-first-frame latency, a network bottleneck, the exact responsible component or an improvement. Screen recording and the USB inspection add overhead, and the counters cover the entire observation interval.
- Rendering all keyword chips at mount is one candidate. Status refresh and work triggered by More focus have not been ruled out. No speculative production performance change has been made.

Receipts: `W/task19-navigation-qualified.json`, `W/task19-nav-{open-a,back-a,open-b}-exit.json`, native frame files and extracted private video frames. `W` is `.superpowers/sdd/2026-11-04-production-apk-readiness` in this repository.

## New SMS check — received and qualified

Before arming, a metadata-only SMS-provider query found no SMS newer than the prior qualified 3.07 SAR fixture. The owner's latest import remained that completed, first-attempt, one-item SMS session; no new SMS result is claimed.

For the requested fresh check, the existing QA account was made temporarily default using six guarded UI steps, all completed once. The server confirmed QA26 retained transactions/net0, original owner and SDK session, preserved old Voice metadata and 113 keywords. SMS was then enabled normally; server authority, automatic mode and SMS-only capture were confirmed. Notification capture remains off.

The single requested ordinary carrier SMS is:

```text
Paid 3.19 SAR at RELEASEQA111B Ref QA111SMSB20261106
```

The user confirmed sending it. Provider SMS378 was received at `2026-11-05T22:47:17.605Z`. One import session `c5da18c2-91f2-4f0a-b802-57dc7c16d4d4` completed on its first attempt without error. One accepted item, expense `e94a5bf0-9e6d-4341-92bf-8c60899ee45f`, QA posting of -319 minor SAR, accepted history entry and confirmation event were qualified. Home showed the resulting -19.19 SAR balance and new expense row.

| Boundary from provider receipt | Actual interval |
| ------------------------------ | --------------: |
| Import session created         |      5.741993 s |
| Financial transaction created  |      6.306839 s |
| Import completed               |      6.540496 s |
| Native confirmation created    |         7.278 s |

The server-side interval from session creation to completion was 0.798503 s. Most of the observed delay preceded creation of the import session; this alone does not distinguish application preparation, scheduling, token acquisition or network time. Native confirmation `c7f44cda-7364-4778-bb49-014d01a62c6f` was matched to the actual transaction, package, 3.19 SAR content and saved-notification channel. No speed gain is claimed from comparison with the prior single fixture.

Receipts: `W/task19-real-sms-{ledger-observed,notice-observed,timing-qualified}.json`, `W/task19-new-sms-provider.private.json`, private native notice and actual Home screenshot. The metadata observer completed with exit0; no message or recording request remains pending. Do not resend or replay this fixture.

## Completed cleanup

Exactly one confirmed refund `598834d0-68b9-4106-8867-b43176899ebc`, created `2026-11-05T22:56:07.477082Z`, reverses only the new expense, with one +319 QA posting. QA now has **28 retained transactions, net0, nondefault**. The original cash account is default again; actual Home returned to **-16.00 SAR**. Both tracking sources are off, server authority revoked and review mode restored. The exact original owner/SDK session, 113 keywords and old Voice status/update/attempt metadata match the baseline. The six restore steps completed once, exit0. `W/task19-final-restoration-qualified.private.json` is authoritative; never repeat these refunds or restore steps.

Redmi and delivery remain111; no new APK, source performance change, deployment, commit or push was made for this recheck. No full/native suite or closed Benchmark was rerun. The prior focused source-copy checks remain separate from this physical111 evidence.

## Harness limitations

The first state capture saved its private XML/image/result successfully but exited on a Windows console encoding error; output encoding was corrected without repeating that stage. The first metadata query returned command usage because of shell argument quoting; its output was rejected as data. The corrected metadata-only query succeeded. Neither issue is evidence of an application error.

One refund-row swipe overshot the new row; two exact-target guards stopped before dispatch, and a controlled reverse swipe revealed the correct expense. Two synthetic-key amount-entry attempts stopped before Save on mismatched unsaved values. The visible Gboard numeric keys then produced and verified each prefix through 3.19. Exact amount/account/description were checked again before the single Save, with no prior reversal present. No incorrect or duplicate financial save occurred.
