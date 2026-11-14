# Home cache and Personal Assistant response correction

The user still observed dashes and a hitch on first Home entry after the physically tested 119. This correction restores the last valid Home balance and activity from the existing encrypted owner database, then refreshes them in the background. It also keeps the next Assistant draft editable while a reply is pending and reduces repeated synchronous conversation formatting.

The signed 120 artifact is qualified for review. **119 remains installed; actual Home and Assistant acceptance of 120 is open.**

## Causes and resulting behavior

- Ordinary query invalidation deleted persisted Home snapshots. Invalidation overtaking asynchronous hydration also caused saved balance and activity to be skipped. The correction preserves these two display families during ordinary refresh, with their original timestamps and live fetch intact. Authoritative denials still clear and evict reads; owner and privacy withdrawal still reject late hydration.
- The existing 64-row encrypted read cache could evict Home before other ordinary reads. Home balance and then recent Home activity now receive retention priority below existing denial markers, within the same row and byte bounds. No schema, account, ledger or credential changes.
- The cache provider rejected an explicitly disabled privacy lock even for an already verified, unexpired SDK session. This exact case is now admitted. An expired or local-only session with disabled lock, missing lock setting, active lock or logout fence remains denied. The phone's private lock setting was not read; this source defect is not a measured attribution of every startup second.
- First Home previously released at positive layout before the local cache attempt completed. Its initial cover now also accounts for completion of that local attempt. Empty or failed local loads release the existing controls without waiting for network success. Background refresh does not re-cover an already visible Home. Unknown data is never replaced with an invented zero or activity.
- The Assistant composer made the native input noneditable throughout response waiting. It now accepts next-draft edits while the existing send guard prevents duplicate or overlapping dispatch. Revision checks preserve text edited before acknowledgement.
- Changing only the pending indicator repeated native per-message date formatter allocation. One locale/device-clock formatter and memoized chronological turn data reduce that work. Actual response publication, polling, operation correlation, consent, errors and explicit financial-action confirmation remain unchanged.

## Verification and limits

Final affected qualification: **381 cases in 25 suites passed in one selected command**, with zero failed or skipped cases and natural exit 0. Types, scoped lint and format checks exited 0; no changed-file lint warning remains. Seven production files and seven tests changed. Review was direct self review, not independent.

Behavioral REDs cover both Home hydration/invalidation races, retention across reopening and actual SQLite eviction, verified-session admission with the lock explicitly disabled, first visible cached Home data, next-draft editing and repeated clock work. Actual Home component coverage shows saved negative balance and activity before held live reads, then live replacement without remounting account or Voice controls. Identity, privacy, denial, draft, journal and Assistant contract checks are included.

Intermediate failures are preserved. The first clock test used an unsuitable provider rerender and failed on an unmounted node; the corrected same-tree journey produced the genuine formatter RED (2 allocations becoming 4). The first Home-runtime test could not spy on the live service proxy; its local-service boundary was repaired before observing the genuine first-paint RED. The expanded affected run had 380 passes and one older journey expectation that deliberately required locked editing; the expectation now requires editable input with send still disabled. One new hook-dependency lint warning and one formatting check were corrected. Query cleanup timers delayed natural process exit after assertions; no forced exit, timeout increase or suppressed failure was used.

Unchanged 119 native, configuration, Tracking and broader proof is reused where inputs did not change. The narrow correction does not establish whole-production readiness or zero jank.

Read-only historical Assistant metadata showed five completed, one-attempt replies taking 2.916 to 6.022 seconds, active consent and no pending request. No message content or operation was replayed. These are historical server durations, not current phone latency. No new Assistant question, financial action, SMS/Voice fixture, default/source change, hosted change, reset or logout has been performed for this correction.

## Signed 120 candidate

ONE 120 build completed with exit 0 at 2026-11-06T15:04:58.057194+00:00, source `5edca96223264bcf1063d09cf8b61e150833a7e5`. APK: `C:\mrc1105\artifacts\task28-customer-120-native.apk`, 49,514,554 bytes. SHA256: `05a22b466eb58fe1218a0b36ddb98e2294d102d8e4fdab969cb35b50837f8b6d`. Hermes SHA256: `870693bb1420b6894eeb8678019f2818eb484fc228ee0458cafc7616f5f4004e`.

All 2,974 prior-119 build-tree pins matched before the 14-file overlay; all 2,975 final pins matched. 119 was preserved without rebuilding. The existing Production signer, Arabic/package identity, version 1.0.0, minimum API 24, arm64 architecture, API/Clerk bindings and automatic Voice policy remain. Signatures for APIs 24, 28, 32, 33, 35 and 36, 16 KB alignment, Record reflection and the actual DEX notification consumer/constructor pass. All 23 native libraries are byte-identical to 119. The 116 existing Kotlin metadata advisories are unchanged and recorded; they are not phone-performance evidence.

The [manifest](../../ops/releases/2026-11-06-home-cache-assistant-response/manifest.json) binds 80 changed/retained source files and the [execution/recovery runbook](../../ops/releases/2026-11-06-home-cache-assistant-response/deployment-runbook.md). Final manifest SHA256: `6d503e64f4faa3d700d9cee46e050e5a0834d896ef4d3a803f1eeeeaed7e3c70`.

Strict complete-package scan: one raw finding, classified as the retained public Clerk client configuration; zero unexpected secrets. EAS bytes, scanner, ignore rules, keys and identity remain unchanged. Owned source, staged changes and new history scans have zero findings.

## Remaining physical check

The user's original complete-package review condition requires actual approval of this concrete 120 package before updating the primary app. The same phone, data, exact owner and SDK session must be preserved. Follow the runbook for first Home cache/background refresh, ordinary navigation and at most one read-only question in an existing Assistant conversation. Preserve drafts, pending operation IDs, consent and real reply history; never confirm a financial action.

A missing 119 Home cache must first be populated truthfully by a successful 120 read. Do not claim a pre-existing cache, clear data, force-stop the process or repeat cold-launch trials to obtain an apparently faster result. Record residual latency and observer limits. Canonical 111 delivery and the separate broader SMS/delivery gates remain unchanged. Keep the final review, manifest and runbook frozen after approval; record execution separately.

Before any approval, this report's English wording and encoding were corrected. The signed APK, manifest, runbook, source and all test/build evidence are unchanged; private final qualification retains both report versions and their hashes.
