# 122 Redmi startup and Assistant result-wait execution

The user approved the concrete API/122 package. The API image was activated at 17:12:34 UTC on 6 November, and one ordinary in-place application update completed at 17:13:25 UTC. Original UID 10321, first-install time, exact owner AND SDK session were preserved. No reinstall, reset, logout, financial action, SMS/Voice fixture or account/source/default change was used.

**The latency objective remains open.** The planned cached cold reopening showed useful numeric Home in approximately 3.95 seconds, compared with the earlier 121 sample of 4.574 seconds. The new read-only Assistant question still required about 7.1 seconds to show useful answer text. These are individual observed samples, not controlled percentages or an SLA.

## Exact execution

Application source: `ab154ebc6436850f32c36bbd890533f15678bc6e`. Installed APK SHA256: `3fee0911d1e8ac3b055901773e95e34357a91e21062052d67278882f209a495d`, versionCode 122. Reviewed manifest SHA256: `0d393602e1b1f9b3687690649f2800ad005b5a50d26601dbb469f675c53a24de`. The review report, manifest, runbook and reviewed source pins remain frozen and unchanged.

Serving API image digest: `sha256:e3ddc1351fe3649b027e4dd726c125600f1c237bb449d85e764b975561b330b3`. Image build commit: `d1bff2c2921a49ee2b0221ba8ce0c520fd0158d4`; the three API source inputs are identical at the application source commit. Exactly the reviewed API container was recreated. The other 30 serving containers retained their IDs, images and start times. Runtime configuration and environment were preserved; no schema, model, worker, DNS or TLS change occurred. Loopback liveness/readiness, public TLS liveness and unauthenticated Assistant rejection passed. No rollback was needed.

## Actual Home observation

The first post-update cold launch reported native Activity time 1011 ms. Its first useful numeric Home sample was about six seconds after pre-input. This slower first-after-update sample is retained; it is not replaced by the subsequent cached reopening measurement. Later manual phone use interfered with the first driver's navigation; that driver exited 1 and is not reported as a successful complete flow.

After the user explicitly made the phone available without manual input, an unmeasured warm restoration prepared this app's own Home card. The one planned ordinary dismissal of that unlocked card through Recents naturally ended its process. The one normal cached reopening reported COLD and native Activity time 644 ms. No force-stop, kill, global Recents clear or extra cold trial was performed.

Pre-reopen device time was 20:23:51.608282 local. Adjacent original recording frames show startup cover at 20:23:55.332 and full numeric Home, retained account card and saved activity at 20:23:55.554. The useful-Home upper sample is 3.945718 seconds; the transition lies between approximately 3.724 and 3.946 seconds. No dash Home appears between those adjacent recorded frames. Native Activity time does not represent whole Home readiness.

The cached driver then stopped before dispatching its More tap: its Android 35 `dumpsys window windows` guard expected a field unavailable in that output. Full window/activity state confirmed this app remained foreground. This was a harness guard failure, distinct from the earlier manual interference. Only the unconsumed More/back navigation was continued under a separate observer and completed. Driver sleeps and UI dumps are not navigation latency measurements. The cold reopening was not repeated.

## Actual Assistant observation

The existing conversation was opened through its normal protected route after consent, empty-draft and no-pending-work checks. One distinct read-only question was sent once. Its completed answer and question were retained, the original empty draft remained empty, and no financial confirmation was invoked. One job attempt completed; two model dispatches are two processing rounds within that question, not a duplicate submission.

Pre-send device time was 20:26:46.736027 local. Original frames at 20:26:53.836 still show the new answer below the readable area; readable answer text appears during the following frames around 20:26:53.870. The observed response therefore remains about 7.1 seconds. Server creation-to-response time was 5.884616 seconds. Provider receipts show two rounds of 2757 ms and 1794 ms, with no fallback. Prompt inputs were 8597 and 10314 tokens respectively. These receipts locate most waiting inside agent/provider processing, rather than establish a client rendering fix.

Server access evidence confirms one authenticated result GET with `waitMs=8000`, returning 200; no additional result poll was required. The bounded result-wait change is active, but the additional model/data-selection round masks an end-to-end gain. Further work must address preparation of authoritative data before answering, preserving owner, lease, scope, consent and numeric grounding. No new worker image has been activated or approved by this execution.

## Preservation, failures and closure

Fresh final before/after comparison matched the captured retained state except expected device last-seen: exact original owner AND SDK/unrevoked device, existing QA account's 32 transactions/net zero/nondefault status, original cash default, both Tracking sources off/server revoked/review mode, 113 keywords and all four retained Voice status/update/attempt records. The final installed APK, UID and first-install time were checked. The phone ends on Home. No observer, financial fixture or draft cleanup remains pending.

All three screen-only/no-audio observers ended naturally with exit 0:

- Initial Home/manual-interference observer, 120 seconds, 71,897,305 bytes: SHA256 `a3cdad2a1a030bf86e3fa873331b94b1d425e908fc3ed69a9c2199c56bfddcd4`.
- Planned cached reopening, 120 seconds, 11,337,049 bytes: SHA256 `aa16dc01ddeb54d4361d6ed3b1c51ed6d48a44e0e52cb31ec8503fece4882146`.
- Remaining navigation and one question, 90 seconds, 5,133,585 bytes: SHA256 `7c1cea79025d1302e7459163a6f2c3610c2acdfd0bc2737442fe84e1357ef7b6`.

Private recordings may contain incidental unrelated application content and are not public artifacts. Original recordings, XML, transition frames and operational receipts remain under `.superpowers/sdd/2026-11-04-production-apk-readiness`.

One final read-only server collector stopped when a legacy worker lacked the requested agent path. No service or phone action resulted. A bounded corrected collector completed the outstanding read and cleanup: only the task-specific SSH rule was removed, all four UFW files/metadata and firewall status matched their originals, and the task root-console tab was closed. The new API and all other 30 containers remained as qualified. No old collector, build, install, question or cold trial was replayed.

Source qualification is reused unchanged: 55 startup/auth/route cases, 81 Assistant cases and 27 API cases, 163 unique cases across eight suites; natural exit 0 and scoped type/lint/format checks. Independent iOS review closed the SDK-cycle finding; its overlapping counts are not added. This is physical Android proof only, not iPhone acceptance. Canonical delivery stays 111 while broader delivery/SMS gates remain open. Production readiness and overall startup/Assistant latency acceptance remain false.
