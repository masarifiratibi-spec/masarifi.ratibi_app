# Home Transaction Account Line Design

## Goal

Show the real source-account name as a third metadata line in each Home recent-transaction card, matching the supplied reference while preserving the approved independent-card layout.

## Data Flow

- Reuse the existing `useAccounts(true)` query so archived accounts remain resolvable for historical transactions.
- Keep `HomeSummary`, `Transaction`, service contracts, repositories, and APIs unchanged.
- The queried Home path passes the existing account records into `HomeSummary`; injected-summary callers may pass accounts explicitly for tests and validation states.
- Resolve each transaction's source `accountId` locally and pass only the account name into the row. Transfers show the source account, not the destination.

## Presentation

- Render the account name directly below the category label inside the existing transaction text group.
- Add one restrained teal status dot after the account name, using existing semantic theme colors and spacing tokens.
- Keep the title, category, account name, icon, amount, date, card navigation, masking, and RTL/LTR column positions unchanged.
- Do not render raw account IDs. While accounts are loading or if a record cannot be resolved, omit the account line without blocking or replacing the Home summary.
- Include the resolved account name in the card accessibility label.

## Verification

- Add a failing Home test proving a real source-account name is shown and the raw ID is not.
- Cover Arabic and English rendering, transfer source-account behavior, unresolved-account fallback, accessibility text, and existing transaction navigation.
- Run focused Home tests, typecheck, lint, core-finance boundaries, the Impeccable layout detector, and one Arabic/English web visual pass.

## Guardrails

- No new routes, dependencies, localization keys, API contracts, domain fields, persistence, or financial calculations.
- Do not turn the cards into a grouped container or change unrelated Home composition.
