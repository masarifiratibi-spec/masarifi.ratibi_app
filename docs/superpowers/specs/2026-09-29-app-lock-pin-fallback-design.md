# Masarifi App Lock PIN Fallback Design

**Date:** 2026-09-29

**Status:** Design approved; pending written-spec review

**Scope:** Staging mobile application only

## Purpose

Masarifi App Lock protects an already authenticated local session. Device
biometrics remain the primary unlock method when Android supports them, and a
six-digit Masarifi App PIN provides a local fallback. App Lock must remain
separate from Clerk/Google account authentication.

The completed flow is:

`Face/Fingerprint success -> unlock once -> enter Masarifi`

or:

`biometric cancel/failure/unavailable -> App PIN -> unlock once`

No path may create overlapping biometric prompts, bypass an invalid Clerk
session, erase financial data, or weaken Android biometric requirements.

## Existing Architecture to Reuse

The repository previously contained an App PIN implementation. The current
biometric-only cutover removed its UI and state actions but retained relevant
domain fields, the SecureStore key, and the installed `@noble/hashes`
dependency. Implementation will restore and harden that path rather than add a
second PIN subsystem.

Existing components that remain authoritative:

- `AppPrivacyGate` owns masking and background-lock timing.
- `ProtectedRouteGate` evaluates Clerk authentication before App Lock.
- `UnlockScreen` coordinates the local unlock attempt.
- `app-shell` state owns persisted lock state and session-aware navigation.
- `app-shell-storage` provides owner-scoped native SecureStore persistence.
- `biometric-service` wraps Expo LocalAuthentication without device-credential
  fallback.
- The stabilized Clerk bridge synchronizes only when Clerk identity changes.

## Credential and Storage Design

The App PIN is exactly six decimal digits. It is never persisted or logged in
plaintext.

The stored credential is a versioned PBKDF2-SHA256 verifier with:

- 120,000 iterations;
- a fresh 16-byte cryptographically random salt;
- a 32-byte derived key;
- constant-time byte comparison;
- strict format and iteration-bound validation.

The verifier is stored through Expo SecureStore under the existing
account-owner namespace derived from the authenticated Clerk user ID. The PIN
is not sent to Clerk, the backend, analytics, AI providers, or any other third
party. Plaintext legacy values such as `pin:123456` are rejected and removed;
they are not restored as compatibility credentials.

The persisted privacy-lock record retains:

- whether a valid PIN verifier exists;
- biometric enabled/disabled/availability status;
- auto-lock duration;
- failed-attempt count;
- lockout expiry;
- locked/unlocked state.

Hydration reconciles `pinConfigured` with the actual validated verifier rather
than trusting a stale Boolean. Failed-attempt and lockout state survive app
restart. Only a successful unlock clears them.

## Enrollment, Change, and Recovery

New App Lock enrollment creates and confirms an App PIN first. PIN creation
holds the first entry only in component memory until confirmation, clears it
when the flow is abandoned or completes, and never places it in route
parameters or module-global state. Biometrics may then be enabled after a
successful device-biometric verification.

Changing the PIN requires the current PIN before accepting and confirming a
replacement. Resetting a forgotten PIN requires Clerk account
reauthentication using a configured method (Google for the current Staging
account); there is no local bypass.

Existing biometric-only installations have no recoverable PIN because the
current migration intentionally deleted obsolete PIN credentials. They retain
Face/Fingerprint unlock and must create a new App PIN. If biometrics cannot be
used before setup, account reauthentication is the only recovery path to PIN
creation.

## Unlock State Machine

The lock screen starts at most one automatic biometric request per mounted
unlock attempt. An in-flight guard and attempt identity prevent duplicate
requests and ignore stale callbacks after cancellation, mode changes, unmount,
or successful navigation.

The screen always offers `Use PIN instead` when a PIN exists. Choosing it
cancels the active native biometric request and reveals PIN entry. Biometric
cancel, failure, unavailability, missing enrollment, recoverable error, or
lockout also reveals PIN entry with a clear error and an explicit biometric
retry action. Retrying is user initiated; failures never automatically start a
prompt loop.

Biometric success and correct PIN verification call one shared unlock action.
That action persists the unlocked state, clears failed attempts, and navigates
once to the resolved authenticated destination. Wrong PINs never unlock.

After five wrong PIN attempts, the lockout expiry is persisted for 30 seconds.
PIN submission remains disabled until expiry. A later wrong attempt starts a
new bounded lockout. No failed-attempt path deletes financial or account data.

If no PIN is configured, the screen preserves biometric unlock and offers the
account-reauthenticated PIN setup recovery path instead of an insecure local
setup shortcut.

## Authentication and Lifecycle Boundaries

Clerk authentication is evaluated before App Lock. Signed-out or expired
sessions route to account authentication, and neither biometric nor PIN
success can bypass that gate. Local App Lock failure does not destroy a valid
Clerk session.

Android's transient `inactive` state caused by the biometric overlay masks
protected content but does not count as a real background transition and does
not relock. A real `background` transition is recorded once and applies the
configured immediate or delayed lock on foreground. The unlock route remains
visible above the privacy mask so the mask cannot cover its recovery UI.

Face Recognition and Fingerprint use the biometric methods legitimately
reported by Android. Device-credential fallback stays disabled: the phone's
screen-lock PIN is never treated as the Masarifi App PIN.

## User Interface and Localization

The App Lock settings section provides:

- Create or Change App PIN;
- account-verified PIN reset;
- biometric enable/disable after PIN setup;
- auto-lock duration.

The unlock screen provides:

- the single automatic biometric attempt when enabled;
- `Use PIN instead`;
- six-digit secure PIN entry;
- clear recoverable biometric/PIN errors;
- explicit biometric retry;
- account-verified setup recovery when no PIN exists.

English and Arabic copy use generic biometric terminology unless Android
explicitly reports Face Recognition or Fingerprint. Existing components,
spacing, typography, and RTL/LTR behavior are retained; unrelated screens are
not redesigned.

## Test-First Verification

Regression tests are written and observed failing before production changes.
The minimum automated coverage is:

- biometric success unlocks and navigates exactly once;
- no second prompt, overlapping request, stale callback, React update loop, or
  route-remount loop;
- cancel, failure, unavailable hardware, no enrollment, and biometric lockout
  expose PIN fallback;
- manual `Use PIN instead` cancels the active native attempt safely;
- correct PIN unlocks; wrong and malformed PINs do not;
- five failures persist the 30-second lockout across restart;
- PIN setup, change, owner isolation, SecureStore persistence, corrupt-record
  rejection, and account-verified reset;
- cold/warm start, transient `inactive`, real background/foreground, and app
  restart;
- signed-out and expired Clerk sessions cannot be bypassed;
- Arabic/English and RTL/LTR UI;
- all existing privacy-mask, route, Clerk-session, and lifecycle regressions.

After targeted tests pass, the complete Mobile test suite, typecheck, lint,
format, and frontend quality checks run.

## Release and Physical Verification

Only relevant App Lock/PIN files are committed and pushed to the existing
Staging branch. The exact commit SHA must pass the repository Mobile, API,
Admin, database, security, and image gates. Only the immutable image and APK
belonging to that SHA may be used.

A device-compatible APK is built with the existing package ID and signer,
verified as Staging, and installed with `adb install -r`. The Samsung app is
not uninstalled and its data is not cleared.

Physical verification requires:

1. Cold start produces exactly one Face Recognition prompt.
2. Face success and any Samsung Confirm action unlock once.
3. No second prompt, privacy-mask obstruction, update loop, or crash occurs.
4. Cancel/failure exposes PIN fallback.
5. Wrong PIN remains locked; correct PIN unlocks.
6. Background/foreground and restart relock correctly.
7. The existing Clerk session remains valid.

The owner performs Face authentication, enters the chosen App PIN, and
completes any account reauthentication/MFA. After physical verification passes,
one final EAS-signed Staging APK is built from the same exact verified SHA.

## Out of Scope and Hard Constraints

- Production remains untouched.
- No Gmail, OpenRouter, Clerk, Supabase, Firebase, Expo, or other integration
  credential is created, rotated, revoked, replaced, or modified.
- No Samsung security or biometric enrollment setting is changed.
- No device PIN is read or stored.
- No financial data is deleted because of App Lock failures.
- No unrelated UI redesign, new cryptography dependency, or backend PIN service
  is introduced.
