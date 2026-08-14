# Contract: Salary, Budgets, Obligations, Debts, Installments, and Savings

This contract defines user-visible routes and typed boundaries between SPEC-007 features, the
deterministic frontend adapter, Core Finance, and local storage. It is not an HTTP API and does
not define production banking, rates, reminders, notifications, providers, or synchronization.

## 1. Route Contract

| Route | Responsibility |
|---|---|
| `/salary` | Current salary-cycle summary, configured profile, differences, and recovery states |
| `/salary/setup` | Create or edit the primary salary profile and durable draft |
| `/salary/review/[id]` | Review an unusual, conflicting, or duplicate detected salary |
| `/budgets` | Current month overview, month selection, copy/create entry, and states |
| `/budgets/new` | Create or copy an editable monthly budget draft |
| `/budgets/[id]` | Monthly and category progress, forecast, alerts, allocation, and related transactions |
| `/budgets/[id]/edit` | Edit limits, targets, rollover, and status |
| `/obligations` | Overview plus Installments and Loans, Debts, Recurring Bills, Subscriptions, Upcoming Payments, and Payment History |
| `/obligations/new` | Type-aware obligation creation and durable draft |
| `/obligations/[id]` | Detail, progress, schedule, history, linked transactions, matching, and lifecycle actions |
| `/obligations/[id]/edit` | Obligation editing with impact preview |
| `/obligations/[id]/payment` | Full, partial, over, early, correction, and settlement preview/confirmation |
| `/obligations/review/[id]` | Ambiguous or duplicate payment-match review |
| `/savings` | Active, paused, completed, archived, and emergency-fund goals |
| `/savings/new` | Goal creation and durable draft |
| `/savings/[id]` | Progress, contribution history, monthly need, and lifecycle actions |
| `/savings/[id]/movement` | Contribution or withdrawal preview and confirmation |
| `/modals/planning-conflict` | Compare local and later planning snapshots and choose one |

These are secondary routes. Home, Transactions, Add, Reports, and More remain the five primary
tabs. Home, More, profile completion, tracking review, voice review, and linked transactions may
open these routes. Route files remain thin and never access SQLite directly.

## 2. Typed Service Boundary

The implementation provides one replaceable contract equivalent to:

```ts
interface FinancialPlanningService {
  getPlanningOverview(input: PlanningOverviewInput): Promise<PlanningOverview>;

  getSalaryOverview(input: SalaryOverviewInput): Promise<SalaryOverview>;
  getSalaryReceiptReview(transactionId: string): Promise<SalaryReceiptReview>;
  saveSalaryProfile(
    input: SalaryProfileInput,
    operationId: string
  ): Promise<MutationResult<SalaryProfile>>;
  confirmSalaryReceipt(
    input: SalaryReceiptConfirmation,
    operationId: string
  ): Promise<MutationResult<SalaryReceiptOutcome>>;
  undoSalaryReceipt(
    receiptId: string,
    operationId: string
  ): Promise<MutationResult<SalaryReceiptOutcome>>;

  getBudget(periodKey: string): Promise<BudgetDetail | null>;
  createBudgetDraftFromPrevious(periodKey: string): Promise<PlanningDraft>;
  saveBudget(
    input: BudgetInput,
    operationId: string
  ): Promise<MutationResult<Budget>>;
  previewBudgetMove(input: BudgetMoveInput): Promise<BudgetMovePreview>;
  confirmBudgetMove(
    previewId: string,
    operationId: string
  ): Promise<MutationResult<BudgetDetail>>;
  setBudgetStatus(
    id: string,
    expectedVersion: number,
    status: 'active' | 'paused',
    operationId: string
  ): Promise<MutationResult<Budget>>;
  deleteBudget(
    id: string,
    expectedVersion: number,
    operationId: string
  ): Promise<MutationResult<Budget>>;

  getObligationsOverview(input: ObligationOverviewInput): Promise<ObligationsOverview>;
  listObligations(input: ObligationQuery): Promise<ObligationPage>;
  getObligation(id: string): Promise<ObligationDetail>;
  createObligation(
    input: ObligationInput,
    operationId: string
  ): Promise<MutationResult<Obligation>>;
  updateObligation(
    id: string,
    expectedVersion: number,
    input: ObligationInput,
    operationId: string
  ): Promise<MutationResult<Obligation>>;
  setObligationStatus(
    id: string,
    expectedVersion: number,
    status: ObligationLifecycle,
    operationId: string
  ): Promise<MutationResult<Obligation>>;
  previewObligationPayment(
    input: ObligationPaymentInput
  ): Promise<ObligationPaymentPreview>;
  confirmObligationPayment(
    previewId: string,
    allocation: PaymentAllocationChoice,
    operationId: string
  ): Promise<MutationResult<ObligationPaymentOutcome>>;
  reverseObligationPayment(
    paymentId: string,
    operationId: string
  ): Promise<MutationResult<ObligationPaymentOutcome>>;
  previewEarlySettlement(obligationId: string): Promise<EarlySettlementPreview>;
  confirmEarlySettlement(
    previewId: string,
    operationId: string
  ): Promise<MutationResult<ObligationPaymentOutcome>>;
  listPaymentMatches(input: PaymentMatchQuery): Promise<PaymentMatchPage>;
  getPaymentMatch(id: string): Promise<PaymentMatch>;
  resolvePaymentMatch(
    input: PaymentMatchResolution,
    operationId: string
  ): Promise<MutationResult<PaymentMatchOutcome>>;

  listGoals(input: GoalQuery): Promise<SavingsGoal[]>;
  getGoal(id: string): Promise<SavingsGoalDetail>;
  createGoal(
    input: SavingsGoalInput,
    operationId: string
  ): Promise<MutationResult<SavingsGoal>>;
  updateGoal(
    id: string,
    expectedVersion: number,
    input: SavingsGoalInput,
    operationId: string
  ): Promise<MutationResult<SavingsGoal>>;
  setGoalStatus(
    id: string,
    expectedVersion: number,
    status: SavingsGoalLifecycle,
    operationId: string
  ): Promise<MutationResult<SavingsGoal>>;
  previewGoalMovement(input: GoalMovementInput): Promise<GoalMovementPreview>;
  confirmGoalMovement(
    previewId: string,
    operationId: string
  ): Promise<MutationResult<GoalMovementOutcome>>;
  reverseGoalMovement(
    movementId: string,
    operationId: string
  ): Promise<MutationResult<GoalMovementOutcome>>;

  saveDraft(draft: PlanningDraft): Promise<PlanningDraft>;
  loadDraft(id: string): Promise<PlanningDraft | null>;
  discardDraft(id: string): Promise<void>;
  getConflict(id: string): Promise<PlanningConflict>;
  resolveConflict(
    id: string,
    resolution: 'keep_local' | 'keep_later'
  ): Promise<MutationResult<PlanningRecord>>;
}
```

Reuse Core Finance `MoneyValue`, `SyncStatus`, `MutationResult`, `TransactionInput`, transaction
source semantics, and exchange-estimate contract. Do not redefine those values in planning.

## 3. Input and Preview Contract

- Input schemas validate safe minor units, currency codes, local dates, account/category
  eligibility, schedule consistency, and lifecycle permissions before a write begins.
- Obligation input is discriminated by `fixed_term`, `open_ended`, or `irregular`; fields that do
  not apply to the selected kind are rejected rather than silently retained.
- Payment transaction intent is exclusive:

```ts
type PaymentTransaction =
  | { kind: 'create'; input: TransactionInput }
  | { kind: 'link'; transactionId: string };
```

- Payment case is derived by `previewObligationPayment`; the UI cannot label an amount full,
  partial, over, correction, or settlement without service validation.
- Overpayment confirmation requires one explicit `later_installments`, `principal`, or
  `correction` allocation.
- Goal movement accepts only an optional existing transaction or transfer link. It has no option
  to create an account transaction or change a balance.
- Preview methods are side-effect free and return a preview ID plus every affected amount,
  schedule item, lifecycle change, linked record, warning, and expected version.
- Confirm methods revalidate the preview and expected versions inside the write transaction.
  A stale preview returns `stale_preview`, preserves the draft, and changes nothing.
- Every financial or multi-record command requires a stable operation ID. Repeating a completed
  operation returns the original outcome without applying a second effect.

## 4. Calculation Contract

All derived values distinguish a real zero from unavailable:

```ts
type Calculation<T> =
  | {
      status: 'available';
      value: T;
      estimated: boolean;
      asOf: number | null;
    }
  | {
      status: 'unavailable';
      reason:
        | 'missing_data'
        | 'missing_rate'
        | 'insufficient_history'
        | 'salary_overdue';
    };
```

- Salary receipt links, not projections, define actual cycles.
- Budget progress derives from eligible ledger effects and follows [data-model.md](../data-model.md).
- Missing currency estimates make the affected budget calculations incomplete.
- Open-ended obligations contribute only confirmed due/overdue occurrences.
- Obligation totals derive from opening paid value, active payments, allocations, and explicit
  settlement adjustments.
- Goal progress derives from opening tracked value and active movements only.
- No route or component recalculates financial rules independently.

## 5. Atomic Financial Mutation Contract

- Input and preview versions are validated before opening the write transaction and revalidated
  inside it.
- The existing exclusive SQLite transaction coordinates planning writes and the narrow Core
  Finance ledger write seam.
- A newly recorded obligation payment creates exactly one ledger transaction and one planning
  payment with allocations, or writes nothing.
- Linking an existing transaction writes only the planning relationship and allocation; it does
  not duplicate the ledger transaction.
- Undo of an owned transaction voids the transaction and payment together. Undo of a linked
  existing transaction removes only the planning link.
- Salary link/undo and detected payment link/undo update every derived scope together.
- Corrections preserve the prior record and point to the replacement.
- Recompute from surviving canonical records after undo, reversal, correction, or unlink; do not
  reverse cached totals arithmetically.
- Preview, cancellation, review-only, or failed validation invalidates no query and has no
  financial effect.

## 6. Query Ownership and Invalidation

TanStack Query owns service-shaped reads:

- `planning.overview(profileCurrency, date)`
- `planning.salary.overview(date)` and `planning.salary.review(id)`
- `planning.budget(periodKey)`
- `planning.obligations.overview(filters)`
- `planning.obligations.list(filters, cursor)` and `planning.obligation(id)`
- `planning.paymentMatches(filters, cursor)` and `planning.paymentMatch(id)`
- `planning.goals.list(status)` and `planning.goal(id)`
- `planning.conflict(id)`

SQLite owns confirmed records and durable drafts. Zustand may own only temporary filter,
section, or preview presentation. Planning records are never mirrored in Zustand.

Successful mutations return exact affected scopes. Linked financial effects include applicable
Core Finance scopes such as Home, Transactions, transaction detail, and account detail plus
planning Salary, Budget, Obligation, Goal, and Home-preview scopes.

## 7. Offline, Sync, and Conflict Contract

- Meaningful drafts are persisted locally and survive interruption or recoverable failure.
- Eligible manual profile, budget, obligation, payment, and goal commands commit locally once and
  become `pending` sync. Pending and failed linked payments affect local totals exactly once.
- Review items and unavailable calculations affect no financial totals.
- Failed sync leaves the local record editable and provides retry.
- Conflicts preserve local and later snapshots. Dismissal, timeout, reconnect, or last-write-wins
  behavior may not select either snapshot.
- While a record conflicts, use the last trustworthy synced version for summaries and label the
  result partial/conflicted; never count both snapshots.
- Planning conflicts allow `keep_local` or `keep_later`. `keep_both` is excluded because it can
  duplicate a unique monthly/category budget or financial effect.
- Resolution reruns current validation, commits one selected snapshot, and returns it to pending
  sync.

## 8. Data, Sync, and Lifecycle States

Keep independent dimensions rather than one combined status:

- Data: `ready`, `empty`, `partial`, `stale`, `offline`.
- Sync: existing `pending`, `syncing`, `synced`, `failed`, `conflict`.
- Lifecycle: entity-specific salary, budget, obligation, and savings states.
- Derived financial status: overdue, threshold, exceeded, target reached, or incomplete.

## 9. Error Contract

```ts
type FinancialPlanningErrorCode =
  | 'validation'
  | 'not_found'
  | 'archived'
  | 'read_only'
  | 'review_required'
  | 'duplicate'
  | 'conflict'
  | 'offline_unavailable'
  | 'stale_preview'
  | 'unknown';
```

- `validation`: preserve input, focus the exact field, and show a localized correction.
- `not_found`, `archived`, `read_only`: explain state and return to a valid destination.
- `review_required`, `duplicate`: open comparison/review without a financial effect.
- `conflict`: preserve both snapshots and open explicit resolution.
- `offline_unavailable`: preserve draft and offer an eligible local/manual alternative.
- `stale_preview`: reload the preview while retaining entered data.
- `unknown`: provide retry and safe exit; never show raw SQLite/provider content.
- Missing rates or history are calculation states, not thrown errors.

## 10. Automatic and Voice Integration

- Android tracking may pass a clear confirmed salary or obligation-payment transaction to this
  service. The planning service links it atomically and returns view/edit/undo scopes.
- Zero, multiple, conflicting, or duplicate matches remain in the existing review flow and do
  not change planning records.
- Voice may pass an explicitly confirmed existing/new obligation intent or payment relationship.
  Voice does not own obligation persistence.
- iOS receives manual, voice, and approved platform-assisted inputs only; no route or contract
  implies direct SMS access.
- Undo/correction propagates through both the original capture source and planning scopes.

## 11. Privacy, Localization, and Accessibility

- Use only Arabic/English catalog keys; no feature-local user-facing strings.
- Use locale-aware formatters with English numerals and intentional mixed-direction boundaries.
- Global hide-values behavior applies visually, accessibly, in notifications, and in app previews.
- Cards and rows announce coherent financial meaning, not fragmented labels.
- Status, thresholds, progress, due state, and matching reasons use text and semantics, not color,
  icon, animation, chart, or haptic feedback alone.
- Forms preserve labels, validation, focus order, keyboard access, 200% text, 44 by 44 targets,
  and reduced motion.
- Provider keywords, account hints, notes, snapshots, and amounts never enter analytics, console
  logs, raw errors, or production credentials.

## 12. Boundary and Verification Contract

Add one planning boundary check that rejects:

- direct SQLite imports outside `src/storage`;
- raw colors or hard-coded planning UI strings;
- production provider/secret references;
- sensitive financial logging;
- planning entity storage in Zustand;
- account-balance mutation from goal-movement code;
- unsupported iOS SMS claims.

Focused tests prove calculations, validation, state transitions, migration, atomicity,
idempotency, query scopes, routes, privacy, localization, access, and representative native
behavior. No new test framework is introduced.
