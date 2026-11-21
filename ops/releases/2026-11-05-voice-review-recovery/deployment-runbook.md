# Same-app Voice review recovery

Prepared for review; NOT activated. This adds one environment override to the existing API. It uses the existing analysis worker and the installed customer107. No APK, image, database, identity, policy, worker, DNS or TLS change is proposed.

## Diagnosis and qualified inputs

Two actual five-second customer recordings were finalized on 2026-11-05 but remained unclaimed until cancellation. Both used contract2 without a voice_batch_context row. The live API has MASARIFI_VOICE_ANALYSIS_ONLY=false; its existing V2 admission therefore calls createVoiceSession instead of createVoiceReviewSession. The existing analysis worker has the flag true and only claims analysis context. Its current polling interval is500ms, batch/concurrency1. The current manual-review app must keep EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING=false.

The proposed override was merged with the actual hosted Compose configuration, in memory. The only changed environment key was MASARIFI_VOICE_ANALYSIS_ONLY (false to true); every other resolved Compose input was identical. The actual pinned image validated the candidate environment in an ephemeral, read-only, network-none process. No serving service was changed. The existing provider flag/key are already configured; no key is added or printed. Existing database analysis policy is enabled for authenticated active customers. There were no created/uploaded/processing/proposal_ready Voice sessions at the read-only preflight.

- Image: masarifi-readiness-production@sha256:a9060b3e761495bf8cf0ccbfa769232a0bb3e83edd2ea84c27e435350b812afc.
- Existing Compose: /var/tmp/masarifi-production-artifacts-20261105-97e66588/proposal/compose.production.yml; SHA256 e7a340f43f38652838893ad14234127ba4145fbd5faf9b9472aeab7e86c0d1e5.
- Existing API env: /var/tmp/masarifi-production-artifacts-20261105-97e66588/config/api.env; SHA256 d107135be36fd10e90ab220347b7e548a0e4e88c2b0ecfca2752800ee0fe9389; mode0600. Leave the file byte-identical.
- Same Compose project: masarifi-production-20261105; target core-api only, container masarifi-production-core-api-20261105-97e66588.
- Retain all30 other currently running containers, including all27 original services and the import worker. Metadata SHA256 27600b0eb5c6b6a3082cd2334811cfcb0032b4f9ed371cb25be23e39827591fc covers sorted id/name/image/startedAt, excluding only the target API. Stop on drift; do not rewrite the baseline to hide it.

## Review gate

The user's original instruction requires a concrete package before approval to execute on hosted services. The previous approved package pinned analysis_only=false. Obtain approval for this exact one-key API correction before activation. Do not request another primary install: customer107 is unchanged. Expected impact is a short API restart; the existing app session, database, pending operations and old recordings remain preserved.

## Bounded activation after approval

1. Reconcile the task13 receipts. Refresh the same-app/session and read-only queue baseline; preserve Voice001 and both cancelled recordings. Do not reopen old sessions, change claims, replay recordings or purge media.
2. Stage only this override and its manifest beneath /var/tmp/masarifi-production-artifacts-20261105-97e66588/voice-review-recovery, using0700 directory/0600 files. Verify their reviewed hashes plus the base Compose/env hashes above. No new SSH access is needed while the authenticated Hostinger Web Terminal remains available.
3. Resolve base and base-plus-override Compose to JSON in memory, never to public output or a plaintext file. Assert the resolved environment differs by exactly MASARIFI_VOICE_ANALYSIS_ONLY, false to true, and all other resolved inputs are identical. Verify actual target image, current false flag, API readiness, and retained-container metadata digest.
4. Write a unique private dispatch receipt containing metadata only before the mutation. From the existing proposal directory, run exactly:

   docker compose --project-name masarifi-production-20261105 --file /var/tmp/masarifi-production-artifacts-20261105-97e66588/proposal/compose.production.yml --file /var/tmp/masarifi-production-artifacts-20261105-97e66588/voice-review-recovery/compose.voice-review.yml up --detach --no-deps core-api

   Do not run down, pull, build, broad up or a migration. Retain the terminal exit/result. On interruption inspect the receipt and actual container before deciding the next action; never blindly repeat the dispatch.
5. Verify loopback3080 and public /health/live and /health/ready return200, with the same source/image and analysis_only=true. Compare the complete target environment in memory: all previous values must be equal except this flag. Assert all30 retained container IDs/images/startedAt are unchanged. Confirm the existing worker is still analysis-only, poll500ms, provider configured, without changing or restarting it.
6. On the same primary107/session, request ONE distinct new user recording, stop through the normal UI, and measure stop-to-upload-finalized, finalize-to-claim, provider/result and visible-review times separately. A newly created contract2 session must have owner-matching analysis context and be claimed. Do not claim a speed improvement until the actual UI result appears. Do not repeat Voice001 or either cancelled recording. Do not confirm a financial entry without explicit user intent for its concrete contents/account; inspect the review first. Preserve the SDK owner/session fences and all original work.
7. Record English evidence and update the handoff. Keep the unchanged APK delivery/hash. Commit only the scoped package/report/handoff on the requested branch and push to ratibi after proof; leave inherited performance/iOS/private changes untouched.

## Scoped rollback

If the API is not ready or the override causes a regression, retain the failure receipt and restore the unchanged base configuration using the same command with only the base --file argument and the same core-api target. This restores the old false flag using the same image; it does not restore a database or discard any newly created session. Verify both health endpoints and all30 retained identities again. Diagnose any new pending session through the normal owner-bound recovery path; never delete/reclaim/replay it to make rollback look clean. Do not automatically roll back a healthy API solely because a provider request takes time.

## Validation reuse and limits

Backend/image inputs under apps/api, supabase, package-lock.json and docker/backend.Dockerfile are unchanged from97e66588 to current fbbf7a31. Prior passing Voice review admission, continuous admission, analysis worker/bootstrap, analysis-only, explicit-review and environment schema suites remain applicable; no full rerun or image/APK build is needed for this override. The historical task3-api-full-qualified-target run has two unrelated failed suites: its selected passing Voice suites are reused individually, not represented as a successful whole run. The fresh hosted image/config validation is green. Actual voice/provider recognition and response time remain unverified until the new same-app recording succeeds. Production readiness is not established.
