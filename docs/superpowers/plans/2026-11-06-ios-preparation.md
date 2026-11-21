# iPhone preparation alongside Android improvements

Approved by the user in this chat on 2026-11-06. Implement inline using
superpowers:executing-plans; preserve the active Android worktree.

## Goal and constraints

Prepare an independent Ad Hoc iPhone client, keeping the production identity,
backend, retained Clerk instance, Android behavior and current email PDF flow.
Start branch `iOS` at `12ee32ed129d9ff6695860ddf59e8b002bfea71b` in
`E:\Masarifi-iOS`; Android development continues in
`D:\Masarifi-integration-2026-10-10`.

## Tasks

1. Create isolated worktree and install the locked mobile dependencies on E.
2. Add `ios-ad-hoc` extending production, internal distribution, no development
   client, physical devices only. Preserve all production build checks and version
   injection; reject this profile on Android. Test accepted and rejected inputs.
3. Replace explicit Android tracking imports with platform resolution. Keep the
   Android implementation; iOS uses the platform-neutral optional native lookup,
   which returns null when the Android-only module is absent. Verify unavailable
   tracking safely redirects to manual/voice capture.
4. Run configuration tests, mobile tests, typecheck and lint. Produce iOS JS/assets
   using Expo export on Windows, inspect resolved native configuration. No native
   compilation or device-readiness claim from this export.
5. Review changes, integrate completed Android commits after checking ownership,
   record evidence and commit the iOS changes. Leave the Android branch intact.

## Review focus

- Wrong platform, bundle or production binding cannot silently produce a client.
- Missing SMS native module must not block iPhone startup or ownership services.
- Android runtime resolution and its existing tests retain their behavior.
- Exported test artifacts must not be mistaken for a signed device IPA.
- Ongoing Android changes remain in the source until their owner commits them.

## Activation gate and acceptance

Apple activation, correct Apple team, owner/client UDIDs, provisioning and APNs
credentials remain required for signed EAS builds and actual-device acceptance.
Use `eas device:create`, then `eas build --platform ios --profile ios-ad-hoc`
with approved production environment and release version. No App Store submission.
Verify install, Google callback, retained/restarted session, transactions, voice,
email reports, lock, permissions and notifications on iPhone before sharing.
Android SMS/other-app notification reading is not an iPhone capability. No new
Shortcuts integration or backend/database changes are part of this preparation.
