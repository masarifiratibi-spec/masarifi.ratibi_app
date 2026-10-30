# Same-owner continuation through T19a — in progress

The human resumed the remaining work on the existing branch, Redmi, owner, APK and Metro. This supersedes the previous bounded stopping point, while retaining the completed evidence and cancellation of ZIP. No new PDF output/download, provider request, feedback message or financial posting has been made in this continuation.

## Confirmed repairs

An actual unsent Assistant landing question disappeared after a cold restart. The landing and conversation inputs kept their text only in component state. They now use the existing protected owner storage, with separate landing, report-context and conversation scopes. Restore/save failures preserve the editor and offer retry. A successful acknowledgement only clears its matching revision; newer text survives. Owner changes, pending logout and data removal use the existing fences. A failing pending-write/removal regression led to serializing shell removal with protected writes, so an already pending write cannot recreate removed drafts. No native build, dependency, schema or authentication-policy change was needed.

On the same physical APK, a named unsent QA question survived force-stop/start through the existing Metro entry, appeared in the ordinary Assistant screen and activated the dirty-navigation prompt. Keep Editing retained it; explicit Discard then removed it, and ordinary re-entry showed the empty input. No Ask/provider action was invoked. Conversation isolation and owner/purge races were qualified locally; no second physical owner was introduced.

A separate cold-start Home read could fail in the locally restored session and remain failed after the same owner became remotely restored. A real provider/query-cache integration regression reproduced this, including an intermediate pending phase. Foundation now retires/refetches the existing safe read prefixes on that same-owner restoration transition. It neither clears nor replays the pending command. Actual cold-start observation subsequently reached the ready Home without a manual retry. This observation does not assert that every frame throughout startup was error-free.

## Actual report reads and open discrepancy

Four ordinary Reports reads—current/previous month, all accounts/existing QA cash account—matched independently calculated monthly income, expense and net cash flow from the unchanged local ledger. Existing trend controls were inspected and restored. These observations do not qualify absent refund, foreign-currency or card data.

Changing the ordinary month-start preference to 25 exposed a real deployed discrepancy: Reports requested 25 October–24 November, while the API returned 1–31 October. The client correctly rejected the mismatched range rather than displaying the wrong period's totals. Value-free temporary diagnostics established `report_range_mismatch` and the two ranges, then were removed byte-exact. The preference was restored to its original day 1. This custom-cycle live check remains failing; it must not be represented as accepted or bypassed with calendar-month totals. The pinned API artifact needs investigation and a concrete reviewed replacement before activation.

## Qualification and preservation

The affected draft set passed 201 cases in 13 suites. Its four UI integration cases passed again after moving the native-store integration test to the storage layer; the Assistant boundary scanner had correctly rejected SDK-write mocks inside the feature directory. No checker exclusion was added. The Home restoration/cache set passed 58 cases in six distinct suites. Full mobile TypeScript passed after that move. Exact changed-file lint has zero errors and one pre-existing conversation-effect dependency warning. Assistant, design-system and app-shell boundary checks passed. These scoped counts do not replace or enlarge the historical 62/69/88/29 acceptance denominators.

The fresh post-repair client checkpoint matched all five original draft/operation/financial/count projections exactly, including the invalid 2026-13 Budget draft. The same APK hash and Metro process remained in use; native capture producers stayed off. Private receipts retain actual device content, financial values and failures; none are included here. The previously verified styled offline popup, Reports content/dock separation, offline Salary/Obligations reads, saved PDF and single feedback lifecycle through Closed/version5 are reused without replay.

The remaining same-owner work and live custom-cycle discrepancy are still under investigation. Sole-SuperAdmin negative-role checks, real-owner erasure, native sensitive permissions, finite provider/financial windows and additional messages retain their specific boundaries. No substitute account, role assignment or actual-owner deletion is authorized by this continuation. Production and T20–T22 remain outside scope.
