# Staging Voice epochs

These controls prepare the two-capture financial path. They do not approve it. The old `voice-manual-canary` controls describe a different archived scope and must not be used for this test.

The API remains analysis-only, Posting OFF, admission prepared/closed, and the general worker stopped until the human approves an exact packet. Production is excluded. The dedicated entrypoint shares the existing `AiWorker.processVoiceClaim` extraction implementation and ledger finalization with ordinary operation; it starts no broad worker loop.

## Delivery and preparation

After exact-candidate CI and image/APK verification, copy these four runtime files into a new immutable `/opt/masarifi/staging-voice-<full SHA>-<attemptId>` directory. Each preparation uses a fresh UUID attemptId, including rehearsal and the subsequent approval packet for the same source. Retain earlier controls/evidence. Compute `bundleHash()` from `host.cjs` and record it as the packet's `controlHash`. Freeze the packet described by `validatePacket`: source/image/APK hashes, owner/Cash/Food, Samsung serial, correlated verified Clerk session hash, environment file hashes, fresh financial baseline hash/time and exact UTC start/deadline. Do not create `approval.json` during preparation.

The host publishes only packet, epoch and approved control records to UID/GID 65532 with file mode 0400 and directory mode 0710. Controls remain read-only inside the application container. Do not use root-only 0600 files inside that mount: the nonroot database controls must read the same immutable records to inspect and close admission.

Obtain the Clerk session hash by correlating a nonposting Samsung recovery request ID with `VoiceAdmissionDiagnostics` in the API logs. Do not log/export authentication tokens or raw Clerk session IDs. Membership binds each actual Voice session to owner, locale, capture time and audio content hash in SQL. The canary accepts English then Arabic and validates one exact 25 SAR Cash/Food expense on the Riyadh capture date before ledger execution. A different or ambiguous command closes admission.

`host.cjs prepare` installs a disabled epoch and writes its durable identity once. `host.cjs rehearse` performs OFF-only API stop, scoped/general worker stop, epoch closure, analysis restore, liveness/readiness checks. Run only when no human capture is active. Rehearsal closes that epoch permanently; retain `epoch.json` as evidence and use a new immutable directory/packet/epoch for the actual proposed window. Never rewrite its deadline or reactivate it.

Actual `enable` requires a human approval record bound to the exact packet hash and window. It arms an independent persistent deadline service before financial activation, stops the analysis worker, switches the API, activates the epoch, starts the dedicated runtime and a persistent supervisor. There is no operator finalize command. SQL closes Posting on the second successful commit; the supervisor also closes on failure/deadline/lost heartbeat and restores healthy analysis. Cleanup retries on failure and leaves the API stopped if OFF cannot be confirmed. Canary media/commands are retained; ordinary scoped retention uses the existing rules.

## Evidence and acceptance

For each capture retain its source/owner/session/locale/time/hash, committed transaction/event IDs, normal Home card and Transactions row, authoritative Cash/net-worth/live-report values and recovery identity. Confirm two intended transactions, two postings, 50 SAR expense total and zero unrelated effects. A read-only committed-event replay may be approved at most once per event; it must reuse the event, never create another capture or command. No Manual Save is included.

Automated disposable-database tests are not Samsung acceptance. Report the two captures, original Manual acceptance and ordinary Voice readiness separately.

## Manual follow-up

First inspect the preserved original draft, owner reference data, journal operation and receipt read-only. `MANUAL_DIAG` and `ManualFinanceDiagnostics` correlate preparation/request/HTTP-domain-response boundaries using hashed operation IDs and request IDs, without business contents. An absent receipt does not prove dispatch never occurred. If a new attempt is necessary, prepare a separately isolated draft using the same form, pickers, validation and service, copy business fields only and allocate no replacement for an unknown operation. Prove original-draft/journal preservation before proposing one exact transaction and expected postings/balances for separate approval. Voice stays OFF. Reproduce the evidenced cause in a failing regression before repair; the three client fixes do not explain the historical banner.

## Ordinary operation (prepared, not approved)

Use a new `operating` epoch for all eligible authenticated Staging testers with existing profile/account authorization. Only sessions admitted after activation belong to it. Start `compose.voice-epoch.yml`'s explicit `voice-financial` profile with the matching SHA/digest/epoch, financial API mode, provider enabled and unchanged reviewed routes/model/prompts/safety. Keep analysis and general workers stopped. Initial extraction concurrency/claim limit is one, polling 500 ms, renewable lease 120 seconds; these settings do not change financial limits.

SQL heartbeat exposes pending count, oldest pending time and failures. Container readiness requires a fresh source/epoch heartbeat and open admission. Monitor these together with API readiness and receipts. Stop by closing the epoch/Posting first, stopping the dedicated service, restoring analysis-only API/worker and verifying health; retain pending journals and evidence. Never reopen a closed epoch or drain historical work. A separate named-participant, bounded multi-owner financial trial and operating approval are required; this canary's host enablement intentionally accepts only the two-capture packet. Continuous operation remains unapproved even after a successful canary.
