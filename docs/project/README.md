> **تحديث توحيد الفروع — 28 نوفمبر 2026:** المرجع المستهدف للكود هو `main` مع فروع عمل مؤقتة. نسخة التوحيد قيد التأهيل في `codex/unify-platforms-on-main`؛ لا تعتبرها منشورة أو مدمجة قبل مراجعة [سجل القبول](single-main-acceptance.md). تعليمات الفروع الثلاثة والأرقام أدناه سجل تاريخي، وتُستبدل للعمل الجديد بـ[طريقة العمل والإصدار](release-workflow.md). [النسخ المنشورة المرصودة](deployed-versions.md) مستقلة عن حالة الكود.

# Masarifi maintained project guide

Start with the [release workflow](release-workflow.md), [acceptance gates](single-main-acceptance.md), [approved source inputs](single-main-inputs.md), and [candidate path decisions](single-main-decisions.csv). The approved target is one permanent `main` source branch for API, Admin, Android and iOS, with temporary feature branches.

Consolidation is being qualified in [draft PR 10](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/pull/10), from `codex/unify-platforms-on-main`. Until its acceptance gates pass and its tree is promoted, main remains the qualified baseline `81736959`. Do not infer a deployment from this PR or a successful source check. Historical operating, Play and iOS refs are preserved recovery references, not default destinations for new work after consolidation.

The candidate preserves current API runtime, Admin, packages, SQL, ops and Docker content. The API workflow-policy test and branch-governance document are updated for main. Mobile combines Android production Firebase configuration with Apple authentication, consent and Shortcuts. Zod stays on major 3. Android keeps its existing assistant and deletion flow; Apple-only consent keeps its future-review comment.

The following table records the earlier November 26 audit only. It is not the current branch instruction or a current store/runtime receipt.

| Role | Source reviewed | What differs |
|---|---|---|
| Operating base | `3a2b30c3` | Shared product and operating source, with the tracking setup guide updates. |
| Google Play | `dd6dd687` | Directly includes the operating base plus two mobile commits for production Firebase sender selection and localized tracking text alignment. |
| iOS | `844c960f` | Platform line shares ancestor `3fd103c7` with operating. Contains Apple authentication, Store signing/qualification and Shortcuts integration. |

The API, Admin, packages, ops and Supabase directories have identical Git trees on the three reviewed commits. Runtime receipts apply only to the artifact and environment they identify. See [Arabic project status](status-ar.md).


| Question | Start here |
|---|---|
| Which features work on which platform? | [Feature and acceptance matrix](features.md) |
| Where do requests and financial data go? | [System architecture](../architecture/current-system.md) |
| Which defects and release checks remain open? | [Audit, findings and decisions](audit.md) |
| Which paths and documents were inventoried? | [Source and documentation inventory](inventory.md) |
| What checks ran during this review? | [Verification](verification.md) |

Use reviewed requirements for intent, source/configuration for implemented behavior, and signed artifact or environment records for release status. A newer commit needs its own acceptance evidence. Prototype plans and dated handoffs remain searchable design and incident history.
