# Masarifi Client Demo Mode Design

## Goal

Make the current client-demo build open directly on Home and contain coherent persisted demo data across the application. Authentication routes and implementation remain in the route tree for later work but are not reachable during demo-mode startup.

## Mode contract

`EXPO_PUBLIC_DEMO_MODE=1` enables client demo mode. The current demo build sets this value. Removing the value restores the existing authentication and onboarding gates without deleting or rewriting those screens.

Demo mode creates a local authenticated session and completed onboarding state during app-shell hydration. The session is local-only, has a stable demo user identifier, and is refreshed on startup so route guards consistently resolve to `/(tabs)/home`. Privacy-lock behavior remains unchanged when the user explicitly configures it.

## Seed contract

SQLite stores a versioned marker named `demo-seed-v1`. If the marker is absent, demo mode inserts missing demo records and writes the marker in the same database transaction. If the marker exists, startup performs no seed writes.

Seeding is additive and idempotent:

- Existing user-created or edited records are preserved.
- Stable demo IDs prevent duplicate records.
- A default zero-balance account may be upgraded to the approved populated demo ledger only when it is still unmodified and contains no user transactions.
- Seed failure rolls back both the inserted rows and marker, allowing a later startup to retry safely.

## Seeded data

The existing approved system categories are retained. Demo mode provides coherent records for:

- Bank, cash, and card accounts.
- Posted income, expenses, a transfer, a refund, and representative merchants.
- Multiple budgets and category allocations for the current financial month.
- Salary profile and receipt.
- Payable obligation, schedule, and payment.
- Savings goal and contribution.
- Automatic-tracking review/history examples.
- Assistant notification examples.

Reports, analytics, Home, Transactions, Planning, and Assistant context derive from the same core-finance and planning repositories. No report-only or assistant-only financial totals are seeded.

Demo dates are generated relative to the current configured financial month so the populated state remains visible after the calendar changes. Stable IDs identify rows; timestamps and period keys are calculated only during the first seed transaction.

## Code placement

- Reuse `src/domain/core-finance-seeds.ts` for core demo factories.
- Move reusable planning demo records out of `test-utils` into a production-safe domain seed module.
- Add only the missing tracking and notification seed factories beside their domain/repository code.
- Keep repository hydration responsible for database persistence and idempotency.
- Keep route resolution unchanged; app-shell hydration supplies the demo session expected by existing route guards.

No new dependency, state-management framework, database, or routing layer is introduced.

## Error handling

Demo session creation is deterministic and cannot require network access. Database seeding uses the existing exclusive SQLite transaction helper. A database error propagates through existing initialization error handling; partial demo data must never be reported as successfully seeded.

## Verification

Automated checks cover:

- Demo mode opens Home without rendering public authentication routes.
- Authentication route files remain registered and non-demo mode still resolves to them.
- Every seed family is present after first hydration.
- Repeated hydration creates no duplicates.
- User edits and user-created records survive later startups.
- A failed seed transaction writes neither partial data nor the marker.
- Home, Transactions, Reports, Planning, Tracking, Notifications, and Assistant context read coherent seeded state.
- Existing RTL/LTR and UI-freeze tests remain unchanged.

Manual verification refreshes the web Home route and restarts the native app. Both must return to the populated Home screen without `Unmatched Route`, login, or onboarding screens.

## UI freeze

This change does not alter JSX structure, styles, colors, typography, navigation appearance, or screen layout. Only route startup state and displayed data change. Authentication screens are hidden by demo-mode routing, not deleted.
