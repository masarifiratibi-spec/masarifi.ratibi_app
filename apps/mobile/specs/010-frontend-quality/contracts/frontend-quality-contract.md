# Frontend Quality Contract

This contract defines cross-feature guarantees for SPEC-010. Feature contracts remain canonical;
this document does not create a second service API.

## 1. Ownership Contract

For every server- or platform-shaped capability, the delivery inventory MUST identify:

- stable capability name and major version;
- one domain/feature owner;
- client contract path;
- deterministic mock provider path;
- platform provider path where applicable;
- repository or protected-storage owner when durable;
- Query scopes for server-shaped projections;
- allowed Zustand/local state, limited to shell, preference, draft, recording, undo, or temporary UI;
- routes/screens consuming the capability;
- unavailable, denied, offline, and safe recovery outcomes.

Routes and presentation components MUST NOT read SQLite, call provider SDKs, or independently
calculate authoritative financial effects.

## 2. Contract Compatibility

- A provider declares the capability and major version it implements.
- A client selects only a provider supporting its required major version.
- Adding an optional output field or a new backward-compatible union member may retain the major
  when existing clients preserve their behavior.
- Removing/renaming fields, changing meaning, strengthening input requirements, weakening output
  guarantees, or changing side effects requires a new major.
- A new major includes a migration note, both-version compatibility fixtures during transition,
  and an explicit cutover; no silent fallback to an incompatible provider is allowed.

## 3. Command and Replay Contract

Every financially effective command carries:

```text
operationId: stable unique identifier
expectedVersion: current owner version when mutable
input: validated domain command
```

Rules:

1. The first attempt claims `operationId` before awaiting owner work.
2. Concurrent identical attempts share the in-flight result.
3. Success persists or reconstructs one immutable result reference before returning.
4. Repeating a successful operation returns the exact prior result and does not invoke the owner.
5. Failure clears only the in-flight claim so the same operation may retry.
6. A retry may not change the operation kind, target, expected version, or committed result.
7. No presentation or query layer may fabricate success before the owner succeeds.

## 4. Conflict Contract

- Detection preserves both complete validated candidates and their versions.
- The UI shows a safe comparison and each candidate's financial effect.
- No automatic merge, last-write-wins, or silent overwrite is permitted.
- The user explicitly chooses an allowed resolution.
- Resolution is a version-checked replay-safe command.
- `keep_both` is available only when domain uniqueness and duplicate rules permit two records.
- Cancel/offline/failure leaves the conflict and both candidates unchanged.

## 5. Scenario and Reset Contract

- The scenario manifest composes existing domain fixture builders; it does not duplicate their
  records in static snapshots.
- Each profile has a fixed clock, stable IDs, valid relationships, expected routes/states, and
  documented density.
- Scenario selection/reset is development/test-only and requires an explicitly disposable profile.
- Reset deletes only fixture-owned records in that profile, clears relevant Query/local transient
  state, then seeds through existing owners.
- Two reset-and-seed cycles produce equivalent observable state.
- Reset refuses normal user profiles and never becomes a production account-delete mechanism.

Required named coverage: new, empty, typical, multi-account, salary/no-salary, budget within/near/
over, debt/installment/overdue, savings active/completed, automatic/voice/manual, duplicate,
failed/refund/salary/installment event, low confidence, assistant insight, report delivery success/
failure, permission denied, offline, pending, conflict, stale, disabled, read-only, dense, and
recovery.

## 6. Offline and Synchronization Contract

- A local draft is validated and retained before a sync attempt.
- `pending`, `failed`, `conflict`, and `synced` are user-visible truths; only owner confirmation may
  set `synced`.
- Retry reuses the operation ID and preserves user input.
- Reconnect may trigger retry but may not overwrite an unresolved conflict.
- Query invalidation occurs only after the owner commits, targets affected projections, and never
  refreshes immutable historical snapshots.
- Optional request delay/failure cannot block primary navigation or manual capture.

## 7. Safe Error Contract

User-facing errors use a finite code and applicable recovery:

| Outcome | Required recovery |
|---|---|
| transient unavailable | Retry |
| offline with safe local support | Save locally or retry after connection |
| permission denied | Education or open settings |
| ambiguous/low-confidence | Review manually |
| stale/version conflict | Show both versions and resolve |
| unsupported platform capability | Continue with manual/voice alternative |
| unrecoverable feature failure | Contact support without raw details |

Raw stack, provider, database, credential, or sensitive content is never rendered, logged, emitted,
or retained as evidence.

## 8. Localization and Accessibility Contract

- Every user string, state, error, notification action, chart summary, and accessibility label has
  Arabic and English catalog entries.
- Arabic uses logical RTL layout/focus; English uses LTR; directional icons mirror only when
  meaning requires it.
- Financial numbers/dates use approved English numerals and unambiguous locale-aware formatting.
- Controls expose name, role, state, persistent label, correction text, and a 44 by 44 target.
- Core routes remain operable on a 320 by 568 viewport at 200% text, with keyboard and long Arabic
  content.
- Hidden values are not present in accessible labels or native notifications.
- Status/charts remain understandable without color/motion; motion respects reduced-motion.
- Charts expose a text summary and navigation to supporting records.

## 9. Analytics and Privacy Contract

- Event names and keys are finite allowlists.
- Construction copies only allowed fields into a fresh payload and freezes payload plus envelope.
- Extra keys are rejected.
- Forbidden content: amounts, balances, account/transaction IDs, message/notification bodies,
  transcripts, assistant questions/answers, support text, credentials, raw errors, and provider
  payloads.
- Source, configuration, logs, output, and evidence are scanned before delivery.

## 10. Validation Evidence Contract

Every case records:

```text
id; FR/SC references; kind; date; environment/device; procedure or command;
expected outcome; actual non-sensitive summary; pass/fail/blocked; evidence paths
```

Blocked cases include the missing prerequisite. Native/participant requirements cannot be passed
by automation. Evidence paths are workspace-relative and captured artifacts must be safe to retain.

## 11. Release Gate Contract

Required gates: architecture, behavior/regression, persistence, localization, accessibility,
privacy, visual states, performance, Android native, iOS native, participant study, and final
end-to-end consistency.

- All required cases pass → gate passes.
- Any required case fails → gate fails and closure is prohibited.
- Any required case blocks → gate blocks closure unless a current product-owner exception exists.
- Exception fields: blocked gate, concrete risk, approver, accountable owner, expiry, and required
  follow-up evidence.
- An exception never converts failure to pass and expires automatically on its date.

## 12. Performance Contract

- Warm once before recorded measurement and document hardware/runtime.
- Returning-user useful shell: under 2 seconds in at least 95% of approved runs.
- 1,000-record transaction/notification list: useful content under 2 seconds and fewer than 100
  mounted content rows.
- Pagination uses stable total ordering and returns no duplicate/missing rows as data changes.
- Delayed optional dashboard/report/assistant requests do not prevent navigation/manual capture.
- Logs from performance runs contain no protected source content.

## 13. Platform Acceptance Contract

Android proof covers sign-in, tracking education and permission outcomes, clear/uncertain capture,
cross-feature updates, local/in-app notification, foreground/background/cold responses, View/Edit/
Undo and expired fallback, unlock/revalidation, correction, offline retry, languages, themes, 200%
text, small/large layouts, hidden values, and TalkBack.

iOS proof on macOS/Xcode covers sign-in, manual/voice alternative, the same downstream financial/
notification/assistant/correction outcomes, platform-unavailable messaging, themes, languages,
200% text, hidden values, and VoiceOver. It explicitly verifies that no direct-SMS promise or
permission UI appears.

## 14. Participant Contract

- Minimum 12 participants: six Arabic and six English.
- At least four are regular screen-reader users, with Arabic and English both represented.
- Report only anonymous aggregate task completion and 1–5 trust/recoverability ratings.
- At least 90% complete the selected core task without help at 200% text using assigned assistive
  navigation, and at least 90% rate clarity/trust/recoverability at 4 or 5.
- Automated results do not count as participants.
