# Startup and Assistant completion wait

Status: source qualified; signed APK and isolated API image preparation in progress. Neither candidate has been activated. Physical latency acceptance remains open.

## Observed problem and evidence

The existing 121 recording remains the baseline: an ordinary cold reopening showed complete cached Home numbers/activity about 4.6 seconds after launch input. Native Activity time (579 ms) is not useful Home readiness. The completed 120 Assistant question took about 7.1 seconds from phone input to visible answer. Its server message interval was 4.924447 seconds; the existing durable provider receipt records one dispatch/attempt, no fallback, 3,417 ms model latency, 8,565 input tokens and 64 output tokens. The prior task30 usage lookup incorrectly joined by message ID; the direct job receipt lookup corrects that diagnosis without replaying the question.

These are individual observations, not controlled percentages or guarantees. Existing recordings and the completed question are reused. No old question, SMS, Voice001 or financial operation was replayed.

## Narrow changes

Five production files change, with three test files. No dependency, schema, route selection, model, financial calculation, identity namespace, encryption key or UI design changes.

1. The root hydration provider now owns the serialized verified live restoration alongside font loading. Previously the live restore could not start until FontGate mounted AppShellProvider. A genuine held-font RED observed zero restore calls. The corrected path starts once, shares its completion with the later provider, and keeps navigation, push registration and foreground synchronization below FontGate. SDK changes/retries cancel stale admission and serialize restorations; privacy, logout, profile, local-owner and startup readiness gates remain in their original controllers.
2. Assistant result reads can opt into a strict 0–8,000 ms server wait. While queued/processing, the existing owner-asserting result function is read at bounded intervals. A completed answer can return in that same HTTP request, avoiding additional mobile pending-response/sleep/request cycles. Deletion/conversation ownership is checked again after waiting. The original result projection and reply correlation remain. A disconnect ends waiting and removes the listener; it never cancels, replays or replaces durable work. Legacy reads remain immediate. The mobile client requests the bounded wait within its existing overall deadline; an older server can still return early and use existing polling/recovery. The model's processing time is not claimed eliminated.

The existing API base image and every unrelated executable file must remain preserved. Exactly the three changed compiled API files will be overlaid; no broad backend rebuild or worker update is required. The unchanged base versions of those three files were compiled and matched the actual serving image hashes. Other historical compiler differences outside those files are retained in the base image.

## Validation and disclosed failures

Final affected mobile selection: 135 cases in five suites, natural exit 0. Final API selection: 27 cases in three suites, natural exit 0. Cases cover font overlap/single restoration, replaced SDK sessions, existing profile/logout controls, result identity, wait bounds, invalid query rejection before private reads, ownership/deletion rejection, legacy immediate reads, HTTP disconnect/listener cleanup and preservation of pending work. This is 162 unique cases in eight suites; earlier overlapping runs are not added.

Genuine REDs: held-font restore did not start; the server returned processing rather than same-request completion; the mobile result request lacked the bounded wait. Scoped lint and formatting pass with zero warnings. Type checks pass. Existing unchanged cache, native and broader financial/Tracking evidence is reused.

One repeat mobile verification process exited 134 with V8 NewSpace allocation failure before producing test results. No assertion result from it is accepted. After the other test process finished, the unchanged final selection passed serially with the same limits. Initial lint reported async fixture and abort/ref warnings; these were corrected and the final checks passed. The baseline compiler harness first ran from the repository directory and could not resolve API type roots; no output/image was emitted. Running it from the API directory matched all three baseline files. A console read-only probe lost newlines and raised SyntaxError; only that read was corrected. No firewall/service mutation occurred in that failed probe. The first computer-use runtimes failed to initialize kernel assets; the available browser tool reached the authenticated existing console instead. No login reset or password/key replacement was used.

## Execution boundary

Primary Redmi remains 121 until actual approval of the finished, artifact-bound package. Preserve the exact original owner AND SDK session, original UID/first installation, all encrypted data and pending work, default/source settings, retained QA rows, keywords and old Voice records. No reset, force-stop, uninstall, logout, new app/account/profile, SMS/Voice/financial fixture or hosted data migration is part of this change.

After concrete approval, activate only the API image override, then update the same primary application in place. Observe one ordinary cached cold reopening and normal Home navigation, and at most one distinct read-only question in the existing conversation after checking its draft/pending state and consent. Preserve the resulting question/reply, restore only a test draft if used, and end Home. Record actual device and server/provider times separately, including any residual delay. Do not promote this narrow proof to overall production readiness or replace canonical delivery 111.

Direct self review was performed; it is not an independent review. Temporary SSH access is limited to the directly verified workstation /32 and must be removed after artifact preparation/execution. Candidate image preparation does not authorize service activation.
