# DEV immediate deletion with an existing delayed request

Runtime release: `2764f849137ddf1cef468dff3fd150e942d5c26e`. Branch: `codex/voice-promoted-operating-2026-10-13`.

## Cause and correction

A deletion request created through the ordinary Staging client retained a 72-hour cooling period. A later confirmed DEV deletion reused that active request, including its original deadline. The immediate worker therefore could not claim it, and the mobile completion receipt kept returning `verified`.

When the server requires zero cooling hours, the repository now makes an owned pending request immediately eligible before returning it. Receipt replay stays bound to its original request and validates the completion token before changing state. Cancelled, completed and processing requests are not promoted. A server that still requires a cooling period retains its existing behavior.

The original confirmation popup and mobile cleanup remain in use. No mobile source or DEV installation was replaced for this fix.

## Verification

- Regression reproduced on real local PostgreSQL: both new confirmation and existing-receipt replay retained the old deadline before the correction.
- 13 integration tests passed, including actual handler completion in the same POST, unchanged cooling policy, cancelled receipt isolation, foreign ownership, provider failure and completion capability checks.
- 8 completion unit tests passed. API typecheck, scoped lint and API/worker/migration builds passed.
- Applied only to the two `/dev-account-deletion` Staging ingress paths, using candidate `masarifi-dev-immediate-delete-2764f849` on loopback port 3027. Readiness and release identity passed, Nginx validation passed, and existing containers retained their IDs, images and start times. Production was not changed.

## Physical acceptance

The already-confirmed live DEV operation was resumed through its existing request-bound worker path after removing its inherited deadline. It reached `completed` with no error. Server checks found zero owned accounts, transactions, voice sessions, assistant conversations, devices and preferences; personal profile fields were cleared.

The phone retrieved the completed capability receipt, performed its normal local erasure/sign-out and returned to Welcome. The pending deletion paragraph and refresh action disappeared. The temporary ordinary Staging APK was uninstalled, its share artifact was removed, and `com.masarifi.mobile.dev` remained installed.

A subsequent Google login provisioned a different, fresh profile and displayed onboarding. Both the deleted profile and this new profile had zero accounts, transactions, voice sessions and conversations. The new profile had no stale deletion message. The cold-open check observed this new onboarding state rather than Welcome, so it is not evidence of a second untouched signed-out launch.

This was recovery of the user's existing confirmed request, not a claim that a second live account was deleted from a new popup during this repair. Screenshots, deployment helpers and private operation evidence remain outside Git in `D:/Masarifi-preservation-2026-10-18/dev-immediate-delete-20261021/` and the prior Staging acceptance evidence folder.
