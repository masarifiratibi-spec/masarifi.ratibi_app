# Contract: Notifications, Assistant, Subscriptions, Settings, and Support

This contract defines user-visible routes and typed boundaries between SPEC-009, existing
financial owners, local notification presentation, protected settings, and durable local storage.
It is not an HTTP API and does not define remote push, production AI, payment processing, support
operations, account deletion, or data-export delivery.

## 1. Route Contract

| Route | Responsibility |
|---|---|
| `/notifications` | Filtered, grouped, virtualized notification center; unread state, safe target fallback, and bulk read actions |
| `/notifications/preferences` | Phone permission state, category choices, quiet hours, summaries, and lock-screen privacy |
| `/assistant` | Assistant home, consent, suggested questions, new conversation, history entry, privacy, usage-limit and error states |
| `/assistant/[conversationId]` | Virtualized conversation, structured responses, evidence links, rename/delete, feedback, and new questions |
| `/assistant/[conversationId]/actions/[previewId]` | Current action preview, edit, confirmation, stale/expired handling, result, and owning destination |
| `/subscriptions` | Current plan, Free/Basic/Premium comparison, limits, trial, renewal, expiry, restore, and management entry |
| `/subscriptions/checkout` | One reviewed deterministic purchase/trial/change operation and result |
| `/profile` | Profile values, completion, identity-owner links, and settings destinations |
| `/profile/application` | Device-local language, theme, week, default, dashboard, tracking, voice, report, and notification settings links |
| `/profile/privacy` | Tracking/assistant/analytics controls, privacy explanation, export request, account-deletion request, and local-data deletion entry |
| `/security/settings` | Existing PIN, biometrics, auto-lock, and sole global hidden-balance control |
| `/security/sessions` | Representative session list, current session, single/all revocation, pending/failure states |
| `/security/events` | Security event history and recovery destinations |
| `/support` | Searchable FAQ/help/What's New plus ticket/history and feedback entries |
| `/support/new` | Typed ticket, feedback, transaction-report, or assistant-report form with durable draft |
| `/support/tickets` | Ticket list and states |
| `/support/tickets/[id]` | Ticket detail, reply, and resolved-ticket rating |

Routes remain thin. They do not access SQLite, calculate finance, contain provider calls, apply a
notification action, or claim external success. Dynamic protected destinations are sanitized and
pass through the existing unlock route before revalidation.

## 2. Shared Contract Shapes

```ts
interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

interface MutationResult<T> {
  value: T;
  affectedScopes: readonly string[];
  operationId?: string;
}
```

Existing `MutationResult<T>` remains authoritative. Service errors expose a safe category and
localized recovery key, never a provider object or user financial content.

## 3. Notification Service Boundary

```ts
interface NotificationListQuery {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  cursor?: string;
  pageSize?: number;
}

interface NotificationService {
  list(input: NotificationListQuery): Promise<Page<NotificationEvent>>;
  get(id: string): Promise<NotificationEvent>;
  createFromSource(input: NotificationSourceEvent): Promise<NotificationEvent>;
  markRead(id: string, read: boolean): Promise<MutationResult<NotificationEvent>>;
  markAllRead(filter: NotificationListQuery, operationId: string): Promise<MutationResult<number>>;
  delete(id: string, operationId: string): Promise<MutationResult<{ id: string }>>;
  getPreferences(): Promise<NotificationPreferences>;
  savePreferences(input: NotificationPreferencesInput, expectedVersion: number, operationId: string): Promise<MutationResult<NotificationPreferences>>;
  refreshPermission(): Promise<NotificationPermissionState>;
  requestPermissionAfterEducation(): Promise<NotificationPermissionState>;
  resolveTarget(id: string): Promise<NotificationTargetResolution>;
  revalidateAction(id: string, action: NotificationActionKind): Promise<NotificationActionResolution>;
  executeAction(id: string, action: NotificationActionKind, operationId: string): Promise<MutationResult<NotificationActionResult>>;
}
```

- `createFromSource` deduplicates by source-event key.
- Delete affects only NotificationEvent.
- `resolveTarget` returns exact, fallback, unavailable, or unlock-required; it never returns an
  arbitrary route.
- `executeAction` is called only after app unlock and fresh `revalidateAction` success. Finance
  changes route through the canonical owner and its operation/version contract.
- Mark-all-read applies to the visible filter and one operation ID.

## 4. Phone Notification Adapter Boundary

```ts
interface PhoneNotificationService {
  getPermission(): Promise<NotificationPermissionState>;
  requestPermission(): Promise<NotificationPermissionState>;
  registerCategories(): Promise<void>;
  presentLocal(input: PhoneNotificationPresentation): Promise<PhonePresentationResult>;
  getLastResponse(): Promise<PhoneNotificationResponse | null>;
  subscribeToResponses(listener: (response: PhoneNotificationResponse) => void): () => void;
  openSystemSettings(): Promise<void>;
}
```

- Production adapter uses `expo-notifications` only for permission, local presentation,
  categories, and responses. It never requests a push token.
- Native content is already privacy-filtered and contains only the notification ID as data.
- The root response controller handles cold-start last response and live responses once.
- The deterministic adapter supplies granted, denied, permanently denied, restored, presented,
  action, expired, and failed scenarios to tests and non-native previews.

## 5. Notification Policy Contract

Policy input contains event category/type/sensitivity, user preferences, actual permission,
profile timezone, current local time, global hidden-balance state, and summary window.

Policy output is one of:

```text
present_local | defer_quiet_hours | include_daily_summary | include_weekly_summary |
suppress_category | suppress_phone_disabled | suppress_permission | suppress_private
```

- In-app creation occurs regardless of phone outcome.
- Quiet hours may cross midnight. Only new-session, session-revocation, and access-protection
  events may bypass.
- An event cannot be both presented individually and emitted again as a new summary event.
- Hidden-value policy rewrites title/body/action accessibility content before it reaches native
  presentation; visual masking alone is insufficient.

## 6. Assistant Service Boundary

```ts
interface AssistantConversationQuery {
  cursor?: string;
  pageSize?: number;
  status?: 'active' | 'deleted';
}

interface AssistantService {
  getConsent(): Promise<AssistantConsent>;
  setConsent(enabled: boolean, expectedVersion: number, operationId: string): Promise<MutationResult<AssistantConsent>>;
  listConversations(input: AssistantConversationQuery): Promise<Page<AssistantConversation>>;
  createConversation(input: { question: string }, operationId: string): Promise<MutationResult<AssistantConversation>>;
  getConversation(id: string, cursor?: string): Promise<{ conversation: AssistantConversation; responses: Page<AssistantResponse> }>;
  ask(conversationId: string, question: string, operationId: string): Promise<MutationResult<AssistantResponse>>;
  renameConversation(id: string, title: string, expectedVersion: number, operationId: string): Promise<MutationResult<AssistantConversation>>;
  deleteConversation(id: string, expectedVersion: number, operationId: string): Promise<MutationResult<{ id: string }>>;
  setResponseFeedback(responseId: string, feedback: AssistantResponseFeedback, operationId: string): Promise<MutationResult<AssistantResponse>>;
  getActionPreview(id: string): Promise<AssistantActionPreview>;
  updateActionPreview(id: string, input: AssistantActionInput, expectedVersion: number): Promise<AssistantActionPreview>;
  confirmAction(id: string, expectedVersion: number, operationId: string): Promise<MutationResult<AssistantActionPreview>>;
  cancelAction(id: string, expectedVersion: number, operationId: string): Promise<MutationResult<AssistantActionPreview>>;
}
```

### Canonical context boundary

- Core Finance supplies confirmed transactions/accounts/categories and completeness evidence.
- Financial Planning supplies salary, budgets, obligations, payments, and savings through its
  typed service, never its repository.
- Reports supplies report-backed answers/snapshots; Assistant does not recalculate reports.
- Pending local user-confirmed data may be included once and labeled. Review-required and
  unresolved conflict candidates are excluded and reported as incomplete context.
- Each response persists its exact safe context snapshot and as-of time. Old responses never
  refresh; new questions read current confirmed context.

### Action boundary

- `ask` may create only a preview, never a financial change.
- `confirmAction` compares current owner versions with the preview. Mismatch returns stale and
  requires review.
- A current preview invokes the owner service exactly once with the stable operation ID.
- Navigation-only actions may resolve without a mutation but still use typed destinations.

## 7. Subscription Service Boundary

```ts
interface SubscriptionService {
  getCatalog(): Promise<SubscriptionOfferCatalog>;
  getState(): Promise<SubscriptionState>;
  getOperation(id: string): Promise<SubscriptionOperation>;
  startOperation(input: SubscriptionOperationInput, expectedVersion: number, operationId: string): Promise<MutationResult<SubscriptionOperation>>;
  completeMockOperation(operationId: string, outcome: 'success' | 'failure' | 'cancelled'): Promise<MutationResult<SubscriptionOperation>>;
}
```

- Checkout captures one catalog version and reviewed offer. A changed catalog returns conflict
  before confirmation.
- Entitlement changes only after success. Failure/cancel retains prior state.
- Replayed operation IDs return the original operation.
- Restore never creates a duplicate entitlement.
- Downgrade/expiry changes paid-only artifacts to read-only; it never deletes them or core finance.
- Every checkout/result screen states that the outcome is representative in this phase.

## 8. Settings and Security Service Boundary

```ts
interface SettingsService {
  getProfile(): Promise<UserProfile>;
  saveProfile(input: UserProfileInput, expectedVersion: number, operationId: string): Promise<MutationResult<UserProfile>>;
  listSessions(): Promise<RepresentativeSession[]>;
  revokeSession(sessionId: string, operationId: string): Promise<MutationResult<RepresentativeSession>>;
  revokeAllSessions(operationId: string): Promise<MutationResult<RepresentativeSession[]>>;
  listSecurityEvents(cursor?: string): Promise<Page<SecurityEvent>>;
  requestPrivacyAction(kind: 'data_export' | 'account_deletion', operationId: string): Promise<MutationResult<PrivacyRequest>>;
  deleteLocalData(operationId: string): Promise<MutationResult<LocalDataDeletionResult>>;
}
```

- Device-local application preferences continue through the existing protected preference store;
  this service does not duplicate them.
- Phone/Google identity edits redirect to existing authentication ownership.
- Session revocation clears local authentication only after representative success. Sign-out-all
  uses the existing AuthService boundary, not a direct Zustand reset.
- Privacy requests return accepted/pending/failed; they never claim a file or completed account
  deletion.
- Local-data deletion uses the allowlisted exclusive transaction in data-model.md. Query caches
  clear only after commit; rollback reports failure and preserves data.

## 9. Support Service Boundary

```ts
interface SupportService {
  searchArticles(input: { query: string; category?: string }): Promise<SupportArticle[]>;
  listTickets(cursor?: string): Promise<Page<SupportTicket>>;
  getTicket(id: string): Promise<SupportTicket>;
  saveDraft(input: SupportDraftInput): Promise<SupportDraft>;
  loadDraft(id: string): Promise<SupportDraft | null>;
  discardDraft(id: string): Promise<void>;
  submitDraft(id: string, operationId: string): Promise<MutationResult<SupportOperation>>;
  reply(ticketId: string, input: SupportReplyInput, expectedVersion: number, operationId: string): Promise<MutationResult<SupportOperation>>;
  rate(ticketId: string, rating: number, expectedVersion: number, operationId: string): Promise<MutationResult<SupportOperation>>;
}
```

- One form schema discriminates ticket, feedback, transaction report, and assistant report.
- Draft saves survive validation, navigation, restart, offline, and representative submission
  failure.
- Only submitted operations create/update visible ticket/report state.
- Rating requires resolved/closed state.
- Attachments are absent from DTOs, UI, and persistence.

## 10. Query Ownership and Invalidation

```text
notifications.list/filter/page
notifications.detail/id
notifications.preferences
assistant.conversations/page
assistant.conversation/id/page
assistant.response/id
assistant.action/id
assistant.context/current
subscriptions.catalog/version
subscriptions.state
subscriptions.operation/id
settings.profile
settings.sessions
settings.security-events/page
settings.privacy-request/id
support.articles/query
support.tickets/page
support.ticket/id
support.draft/id
```

- Finance/planning mutations that change confirmed financial context emit `reports.live` and
  `assistant.context` in addition to their existing scopes.
- Profile timezone/currency changes invalidate live reports, future report-schedule projection,
  assistant current context, and notification policy projection.
- Notification read/delete/preferences mutations invalidate only matching notification keys.
- Assistant historical responses, completed subscription operations, submitted support
  operations, and report output snapshots are immutable and never recomputed by live invalidation.
- Local-data deletion clears affected caches only after committed deletion.

## 11. Protected Navigation Contract

- Extend shell destination normalization for new static roots and typed dynamic destination
  builders; never accept a raw query or secret-bearing URL.
- Notification response -> local event ID -> trusted target resolution -> unlock when required ->
  source/action revalidation -> final route/action.
- If a target is removed/resolved/inaccessible, route to the nearest safe list/detail with a
  localized changed-state explanation.
- Cold-start and live response paths share one idempotent response controller.
- Phone quick actions never reveal or mutate protected content before the normal app unlock.

## 12. Privacy and Analytics Contract

SPEC-009 analytics uses a fixed event-name union and scalar category/outcome values only. The
boundary rejects, rather than silently drops:

- Amount/minor/currency-linked values and notification title/body.
- Assistant question, answer, snapshot, context, source IDs, or proposed values.
- Price tied to identity, email, phone, account/transaction IDs, or profile fields.
- PIN, credential, token, session secret, ticket subject/description/message, or nested object.

Phone content, app-switcher content, accessibility labels, errors, and logs use the same masking
policy. User-authored strings never enter analytics or raw errors.

## 13. Localization and Accessibility Contract

- All feature strings live in Arabic and English catalogs with prefix parity tests and genuine
  Arabic values.
- English numerals and locale-aware financial/date formatting remain authoritative.
- Mixed-direction names, prices, renewal dates, quiet-hour times, and ticket references have
  explicit reading order.
- Lists expose item count/position where useful and remain virtualized at 200% text.
- Consent, fact/estimate/suggestion, read state, category, price/period, renewal, warning,
  permission, success, and failure do not rely on color, motion, haptics, or illustration.
- Touch targets are at least 44 by 44 pixels; focus follows task order; reduced motion is honored.

## 14. Performance and Simulation Boundary

- Notification and assistant history accept pages and render with `FlatList`; the 1,000 + 1,000
  fixture shows first useful content within two seconds and mounts fewer than 100 rows.
- Filters, date grouping, unread counts, and search remain correct across page boundaries.
- Phone notification is a real local device presentation when permission is granted; all source
  event generation remains deterministic.
- AI generation/actions, purchase/restore, session catalogs/revocation, export/account deletion,
  and support outcomes remain deterministic representative adapters.
- No remote push token, AI key, payment secret, support credential, production endpoint, or
  service-role value may exist in the client.
