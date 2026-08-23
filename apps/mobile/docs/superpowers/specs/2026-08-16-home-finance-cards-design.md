# Home Finance Cards Design

## Scope

Refine only the Home `All Accounts` and recent-transactions presentation. Preserve the existing Home summary query, domain models, privacy behavior, routes, and transaction/account calculations.

## All Accounts

- Add one pressable premium card between the financial pulse and attention rail.
- Use the existing summary balance, active-account count, hidden-balance state, and excluded-account count.
- Show a wallet icon, localized title and account-count description, balance on the opposite edge, and a directional chevron.
- Show a restrained badge only when `excludedAccountIds` proves an account needs attention.
- Pressing the card opens the existing `/accounts` route.

## Recent Transactions

- Replace the single grouped container with a vertical stack of independent pressable cards.
- Keep transaction order, limit, navigation, amount formatting, masking, and financial meaning unchanged.
- Use the transaction title as the primary label and a localized system-category label plus existing date as secondary content.
- Choose the icon from the existing `categoryId`, with transaction-type and generic-category fallbacks; do not load additional data.
- Use semantic theme surfaces, borders, financial colors, and mirrored RTL layout.

## Validation

- English LTR and Arabic RTL render the same information hierarchy.
- Income remains green, expense remains red, and hidden values remain masked.
- Each card remains independently clickable and opens the same existing destination.

