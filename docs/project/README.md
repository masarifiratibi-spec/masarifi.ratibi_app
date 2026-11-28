> **تحديث توحيد الفروع — 28 نوفمبر 2026:** المرجع المستهدف للكود هو `main` مع فروع عمل مؤقتة. نسخة التوحيد قيد التأهيل في `codex/unify-platforms-on-main`؛ لا تعتبرها منشورة أو مدمجة قبل مراجعة [سجل القبول](single-main-acceptance.md). تعليمات الفروع الثلاثة والأرقام أدناه سجل تاريخي، وتُستبدل للعمل الجديد بـ[طريقة العمل والإصدار](release-workflow.md). [النسخ المنشورة المرصودة](deployed-versions.md) مستقلة عن حالة الكود.

# Masarifi maintained project guide

Start with the [current AI handoff and three-branch delivery rules (Arabic)](ai-handoff-ar.md). Consult the [file-by-file release comparison](branch-differences.csv) before propagating changes in divergent mobile paths.

Use `codex/voice-promoted-operating-2026-10-13` as the primary source for shared architecture, features, API, Admin, data and agent rules. Use `codex/google-play-release-2026-11-24` for Google Play differences and `iOS` for Apple differences.

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
