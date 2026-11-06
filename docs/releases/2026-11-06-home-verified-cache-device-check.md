# 121 Redmi cached Home acceptance

The user approved the concrete 121 package. One ordinary in-place install succeeded at 15:47:16 UTC on 6 November, preserving original UID 10321 and first-install time. Installed APK SHA256 is `97fd56eb4d4e40d99d171ee6cab33bd269b5507551569b5f129d87caf74e8e08`, application source `76b68aba08629ebe448bb0254c9b2ac1fd544996`. The frozen review, manifest, runbook and all 80 reviewed source pins still match.

**The requested cached first-visible Home behavior passed in the observed new-process reopening.** The first recorded Home frame already contained the retained -16 SAR balance, account card and saved activity. This does not establish instant application startup, zero jank, a controlled speed percentage or faster model generation.

## What was actually observed

The first post-update launch was COLD with Activity TotalTime 789 ms. Device pre-input sample was 18:47:34.529 local. This first 121 session still had a cache-population phase: reviewed frames showed dashes before -16 SAR at 18:47:42.322. The preceding 120 admission could prevent a snapshot from being saved, so the first real successful read had to populate it. No data was reset or fabricated to force a cached success.

After actual data loaded, only this app's unlocked card was dismissed through ordinary system Recents. Android ended PID 2519; one normal reopening created PID 4183 and reported COLD, Activity TotalTime 579 ms. No force-stop, kill command, global Recents clear, session change or extra cache trial was used.

Pre-reopen device sample: 18:50:29.226. The original adjacent recording frames were inspected, in addition to a sampled contact sheet: frame 439 at 18:50:33.545 still shows the startup cover; frame 440 at 18:50:33.800 shows full Home with -16 SAR and saved activity. No balance-dash Home appears between those adjacent recorded frames. A full-size extraction also confirms the retained activity rows, rather than only a header image. The observed pre-input-to-useful-Home upper sample is about 4.6 seconds, including required startup/SDK/profile/local/layout work. Native Activity time is not whole Home readiness; variable recording frames and observer overhead do not establish an exact SLA.

The source tests separately prove old cached balance/activity while live reads are held, then live replacement without remounting controls. This phone run proves the visible cache outcome with unchanged real values; it does not time a separate Home HTTP replacement. The phone's private lock preference was not read. The source mismatch and changed behavior support the correction without exporting private preference/key bytes.

## Operational reconciliation

The first driver stopped after its successful initial launch because it expected an ASCII space in `-16.00 SAR`; the real native text uses U+00A0. Its retained XML already contained the correct balance. The first launch was not repeated. A resume preparation then reached no phone input because the first bounded observer had already ended. After reconciliation, only the unconsumed ordinary cached-reopening step ran, under its distinct 45-second observer. Both driver failures are retained and are not presented as successful full-driver exits.

The two screen-only/no-audio observations ended naturally with exit 0:

- Initial launch/population, 120 seconds: `dea5ef51627c9fd674e9b5a140734d6406e88d6142ce43ecfe2f4a5aeeb5086c`.
- Cached reopening, 45 seconds: `5b073f970d061e905a6e179e6d64693529ed8bc1835a68eac55d7c8e1e618f61`.

Later, at 18:53:33.809 local, Android ended PID 4183 with exit reason 16, PACKAGE UPDATED, and description `stop com.google.android.webview due to installPackageLI`. This happened after both observations ended. It is a recorded system WebView update, not a reported app crash or an agent reset. One unmeasured normal opening restored Home afterward; fresh registration at 15:57:09.683417 UTC confirmed the original SDK session. This restoration was not counted as another cache/latency trial.

## Preservation and scope

Fresh before/after reads match the entire captured retained-state baseline except expected device last-seen: exact original owner AND SDK/unrevoked device, QA 32 retained transactions/net zero/nondefault, original cash default, both Tracking sources off/server revoked/review mode, 113 keywords and all four old Voice status/update/attempt records. The final primary APK hash, UID and first-install time were checked again after the system event. Home was restored and no recorder, financial fixture or draft cleanup remains pending.

No Assistant question, SMS/Voice fixture, financial action/confirmation/refund, account/default/source change, hosted/SSH change, reset, logout or recovery operation was performed for 121. The unchanged 120 Assistant proof is reused: one completed old-conversation question, editable next draft during pending work, original empty draft restored, and a sampled visible reply around 7.1 seconds with 4.924447 seconds on the server. That response latency is not claimed to have improved.

Private receipts, XML/screenshots, original-frame contact sheets and recordings are retained under `.superpowers/sdd/2026-11-04-production-apk-readiness`; `task29-home-observation-qualified.json` is the aggregate. Fresh source qualification remains 120 cases/eight suites plus types/lint/format 0; earlier source/native/iOS checks overlap and are not additive. The same source is synchronized with the existing iOS chat; iPhone acceptance remains separate. Canonical delivery stays 111 while broader delivery/SMS gates remain open. Whole-production readiness remains false.
