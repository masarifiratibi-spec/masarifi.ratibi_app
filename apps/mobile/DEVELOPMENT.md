# Local Staging development

Use a separate Android development app for daily JavaScript/TypeScript and UI changes. The ordinary acceptance app remains `com.masarifi.mobile`; development uses `com.masarifi.mobile.dev`, the label **Masarifi Dev**, and only the `masarifi-dev` link scheme. Android isolates their app storage, login and journals. Do not copy the ordinary app's credentials, database or unresolved operation identities into development.

The development launcher fixes live mode and the API to `https://api.staging.masarifiratibi.com`. It uses the reviewed public Clerk identifier from the ignored `.env.staging-development.local` file or the public environment variable. Backend credentials never belong in the mobile environment. Default Expo builds retain their original identity and Firebase configuration.

Once the development APK is installed, connect Samsung by USB and run:

```powershell
Set-Location 'C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile'
& 'C:/platform-tools/platform-tools/adb.exe' -s RK8XB00N33K reverse tcp:8081 tcp:8081
npm.cmd run dev:staging
```

Open **Masarifi Dev** using its development launcher and load the local server. Keep Metro running during development. Most changes appear through Fast Refresh without building another APK. Disconnecting the computer/server ends this development connection; it does not stop the Staging backend. A separate login may be needed; never extract the ordinary app's token to avoid it.

Native library, SDK or native configuration changes require a new development binary. Generate Android using `node scripts/staging-development.mjs prebuild`, with the Staging environment also set for Gradle compilation. Compile only the development package and verify its manifest, signature and runtime before installing. Do not use the generic `android` command for this workflow: without the development environment it selects the ordinary identity. Never regenerate a native directory for another variant over this one without preserving it and checking the generated package.

The launcher makes Windows resolve the local Metro listener through IPv4 for USB reverse. Enter `exp://localhost:8081` in the development launcher and choose Connect. The Google callback uses `masarifi-dev://sso-callback` in this app; the ordinary app retains `masarifi://sso-callback`. Callback parameters are removed from Router navigation for both schemes.

The current development package has no separately registered Firebase Android client. FCM remote push is unavailable; ordinary app Firebase configuration is retained, and local notification APIs remain included. Registering a separate Firebase client is outside this preparation. This limitation does not replace the Voice/Manual acceptance requirements.

Financial approval remains separate. Keep Voice financial admission and Posting OFF, the general worker stopped, and do not make a valid Manual Save or human financial capture during preparation. Manual Save is not protected by the Voice Posting switch. The development build is for iteration; it is not the immutable release candidate required by the financial approval packet.

The development APK was built locally and installed separately on Samsung on October 6. Package/version/signature, ZIP/native ELF 16K alignment, Metro manifest and actual live Staging bundle configuration were verified. Google login initially failed because Clerk rejected the separate callback. After explicit approval, only `masarifi-dev://sso-callback` was added to the matching Staging-domain Clerk allowlist; the original callback remains. Human login then succeeded, and actual development Home/Transactions reads and an authenticated Staging recovery response were verified. This establishes nonposting startup/connectivity, not financial acceptance. SSO callback regressions passed43 tests after failing before the fix; typecheck and targeted lint passed. Later auth diagnostics and Legal Back tests passed, but the full Mobile run and focused rerun each retained a Manual test failure; see the handoff rather than claiming full green. These development changes are uncommitted and do not inherit the exact release candidate's green CI.

With explicit permission, the shared Gradle directory was copied to `D:/Android Build Cache/Gradle`; all49,771 file hashes matched before replacing `C:/Users/DELL/.gradle` with a junction. The local build also uses a temporary `M:` mapping to this same designated worktree to avoid Windows CMake path-length limits. No source or phone data was relocated. Evidence, the original development APK and build results are retained under `.superpowers/sdd/2026-10-06-staging-voice-saving-manual-recovery/`.

References: [Expo local development](https://docs.expo.dev/guides/local-app-development/), [independent app variants](https://docs.expo.dev/build-reference/variants/).

Independent Dev/Voice/Manual testing instructions: `docs/handoffs/2026-10-06-development-voice-manual-review-prompt-en.md` from the repository root. The queued-build/development-setup follow-up was deleted after delivery; Metro remains available for live development.
