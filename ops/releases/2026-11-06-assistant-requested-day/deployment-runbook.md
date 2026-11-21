# Existing Assistant worker replacement and rollback

Status: prepared, not executed. Actual artifact-bound user approval is required by the user's original review condition. Approval of API/122 did not include a worker image. Application122, API, model/provider, schema, environment, DNS/TLS, financial data and all other workers remain unchanged.

## Bound artifacts

- Worker source commit: `48791e6d421bf43e6db17e221782c10e0cc0cdb0`.
- Candidate image digest: `sha256:e5816ff8ed70adc619e8bf271d80d70e6584e6db88e490902fcb01045d8bb052`.
- Candidate tag: `masarifi-task31-assistant:48791e6d421b`; use the digest for execution.
- Original/rollback image digest: `sha256:72ae3ed54343c00ab5ab731e969a98a34e21ff9f880729cd7c2c05cb5bf69cb0`.
- Original worker ID: `073a736f68054484045f236fe4b5a38dcb454664eaa766bacbbfce94392efc21`.
- Original name: `masarifi-assistant-reports-worker-20261023`.
- Guest preparation root: `/var/tmp/masarifi-task31-day-evidence-20261106`.
- Retained private runtime snapshot: `worker-before.private.json` under that root, mode0600. Never print or publish its environment.
- Exactly one compiled file changes: `ai/assistant-agent.js`, SHA256 `1f8a20851cbfcd7105723fbe267632b8ce26b7cd798a9817d7f03cd5f1475902`. Other195 JavaScript files, all57 base layers and image runtime configuration remain; only the image source label changes.

The manifest binds this runbook, Dockerfile, rollout helper, review report, source pins, runtime hashes and artifact receipts. Keep these files frozen after approval; write execution evidence separately.

## Access and preflight

The preparation SSH rule was removed, all four UFW files/metadata/status matched their original state, and the task root-console tab was closed. Do not reuse old console handles or assume SSH is open. Follow the handoff: verify a fresh direct TLS marker in the actual access log and open only the current workstation /32 to this host22 using the existing operator key/known-host pinning. Keep root/password network SSH disabled. Remove only the new rule at the end.

Record the actual user reply, approved manifest SHA256 and image digest in `actual-user-approval.private.json` under the guest root. Copy the reviewed files byte-for-byte to `reviewed/`, including this helper and the report as `review-report.md`. The helper refuses missing approval, changed artifacts, changed runtime, stale/wrong-project idle proofs and repeated operation receipts.

Before dispatch, reconcile previous stage receipts and exact installed122/owner AND SDK session, consent, conversation, draft and pending request state. Preserve all drafts and pending work. No APK build/install, app clear, logout, account/default/source switch, SMS/Voice or financial fixture is authorized by this package.

Run `python3 -B reviewed/worker-rollout.py prepare prepare-a1`. It creates only a stopped replacement from the retained exact Config/HostConfig with the reviewed image. It verifies environment, command, CA mount, resource/security settings and network before any pause or start. A mismatch leaves the original worker serving and the candidate stopped; reconcile it rather than relax the runtime contract. No second active consumer is started.

## Fresh idle proof and bounded cutover

Use the existing authorized Supabase connector for this read-only aggregate. Do not grant the application role new access: the API-role capability probe was rejected42501 and that boundary is preserved.

```sql
begin read only;
select clock_timestamp() as observed_at,
  jsonb_build_object(
    'agentQueued', (select count(*) from private.assistant_agent_jobs where state='queued'),
    'messageQueued', (select count(*) from public.assistant_messages where role='user' and work_status='queued'),
    'agentProcessing', (select count(*) from private.assistant_agent_jobs where state='processing'),
    'messageProcessing', (select count(*) from public.assistant_messages where role='user' and work_status='processing'),
    'claimQueriesInFlight', (select count(*) from pg_stat_activity
      where pid<>pg_backend_pid() and state='active'
        and query ~ 'claim_((next_)?assistant_agent_job|ai_work)')
  ) as counts;
rollback;
```

Require all five counts zero. Capture the real result with its observed UTC time, project ID `qcffvfbpzvpwcwxwjyro`, reviewed manifest SHA256 and `authorizedConnectorReadOnly=true` in `pause-forward-cutover-a1-idle.private.json`. Never manufacture or reuse an old zero sample.

1. Within ten seconds, run `python3 -B reviewed/worker-rollout.py pause-forward cutover-a1`. It starts a30-second, nonce-bound watchdog before freezing the existing worker. The watchdog only unpauses that same process if its cutover window expires; it never starts a second worker. Retain the returned phase/nonce/timestamps from `rollout-state.private.json` privately.
2. While frozen, repeat the actual aggregate query. Require all five counts zero again, including no in-flight claim SQL. If any count is nonzero or inspection is uncertain, run the helper's `resume` action with a fresh operation name immediately. Keep the current image serving. Do not cancel or edit jobs.
3. Bind the fresh post-pause result to the pause nonce and manifest in `replace-forward-cutover-a1-idle.private.json`. It must be newer than the pause, no older than ten seconds, with at least eight seconds left in the watchdog window.
4. Run `python3 -B reviewed/worker-rollout.py replace-forward cutover-a1`. Only after those gates, it manually stops the already-frozen idle process using SIGKILL. This prevents the old polling timer from claiming work during thaw. The actual Docker paused-stop/exit137/no-restart behavior was qualified on an isolated no-network, no-credential Node process; the serving worker was never paused for that qualification.
5. The helper retains the stopped old container as `masarifi-task31-assistant-rollback-20261106`, renames the prepared candidate to the original name, starts it, and requires health within25seconds. It verifies the other30 serving containers retain exact images/start times. The final active worker has the same environment, consumer scope, command, network, mounts and limits. Only container identity/start time and image change.

If a gate expires, preserve all receipts. A new uniquely named attempt is allowed only after reconciling the actual state and obtaining a fresh idle proof; never overwrite markers or repeat a successful switch. If health fails after start, inspect actual state and pending jobs first. Do not stop an active request or start both images to hide an error.

## One Redmi read-only acceptance

Use the existing application122, existing owner AND SDK session and old conversation. Reconfirm consent, original draft and no pending submission. Preserve a nonempty draft and decline to overwrite it. Under one bounded screen-only/no-audio observer, send one distinct read-only question: `My expenses today.` No confirmation of a financial action, account change, fixture or refund is needed.

Measure device pre-send to first useful answer, one job attempt, provider dispatches/durations and actual requested-period evidence. Compare honestly with the prior approximately7.1seconds/server5.884616seconds/two rounds. A fixture's one-round behavior does not establish real-provider acceptance. Do not replay or resend if the response is delayed; inspect the durable request. Preserve the new question/reply and original draft.

Return to Home normally, finish the observer naturally, and verify exact retained owner AND SDK/registration and captured account/default/source/keyword/old Voice state. Reuse unchanged122/Home/build/source evidence. Do not repeat cold startup, SMS, Voice or broad performance tests.

## Rollback

The original image/container/config remain retained; no migration or credential restoration is required. If rollback is necessary, first let any current request finish and obtain the same fresh five-zero proof. Use `pause-rollback` with a new operation name, then a second post-pause/nonce-bound proof and `replace-rollback`. The helper applies the same idle-only frozen stop, retains the failed candidate under `masarifi-task31-assistant-failed-20261106`, restores the original name/image and waits for health. The same application122 and API remain. Never roll back a worker while it owns active work, delete job rows, clear app state or reissue a question.

Close the new limited SSH rule/root-console task tab and verify all four original UFW files/status. Record actual image/runtime/phone result and remaining latency limits in a separate execution report, update the handoff and push only owned changes to ratibi on the same branch. Canonical delivery remains111 and production readiness remains false.
