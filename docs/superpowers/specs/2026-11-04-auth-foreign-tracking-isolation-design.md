# Proposed: authenticate the intended account with foreign Tracking isolated

Status: approved by the user on 4 November 2026. Implementation and targeted regression verification complete; final full validation and Redmi acceptance pending.

## Proven problem

Redmi observations on 4 November 2026 show that Google session resumption, exact hook/singleton identity agreement, session validity, UI result delivery and preference persistence succeed. AppShell authentication then calls the identity-reset participants before database/profile admission. Tracking finds a different retained Clerk owner, suspends native intake and rejects. AppShell withdraws shell access and routing returns to sign-in. No profile HTTP request is reached.

Safe provenance comparisons establish that the current verified Clerk owner matches the historical accepted Benchmark account. The retained primary-app Tracking owner is Clerk-shaped and does not match that historical account. There is no retained legacy unscoped AppShell session establishing an alias. The user confirms they always selected the same Google account. The origin of the foreign retained owner is unknown.

## Constraint requiring a scope choice

The existing October 12 preservation contract intentionally blocks all database admission on this mismatch. Catching the exception and declaring successful restoration would violate that contract. No evidence authorizes merging, rebinding, deleting or replaying either owner's work.

## Approaches

1. Recommended proposed change: authenticate the verified historical account into its own profile/database while keeping foreign Tracking visibly unavailable and suspended. Every access to the retained Tracking data remains denied. This changes admission from global blocking to explicit subsystem isolation.
2. Preserve the existing global admission policy, remove the misleading loading loop and show a bounded owner-preservation error. This is smaller but does not restore access to the application.

Clearing storage, replacing the retained owner, selecting arbitrary Clerk sessions, signing out, weakening identity equality, changing hosted services and enabling production are excluded.

## Proposed isolation contract

- Preserve all active-session, authoritative profile, database-owner, App Lock, logout and deletion checks.
- Never adopt foreign Tracking data as the authenticated owner's data. Preserve JS context bytes, generation, encrypted queues, keys and pending operations.
- A valid foreign JS context is insufficient by itself. Confirm native state consistency and dormancy. Existing native `restoreTrackingOwner` only suspends intake and compares owner/generation; a narrowly scoped assessment may compare the retained context against its own owner/generation solely to establish preservation, never to authenticate that owner. Only `PRESERVED`, unchanged context and a current generation qualify for isolation. Ambiguous, malformed, stale, unavailable or failed suspension outcomes still reject admission.
- Keep the mismatch a typed failure from Tracking restoration. Handle only the confirmed isolated-foreign outcome inside Tracking's identity-reset callback. Other reset participants' errors continue to abort authentication.
- Reuse that Tracking admission adapter when a verified cached owner bypasses full authentication initialization. Ordinary Live starts pending; successful availability carries the verified owner and a revision. Cold headless work performs its own continuity assessment. Preserve the existing Benchmark read-only behavior.
- Publish explicit owner-bound Tracking admission state. Isolation never sets `restorationBlocked` to false and never reports Tracking as restored.
- Deny Tracking queue reads, scanning, pending submissions, acknowledgements, configuration/capture changes, scheduling and headless work before their boundaries. Native suspension remains a second guard. Display a clear Arabic unavailable state without a destructive recovery button.
- Fence every global cleanup path against the isolated foreign owner, including Settings local-data reset, `resetRuntimeUserData`, default/no-context identity resets and sign-out cleanup. Signing out or resetting the authenticated account must never clear the foreign native queue/context. A coordinator-only guard is insufficient.
- Logout and local-data reset remain bounded unavailable while foreign Tracking is isolated; do not bypass pending-work assessment or consume a logout disposition. Their normal behavior remains available after verified same-owner Tracking restoration.
- Preserve same-owner logout/recovery across intended suspension. Cold recovery may assess same-owner retained metadata only against an unchanged persisted disposition and the existing pinned SDK anchor checks; foreign or ambiguous state remains blocked. Revoke ordinary admission after owner release, without invalidating the cleanup's own preservation phase.
- Admission for the authenticated financial account still requires its normal authoritative server bootstrap. No cross-owner data migration or new financial/provider action is part of this fix.

## Verification and delivery

First reproduce the contract with a failing regression through real AppShell restoration and native/persistence boundaries. Cover preservation, forbidden operations, malformed/native-ambiguous state, suspension failure, global reset/local-data cleanup and owner/logout races. Apply clean-code-guard and test-guard, run relevant and required mobile checks, and review the resulting diff independently.

Build an ordinary non-debuggable ARM64 Staging APK using the existing certificate and guarded builder. Remove every temporary observer from canonical source and the installed/delivered bundle. Update Redmi in place, prove actual account entry and bounded loading, check relevant ordinary authenticated screens without financial/provider mutations, and verify UID/data-directory/install-time preservation. Explicitly report that foreign Tracking remains unavailable and that its origin/recovery is unresolved. Push only after device acceptance, on the existing branch; retain unrelated documents and private evidence locally.
