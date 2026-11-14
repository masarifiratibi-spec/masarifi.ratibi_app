# 120 Redmi Home cache and Assistant check

The user approved the concrete 120 package. One ordinary in-place update succeeded on 6 November at 15:10:03 UTC. The installed APK matches `05a22b466eb58fe1218a0b36ddb98e2294d102d8e4fdab969cb35b50837f8b6d`, application source `5edca96223264bcf1063d09cf8b61e150833a7e5`. Original UID, first-install time, exact owner and SDK session were preserved. The reviewed report, manifest, runbook and all 80 source pins remain unchanged.

**Cold Home cache acceptance failed.** The actual phone still shows dashes before balance after a real process reopening. Warm return retains the balance. Assistant native editing during a pending question is physically proved, but an end-to-end response-speed improvement is not established. Continue the narrow Home-cache diagnosis; do not repeat the consumed 120 build/install/question or cold trials.

## Home observation

The first normal launch after update was COLD. Android Activity TotalTime was 872 ms, which is not useful Home readiness. Device pre-input sample: 18:10:50.146 local. Reviewed frames show Home controls with dashes at 18:10:56.080 and actual retained -16 SAR at 18:10:57.900. The first 120 run may have lacked a valid older snapshot, so this alone did not resolve whether the new persistence path worked.

More and Back returned to Home with -16 SAR already visible. The reviewed return frame was 18:11:48.043, after the pre-input sample 18:11:47.715. Reports and Back also returned to the retained Home. The first More helper captured UIAutomator immediately after input; later helpers used a quiet interval. These observations are not a controlled latency comparison or zero-jank proof.

After real data had loaded, the approved runbook's single ordinary reopening check was necessary. Only this app's unlocked card was dismissed from system Recents; no global clear, force-stop, kill command or data/reset action was used. Android ended PID 25304 naturally; one normal launch created PID 29692 and reported COLD, Activity TotalTime 690 ms. Other cards/apps were preserved.

For this cached reopening, device pre-input sample was 18:23:24.776. Home still showed dashes at 18:23:29.215; -16 SAR appeared in the reviewed 18:23:31.748 frame. This is a real failure of the requested first-visible cached-number behavior, not a passed cache acceptance. The cause remains under investigation. In source, a native lock preference can legitimately be null when neither a setting nor legacy credential exists; protected Home already admits a verified, unexpired SDK session in that state, while the cache provider rejects it. This is a concrete policy mismatch and a phone-state hypothesis; the private phone preference itself was not read and must not be asserted as known.

## Assistant observation

Existing consent was active, no server request was pending, and the existing conversation's composer was empty. A hostname-style nested link initially returned to the Assistant landing because the custom link controller maps that hostname to the root. A normal path-style link opened the existing protected conversation. No new conversation or consent change was made and neither navigation attempt sent a question.

Exactly one read-only question, "What is my total spending this month?", was submitted to the existing conversation. Its optimistic user bubble and pending status appeared. A temporary unsent draft was typed with normal native keyboard events while the request was pending, remained editable and survived acknowledgement/reply. Only that exact test draft was removed afterward, restoring the original empty composer; the actual user question and real answer remain in normal history.

Server correlation confirms one new user turn, one completed attempt, one owner-matched reply and no remaining pending request. The response was 26 SAR. Request persistence was at 15:17:33.046914 UTC; reply creation at 15:17:37.971361 UTC, a server duration of 4.924447 seconds.

Device pre-send sample was 18:17:31.402; reviewed frames show the new user bubble at 18:17:31.658, a retained next draft while pending at 18:17:32.761, pending through 18:17:38.239, and the actual reply at 18:17:38.529. The sampled send-to-visible-reply interval is approximately 7.1 seconds, including client/network/server/render work. Clocks, variable recorder frames and sampling are not an exact SLA; no earlier matched phone baseline proves a speed improvement. Model/provider waiting remains distinct from the now-responsive native input.

## Preservation and evidence

After the new process launch, fresh authenticated device registration at 15:23:30.660854 UTC confirmed the original SDK session. The entire captured retained-state baseline matched before/after except expected device last-seen: QA 32 retained transactions/net zero/nondefault, original cash default, both Tracking sources off with revoked authority/review mode, 113 keywords and all four old Voice status/update/attempt records. No financial action/confirmation/refund, SMS/Voice fixture, default/source write, hosted/SSH change, reset, logout or recovery operation was performed.

Private terminal evidence is under `.superpowers/sdd/2026-11-04-production-apk-readiness`: `task28-home-assistant-observation-qualified.json`, approval/update receipts, owned-state snapshots, one-question correlation and draft-restoration receipts, screenshots/XML and reviewed contact sheets. Three distinct screen-only observers ended naturally with exit 0:

- Initial Home/navigation, 180 seconds: `2457ecc387ba73705be4a26fd56a11051e389d11f2864cd7ee5cd56611617e97`.
- One Assistant question/editing check, 90 seconds: `17e9386823e84272443063b287cf9ee0c768595b82f61d1b9731950a87b7c4f1`.
- One post-population ordinary cached reopening, 45 seconds: `98558cff08bcabc12b2f8291143e09ac33b483684c9c6ae8684ddfc79a0f351c`.

There is no active recorder or financial cleanup. The phone ends on Home. One metadata-print helper failed on console encoding before any phone input; all input receipts remain retained. Canonical delivery remains 111. The iOS chat separately reviewed the same source and passed 125 overlapping cases in 11 suites; these are not additive to 381/25, and neither iPhone acceptance nor current IPA parity is established. Production readiness remains false.
