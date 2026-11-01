# Automatic message tracking implementation

Approved in chat: deterministic rules first, Android background capture, normal ledger cards and existing UI, AI disabled, SEK recognized but held for review. Screenshot evidence is primary; samples below are sanitized and supplemental cases are explicitly synthetic.

- [x] T1. Preserve seven distinct screenshots / nine wording families in the bilingual evidence inventory. Images 7–10 are the same screenshot, not independent evidence.
- [x] T2. Versioned governed rules, compatible atomic offline snapshots, bounded operators and rollback.
- [x] T3. Deterministic direction/subtype/status, monetary roles, account binding, merchant boundaries and time provenance.
- [x] T4. Durable transport identities and notification revisions, stable SMS pagination, encrypted owner queue, server reservation.
- [x] T5. Authoritative eligibility and normal ledger operations; pending or ambiguous events enter review, not income/expense by guess.
- [x] T6. Android WorkManager/headless processing, secure authentication bootstrap, fair capture and recovery, owner/consent fencing.
- [x] T7. Refresh after confirmed item saves and one durable notification per server event, with existing navigation.
- [x] T8. Local regression, migration, native compilation and recovery validation; document remaining release gates and resolve review findings.

Release gates remain open:

- [ ] Physical Android device: process death, reboot, Doze, revoked permissions, owner/source changes, Keystore recovery, channel concurrency, notification revisions and one confirmation with correct tap navigation.
- [ ] Run the backend container image when Docker is available.
- [ ] Activate automatic mode only after release acceptance evidence. The migration seeds review mode; no deployment or shared database write was performed.

Implementation and validation evidence: `docs/handoffs/2026-10-09-tracking-implementation-evidence.md`. Screenshot wording and bilingual assets: `docs/handoffs/2026-10-09-tracking-evidence-inventory.md`.

Acceptance: no background or foreground false success before a confirmed ledger save; retries cannot duplicate a ledger effect; distinct same-amount transactions survive; failure/admin/OTP/promo never save; unresolved candidates are retained; no AI calls. No staging or production deployment is authorized by this local implementation request.

Safety contracts: direction, subtype and lifecycle are separate. Amount, balance, fee and FX roles are separate. Explicit unmatched/conflicting instruments cannot fall back to the default account. Provider bill account numbers are not bank instruments. Embedded ambiguous dates require review. Generic credit and card funding are not earned income. Own-account transfers need both accounts; withdrawals need a known cash destination; refunds/reversals need an original transaction. Unsupported currency enters review. Similarity is a review signal, not canonical duplicate proof.

Governance: immutable releases with schema/engine compatibility and hash; stable rule keys; enabled/priority/locale/country/provider applicability; typed bounded DSL; corpus validation before publish; recent-auth/RBAC/audit; pointer rollback only. Complete snapshots include user overrides and source trust, with an atomic last-known-good cache. Missing/incompatible configuration retains candidates for review.
