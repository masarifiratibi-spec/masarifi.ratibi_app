# R02 Account Picker Evidence

Date: 2026-08-15

Implemented:

- Account Picker now renders a virtualized account selection list using `AccountRow`.
- Picker consumes the account balance projection and preserves controlled `selectedId` / `onSelect`.
- Route presentation now uses `RouteModalContainer` while keeping dismissal as `router.back()`.
- Picker now distinguishes no eligible active accounts from no search matches.

Verification:

- Included in focused R02 Jest command recorded in `shared-foundation.md`: PASS.
- Included in quickstart Jest command recorded in `shared-foundation.md`: PASS.

Open:

- Full caller draft preservation matrix, optional create handoff, and Android/iOS visual evidence remain open.
