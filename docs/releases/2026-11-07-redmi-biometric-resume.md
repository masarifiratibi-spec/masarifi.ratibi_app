# Redmi biometric resume and mobile controls

On 7 November the primary Redmi 12 5G was connected over USB. Android user 0 had the running Masarifi package at version code 127. All checks used its existing session. No app lifecycle reset, installation, sign-out or server change was performed.

## Device observations on 127

- From Security settings, Hide balances changed from off to on and back. With device authentication initially off, tapping the switch started an eligible Android biometric session within 244 ms of the host tap command. Android System UI took focus. The owner touched the enrolled sensor, Android recorded success for the same request, and the switch became checked.
- With immediate locking enabled, returning from Home showed a cancellation and a manual retry. A second capture reproduced the sequence. From the start of that capture, Android Home had been invoked by 0.219 s. The biometric session appeared at 0.516 s and was gone by 0.750 s. The app was brought back at 2.766 s. No new biometric session was observed on return, and the accessibility tree contained the cancelled message and retry button. These are host observations, not precise sensor latency. The owner successfully unlocked on foreground retry. Device authentication was restored to off.
- The bug is in unlock-screen mount timing. Immediate locking mounts the screen in the background. Its mount effect dispatched authentication unconditionally and the OS ended the request before the foreground interaction. This evidence concerns automatic unlock after backgrounding, not a general fingerprint sensor failure.
- From the tracking screen the SMS and transaction-notification switches each displayed an enabled state when tapped. A later visit confirmed both were back at their original disabled state. These were switch tests, without a new SMS or financial event. The first USB interaction coincided with user navigation and was discarded.
- The Assistant landing page showed enabled personalization. One monthly-total shortcut produced a financial read response in the existing session, visible by the end of a 3.547 s capture including USB and UI tree overhead. There was no fresh consent activation because the owner already had consent. The device was returned to Home.

## Client correction

The unlock route retains its immediate privacy lock and owner and session checks. Its automatic authentication now starts once when the screen is in the foreground. Manual retry remains available after an unsuccessful prompt. Native credential fallback and strong biometric requirements are unchanged. The screen uses the existing Masarifi mark and a short localized instruction, with a primary retry action when needed. An ordinary cancellation returns to that action. Lockout, failure and unavailable-device notices remain visible. Android draws the actual system prompt and receives the localized title and subtitle.

The new background-mount regression failed on the original client because one native call was issued before foregrounding. After correction, the unlock, security journey, shell and biometric service suites passed all 36 tests. Mobile type checking and lint on the changed files passed. The protected data stayed covered in the tested cancellation flow. No customer binary was rebuilt. A new signed client is required to verify the changed foreground timing and visuals on Redmi.

[Arabic retry design preview, rendered separately from Android](2026-11-07-unlock-preview.png). The image illustrates the app-owned screen only. Design references were the system-managed [Android biometric prompt](https://developer.android.com/identity/sign-in/biometric-auth) and [1Password's Android unlock flow](https://support.1password.com/android-biometric-unlock/).
