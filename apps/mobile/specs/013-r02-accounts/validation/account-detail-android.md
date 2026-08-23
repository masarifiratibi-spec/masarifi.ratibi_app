# R02 Account Detail Android Evidence

Date: 2026-08-15

Device:

- Android device detected by `adb devices`: `RK8XB00N33K`.
- App package: `com.masarifi.mobile`.
- Metro: Expo dev client on port 8082 with `adb reverse tcp:8082 tcp:8082`.

Observed:

- Opened account detail from the Account List.
- Verified visible hierarchy for account title, hidden summary amount, compact identity row, Recent activity section, R04 transaction rows, Edit account action, and Archive account action.
- Opened Edit account from detail and verified existing edit form loads account name/type/currency fields.

Artifacts:

- `specs/013-r02-accounts/validation/r02-account-detail.png`
- `specs/013-r02-accounts/validation/r02-account-detail.xml`
- `specs/013-r02-accounts/validation/r02-account-edit.png`
- `specs/013-r02-accounts/validation/r02-account-edit.xml`

Status:

- Partial Android evidence only. Archive/restore, theme/text-scale/TalkBack, Arabic RTL, action failure, and iOS validation remain unchecked.
