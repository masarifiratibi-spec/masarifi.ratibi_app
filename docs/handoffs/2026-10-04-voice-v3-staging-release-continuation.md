# Voice v3 remaining Staging gates — 2026-10-04

Continuation base: frozen `deb6611e3102c8222908389547a34c5bd1e6b35b`. Ten-event compact Gemini/Vertex extraction, canonical validation, accounting, privacy, budgets, ledger execution and v2 compatibility remain accepted and unchanged. Production and final integration remain outside this continuation. The explicit financial-canary approval boundary in the acceptance protocol remains in force.

## Hosted preparation completed

The frozen `deb6611` API image `sha256:3bdb3ef1fed8e072c0252bd9c541dca4d122580041ff9b94871a29e0dffaba51` was deployed to isolated Staging. Its immutable migration runner applied `20261003145030_voice_automatic_batches` and `20261004093000_voice_ten_event_capacity`, then ran again successfully without new history. Hosted SQL checksums match the frozen Git blobs. Policy `enabled=false`; no batch, event command, financial transaction, posting or revision was created. Runtime environment files and the accepted Admin configuration were unchanged.

Security advisors report five informational `rls_enabled_no_policy` entries for the new private tables. This is intentional default-deny protection: no customer/API/Worker DML grants, fixed-search-path restricted capability functions, and zero PUBLIC-executable application SECURITY DEFINER functions. Do not add permissive policies merely to suppress the informational notices.

## New real acceptance defect: PGMQ publication

Hosted PGMQ 1.5.1 exposes delay, timestamp and JSON-header overloads of `send`. Existing `pgmq.send($1,$2::jsonb,$3)` leaves the delay untyped; read-only EXPLAIN reproduced PostgreSQL `42725` (ambiguous function). The application masks this as `QUEUE_PUBLISH_FAILED`. The historical Staging outbox has roughly 497,000 unpublished operational and legacy events; the delivery queue itself was empty. This predates Voice v3.

The minimal fix casts queue name to text and delay to integer. A rollback-only real PostgreSQL integration regression retains both headers and delay overloads and verifies one queued event under the restricted Worker role. No financial primitive, grant, retry policy or provider contract changes. The normal Worker was paused during preparation; deployment of the corrected candidate and bounded delivery verification require fresh exact-SHA CI. Retain historical evidence and unknown-cost holds; do not purge the backlog or report all queues empty. This repository does not implement a PGMQ financial consumer.

## Mobile and browser gates

The installed Samsung APK digest `f6d3fcdb050f07914c536003830ee89c9f90ba9d96d03cad607eeecfbf4ee9a8` matches the earlier `5113fb7` onboarding release and lacks v3. A compatible internal build is required; update in place with matching signing identity and preserve application data. Never uninstall or clear data to circumvent a signing mismatch.

The native-link mitigation and corrected reachability assessment are documented in the dependency exposure handoff. Packages remain unchanged; inbound installed Router uses URLSearchParams, and malformed raw/nested links now fail before further navigation decoding. The bounded diagnostic is included in CI. Existing Clerk/WebBrowser callback ownership and valid Arabic links are preserved.

Existing recorder timing samples were only stored in JS memory, unavailable for release-device acceptance. An explicitly instrumented preview build now emits only `VOICE_TIMING`, a fixed stage name and a rounded duration when both the opt-in flag and the exact Staging API URL match. Production/default builds do not emit it. Samples remain bounded; no audio, account, owner, capture identity or financial content is exported. A failing opt-in regression preceded the implementation; recorder/runtime lifecycle regressions passed. This adds observability without changing recorder sequencing or delays.

Sixteen independent Phase 9 browser route checks no longer share one 90-second deadline. The assertions, viewports, timeouts and retries remain unchanged. Local unchanged trace demonstrated one 22.49-second cold navigation amid otherwise normal locale assertions; changed route cases and neighboring checks passed without retries. Exact historical blank-page cause remains unproven. CI now preserves failure artifacts, including failures that later pass retry.

## Outstanding physical and financial boundaries

Human Samsung Arabic/English accuracy, actual Ready timing, repeated captures, live onboarding/link behavior and first financial auto-posting acceptance are not certified by offline tests or synthetic capacity probes. Posting stays disabled during non-financial preparation. Verify fixtures, fresh authentication, quotas, accounting, idempotency and safe queue state immediately before any separately approved financial canary. Use the exact acceptance protocol; no broad gate enablement, retroactive legacy confirmation or Production change.

The final consolidated external evidence will record the resulting exact SHA/image/APK, actual hosted checks and physical timings. This handoff does not claim those pending gates passed.
