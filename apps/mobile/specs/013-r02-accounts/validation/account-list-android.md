# R02 Account List Android Evidence

Date: 2026-08-15

Device:

- Android device detected by `adb devices`: `RK8XB00N33K`.
- App package: `com.masarifi.mobile`.
- Metro: Expo dev client on port 8082 with `adb reverse tcp:8082 tcp:8082`.

Observed:

- Mock Google sign-in completed.
- Account List opened with `masarifi:///accounts`.
- Verified visible hierarchy for title, search, Add account, Active accounts section, archived section, compact account rows, hidden balances, default account status, archived status, and back action.

Artifacts:

- `specs/013-r02-accounts/validation/r02-account-list.png`
- `specs/013-r02-accounts/validation/r02-account-list.xml`
- `specs/013-r02-accounts/validation/r02-account-list2.xml`

Status:

- Partial Android evidence only. Full Android matrix for Arabic/English, light/dark, 200% text, TalkBack, empty/error/100+ rows is not complete and T020 remains unchecked.
