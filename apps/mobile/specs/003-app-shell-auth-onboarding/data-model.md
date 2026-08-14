# Data Model: App Shell, Navigation, Authentication, and Progressive Onboarding

The model describes frontend state and typed adapter boundaries. It does not define production
identity records, backend authorization, SMS content storage, or financial source-of-truth data.

## AuthenticationSession

| Field | Type | Rules |
|---|---|---|
| `status` | enum | `signed_out`, `restoring`, `authenticated`, or `expired` |
| `userId` | string or null | Opaque mock identifier; present only when authenticated |
| `method` | enum or null | `phone` or `google` |
| `issuedAt` | timestamp or null | English-numeral machine value; not shown raw |
| `expiresAt` | timestamp or null | Drives mock expiry without provider claims |
| `restoration` | enum | `idle`, `pending`, `restored`, `missing`, or `failed` |

**Transitions**:

```text
signed_out -> restoring -> authenticated
signed_out -> restoring -> signed_out
authenticated -> expired -> authenticated
authenticated -> signed_out
expired -> signed_out
```

- Failed, cancelled, or conflicting authentication never enters `authenticated`.
- Sign-out clears protected navigation history; sign-out-all also reports the simulated remote result.

## PhoneVerificationAttempt

| Field | Type | Rules |
|---|---|---|
| `sessionId` | string | Unique per issued mock code |
| `countryCode` | string | Validated calling code; rendered safely in RTL |
| `phoneValue` | string | Transient sensitive input; excluded from logs and analytics |
| `codeLength` | number | Fixed at 6 |
| `status` | enum | `idle`, `sending`, `sent`, `verifying`, `verified`, `invalid`, `expired`, `rate_limited`, or `failed` |
| `issuedAt` | timestamp | Starts five-minute validity window |
| `resendAvailableAt` | timestamp | 30 seconds after issue |
| `invalidAttempts` | integer | 0 through 5 |
| `replacedBy` | session id or null | Previous attempt becomes invalid when populated |

**Transitions**:

```text
idle -> sending -> sent -> verifying -> verified
sent -> verifying -> invalid -> sent
sent -> expired
sent -> rate_limited
sent -> replaced
```

- The sixth invalid submission is never accepted; five failures produce `rate_limited`.
- Resend creates a new attempt and invalidates the previous code immediately.

## IdentityConflict

| Field | Type | Rules |
|---|---|---|
| `selectedMethod` | enum | The attempted `google` identity |
| `existingMethod` | enum | Existing `phone` or `google` method |
| `status` | enum | `detected`, `reverification_required`, `linking`, `linked`, `cancelled`, or `failed` |
| `accountUnchanged` | boolean | Must remain true until linking succeeds |

**Transition**:

```text
detected -> reverification_required -> linking -> linked
reverification_required -> cancelled
reverification_required -> failed
```

## OnboardingProgress

| Field | Type | Rules |
|---|---|---|
| `platformPath` | enum | `android`, `ios`, or `conservative` |
| `status` | enum | `not_started`, `in_progress`, `completed`, or `skipped` |
| `completedSteps` | set of step ids | Completed steps are not repeated |
| `skippedSteps` | set of step ids | Optional skips are recorded separately |
| `currentStep` | step id or null | Earliest incomplete applicable step |
| `permissionEducationSeen` | boolean | Required before an Android request |
| `trackingPreference` | TrackingPreference or null | Android only when configured |
| `updatedAt` | timestamp | Supports deterministic resume |

**Platform step order**:

```text
android: tracking_intro -> permission_education -> permission_request -> keywords -> preference -> demo -> complete
ios: platform_explanation -> capture_options -> optional_automation -> demo -> complete
conservative: platform_explanation -> manual_voice_demo -> complete
```

- Optional steps may be skipped; completion never requires profile data.
- Permission request cannot precede `permissionEducationSeen = true`.

## PermissionState

Reuses the foundation permission model.

| Field | Type | Rules |
|---|---|---|
| `id` | string | `sms` for SPEC-003 Android tracking setup |
| `status` | enum | `not_requested`, `granted`, `denied`, `permanently_denied`, `revoked`, or `unavailable` |
| `blocking` | boolean | Always false for SMS onboarding |
| `recoveryAction` | enum or null | Request, retry, open settings, or continue without tracking |

- iOS and conservative platform paths expose no SMS permission entity.
- Every non-granted state retains manual and voice capture.

## KeywordRule

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable unique identifier |
| `group` | enum | Expense, income, transfer, withdrawal, deposit, refund, subscription, installment, fee, failed transaction, or reversal |
| `language` | enum | `ar` or `en` |
| `value` | string | Trimmed display value |
| `normalizedValue` | string | Trimmed and case-normalized duplicate key within group and language |
| `origin` | enum | `default` or `custom` |
| `enabled` | boolean | Defaults may be disabled; custom entries may be deleted |

- Empty normalized values are invalid.
- Duplicate `group + language + normalizedValue` combinations are rejected.
- Disabling the final enabled rule in a group requires explicit warning acceptance.

## TrackingPreference

| Field | Type | Rules |
|---|---|---|
| `mode` | enum | `automatic_clear`, `review_all`, or `paused` |
| `selectedAt` | timestamp | Records the latest deliberate selection |
| `isRecommended` | boolean | True only for `automatic_clear` |

**Mock detection outcome**:

| Input classification | `automatic_clear` | `review_all` | `paused` |
|---|---|---|---|
| Clear eligible | Add with correction controls | Review | Ignore |
| Uncertain | Review | Review | Ignore |
| Failed, OTP, marketing, duplicate, conflict, low confidence | Reject or review safely; never add | Reject or review safely; never add | Ignore |

## NavigationContext

| Field | Type | Rules |
|---|---|---|
| `requestedDestination` | route or null | Deep link or in-app target |
| `safeReturnDestination` | route or null | Contains no sensitive parameters |
| `gate` | enum | `hydrating`, `authentication`, `unlock`, `onboarding`, or `ready` |
| `localeDirection` | enum | `rtl` or `ltr`, derived from locale |

**Resolution**:

```text
hydrate -> authenticate -> unlock -> onboard -> requested destination
                                               -> Home when invalid/unavailable
```

## PrivacyLockPreference

| Field | Type | Rules |
|---|---|---|
| `pinConfigured` | boolean | PIN has exactly six digits during setup; raw form value is transient |
| `biometricStatus` | enum | `unsupported`, `not_enrolled`, `disabled`, `enabled`, or `locked_out` |
| `autoLockDuration` | enum | Approved selectable duration or `immediate` |
| `invalidAttempts` | integer | 0 through 5 |
| `lockedUntil` | timestamp or null | Fifth failure sets 30-second lock |
| `appLockStatus` | enum | `unlocked`, `locked`, or `temporarily_locked` |
| `hideBalances` | boolean | Reuses existing preference ownership |

**Transitions**:

```text
unlocked -> app_background/timeout -> locked
locked -> valid_pin/valid_biometric -> unlocked
locked -> five_invalid_pins -> temporarily_locked -> locked
forgot_pin -> account_reauthentication -> pin_reset + biometrics_disabled
```

- Account-session authentication takes precedence when session expiry and app lock coexist.
- PIN reset retains financial and profile data.

## ProfileCompletionStep

| Field | Type | Rules |
|---|---|---|
| `id` | enum | Name, first account, salary, budget, obligation, or savings goal |
| `status` | enum | `incomplete`, `completed`, or `unavailable` |
| `destination` | route | Opens the owning feature or representative mock route |
| `dismissed` | boolean | Dismissal persists across sessions |

- The Home prompt shows only incomplete, applicable steps.
- Completion elsewhere updates the same step; no duplicate profile state is stored in the shell.

## Relationships

- `AuthenticationSession` and `PrivacyLockPreference` determine the first two navigation gates.
- `OnboardingProgress` determines the third gate and references one `TrackingPreference` on Android.
- `OnboardingProgress` observes `PermissionState` but does not own native permission truth.
- `KeywordRule` and `TrackingPreference` configure the SPEC-003 demonstration and later SPEC-005 adapter.
- `NavigationContext` retains only a safe route target, never credentials or financial values.
- `ProfileCompletionStep` reads completion from owning features and stores only dismissal behavior.

