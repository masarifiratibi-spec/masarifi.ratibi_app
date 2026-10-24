# Staging voice analysis with posting OFF

The user's October 5 instruction authorizes nonfinancial implementation, Staging deployment and Samsung installation/testing, and asks to stop only before the first financial canary. This extends the previous analysis harness into the real v3 capture/upload/provider/receipt flow; it does not authorize financial persistence or Production deployment.

Root cause: `private.create_voice_session_v3` raises `VOICE_AUTOMATIC_UNAVAILABLE` before creating a session whenever `private.voice_automatic_policy.enabled=false`. The repository maps that exact exception to HTTP503. This is correct for automatic financial admission but cannot support analysis with posting disabled.

## Selected design

Keep existing automatic admission/finalization untouched. Add a separate, default-disabled analysis capability, restricted by server configuration to the known Staging Supabase origin and by a private database policy to one authenticated owner. A session snapshots `analysis_only=true` in its context; it cannot later become an automatic session when the policy changes.

Reuse v3 audio upload, immutable hash validation, provider gateway, compact parser and event decider. Analysis acceptance validates/fences the result but creates no financial event/command, draft, transaction, posting or balance effect. A completed batch returns `addedCount=0`, `transactionIds=[]`, plus optional `analysis={mode:'analysis_only',persisted:false,events,expiresAt}`. Events contain only safe independently extracted transaction fields, at most10 and24KiB, private/owner-scoped and retained at most15minutes. No transcript/audio/provider payload in logs.

An isolated worker runs only analysis-session extraction and its scoped media purge. It never starts the general operations worker or claims unrelated legacy/automatic sessions. Normal provider budgets, authorization, deadline/fencing and retry limits remain; no fallback success. Immediate Storage deletion plus scoped purge reconciliation clears media references. Failed/cancelled/expired analysis audio also has cleanup ownership.

Mobile strictly validates the extended receipt, disallows financial IDs/counts in analysis-only receipts, and displays a separate bilingual “Analyzed — not saved” section on Home and Transactions. These results never enter finance caches, balances or the persisted transaction list. No Review/Confirm/Save action. Owner changes clear the existing batch hook; navigation/resume/cold recovery use owner-scoped receipts. Production automatic receipts remain unchanged.

## Verification and stopping boundary

Prove ordinary OFF admission still rejects; only authorized analysis admits/replays; completion creates no financial entities even with automatic posting later enabled; stale leases/cancellation cannot publish; scoped worker never claims unrelated work; expiry drops results; unsafe events remain skipped. Preserve the previous cache race regression.

Deploy only the exact tested immutable Staging image and migration; keep posting OFF. Build/install a clean exact-source ordinary preview APK with login/data preserved. Request one English and one Arabic human recording only after admission/worker/cancellation/purge checks pass. Correlate capture/request/session/provider operation/final receipt/UI and verify audio cleanup and unchanged financial counts. Do not claim full automatic financial acceptance from this nonposting evidence. First financial canary still requires explicit approval. Ten-event testing remains paused.
