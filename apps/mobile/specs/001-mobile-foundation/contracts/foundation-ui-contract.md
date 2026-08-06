# UI Contract: Mobile Product Foundation

This contract defines behavior observable by users and later feature specifications. It does
not define production network endpoints.

## 1. Capability Contract

Every feature must declare:

- One primary user outcome.
- Scope classification: Core V1, platform-specific V1, Post-MVP, or excluded.
- Supported platforms.
- Required optional permissions.
- Manual fallback for every automated essential outcome.
- Relevant frontend states and recovery actions.

**Invariant**: excluded and Post-MVP capabilities never appear as active Core V1 navigation
or actions.

## 2. Platform Contract

| Situation | Android | iOS |
|---|---|---|
| Automatic SMS tracking | Education, consent, permission, status, pause, recovery | Not shown or promised |
| Permission declined | Manual and voice paths remain usable | Not applicable to SMS |
| Alternative capture | Manual and voice | Manual, voice, and approved iOS-assisted paths |
| Product quality | Complete Masarifi experience | Complete Masarifi experience |

Platform checks must be resolved by an adapter before rendering a capability. Components must
not infer support from platform name alone.

## 3. Permission Contract

Before an operating-system prompt, the interface provides:

1. Permission name and requested access.
2. User benefit.
3. Data-use explanation.
4. Effect of declining.
5. Continue and skip actions.

After a result, the interface provides the matching recovery or disable action. Optional
permissions never make the application unusable.

## 4. Financial Change Contract

| Change state | Required visible behavior |
|---|---|
| Clear automatic result | Source, immediate feedback, and undo or edit |
| Ambiguous/conflicting result | Review state; no silent record change |
| Duplicate possibility | Comparison and explicit keep/merge/ignore choice |
| Assistant proposal | Exact preview and explicit confirmation |
| Failed result | Plain-language reason and next action |
| Corrected or undone | Updated state and confirmation |

Every automatic addition must remain traceable to its source. Raw provider payloads and errors
must not be exposed.

## 5. Sensitive Display Contract

- In-app financial values require an authenticated session.
- The persistent hide-balances preference masks amounts across in-app surfaces.
- Lock-screen notifications never reveal sensitive amounts.
- App-switcher previews mask sensitive financial content.
- Reveal actions must be explicit and accessible.
- Analytics events must not contain financial amounts or sensitive identifiers.

## 6. Offline and Synchronization Contract

1. Validate a manual entry before local persistence.
2. Save it locally and show `pending sync` immediately.
3. Permit edit or deletion before confirmed synchronization.
4. On retry, show `syncing` without blocking unrelated navigation.
5. On success, show `synced` only after confirmation.
6. On failure or conflict, preserve the local entry and offer a clear recovery action.

## 7. Localization Contract

- Every message key resolves in Arabic and English.
- Arabic uses RTL layout; English uses LTR layout.
- Directional navigation icons mirror; universal and brand icons do not.
- Financial numbers and dates use English numerals and locale-aware formatting.
- Mixed-direction identifiers preserve readable direction.
- Truncation must not hide amounts, statuses, or actions.

## 8. Accessibility Contract

- Interactive targets are at least 44 by 44 pixels.
- Controls have programmatic names, roles, states, and accessible error text.
- Reading and focus order follow the active language direction.
- Dynamic type cannot hide critical financial values or actions.
- Status and financial meaning include text or icon cues beyond color.
- Reduced motion removes non-essential motion without hiding information.
- Haptics and illustrations are never required to understand an outcome.

## 9. Design-System Contract

- Feature components consume semantic or component tokens only.
- Raw brand colors are prohibited outside the token adapter.
- Light and dark themes preserve financial and system-state distinctions.
- Teal is the primary interaction family; bronze remains a restrained accent.
- Borders are preferred over decorative shadows for standard cards.
- Every reusable component declares responsive, RTL, accessibility, content, token, and state
  behavior.

## 10. Frontend State Contract

Every asynchronous surface selects relevant states from the canonical `FrontendState` model.
At minimum, a Core V1 async journey demonstrates loading, success, empty, error, and offline.
Permission and synchronization states are added when the capability uses them. Error states
must provide a user action and never display stack traces.

## 11. Scope Contract

The foundation may expose only a validation harness. Auth, dashboard, transaction, tracking,
voice, salary, budget, obligation, savings, report, notification, assistant, subscription,
profile, and support screens are implemented by their dedicated specifications.

Camera entry, receipt capture or scanning, investments, customer web dashboard behavior, and
production provider behavior are prohibited in Core V1.
