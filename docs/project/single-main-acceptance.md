# Single-main acceptance — work in progress

Baseline: `81736959a41833e235701182729383b1987ad66a`.
Candidate: `codex/unify-platforms-on-main`, [draft PR 10](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/pull/10) (not yet promoted).

Verified so far: recoverable four-ref bundle; exact protected backend trees; config regression RED then GREEN; manual-only signing/unsigned PR-main workflow policy; Zod 3 retained; no added OTA client.

Independent GPT-6.2 Astra review found Android suggestion-order/deletion-token and Apple consent-backoff regressions. Each was reproduced in a failing regression test and fixed: 174 focused tests passed. Identity policy: 29/29; combined configuration/autolinking: 4/4; manual signing/workflow policy: 3/3. Typecheck passed and lint has zero errors (114 warnings). The exact new commit range passed the secret scan after narrow fingerprint classification of public client configuration; see the [release boundary audit](single-main-release-audit.md).

Read PR Checks and its description for final full-suite/native qualification results and the exact tested head; do not carry a green check onto later application changes. Native iOS compilation and physical-device acceptance are mandatory distinct evidence; none is inferred from Windows tests. No candidate has been installed over an existing customer app. Shipping Apple Shortcuts require the production API origin, so synthetic staging transactions must not be sent through that production path. Safe non-production device acceptance remains open. Keep old refs/worktrees until unique work is accounted for.

No server, database, OTA or Store deployment is part of this change.
