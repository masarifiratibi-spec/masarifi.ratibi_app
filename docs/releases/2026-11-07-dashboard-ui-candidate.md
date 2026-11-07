# Dashboard UI/integration candidate

Qualified source: `f865131a4cfdcd8ef4b88c3287f125f4d33112e4`, same `ratibi` branch.15 dashboard-owned files; no API/mobile/schema/runtime change.

Repairs include chart clipping/units, dark attention contrast, English demo copy, explicit AI permission states, actionable privacy read errors, the actual53-row queue integration failure, stable queue identities, long job labels and truthful unknown/null/freshness rendering.

Final qualification:108 unit files/1029 tests, production build, TypeScript and ESLint pass.15 strengthened responsive browser regressions and12 health/job browser journeys pass.106 route patterns inventoried and locally visited. Three earlier browser failures were isolated and passed; their original receipts remain retained.

See [English findings](../evidence/2026-11-07-dashboard-production/findings.md), [capability matrix](../evidence/2026-11-07-dashboard-production/capability-matrix.md), [verification receipts](../evidence/2026-11-07-dashboard-production/verification.json) and the [source/deployment review packet](../../ops/releases/2026-11-07-dashboard-ui/README.md).

Source archive SHA256: `f07f5bc16ed0636b3022ed0964b9f7f6f4153578afd72a55ffdaf8c74596634e`. The manifest pins every changed source file and its canonical base/candidate hashes.

**Serving release remains separate:** browser-observed build `RfJI7jhDb6BdroFc-2TBT` on the existing staging dashboard, using the staging API/Clerk origins. The candidate was not activated. The hosted queue page remains affected until deployment. Recent-authentication gates, missing health/billing evidence, actual provider writes and post-deployment candidate acceptance are not certified by local success.

Fresh read-only Hostinger inspection reconciled Docker3040, source721a943b, its exact environment/routing/rollback pins and unchanged30 protected services. A separate off-host Linux [CI build42347991605](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/42347991605) succeeded for sourcef865131: build `scy8yMJdAowpPKpkffiaW`, runtime SHA256 `186aec1f1fd5f3fa30f5e1791bb841c11664e0255e13c5195a7a26d1934c7c62` (262,029,155bytes). All five public-binding hashes match the current service; target image/actual credentials are retained. See the pinned [rollout/rollback proposal](../../ops/releases/2026-11-07-dashboard-ui/rollout-and-rollback.md).

The packet is qualified for scoped staging rollout review. Exact human approval, fresh admission, host canary/watchdog/handover and real authenticated acceptance remain required before claiming the candidate is served. The earlier local Windows build is separate; its placeholder is never a runtime credential. No hosted service/configuration was changed. Foundation42346940801's six Admin jobs passed, while database inventory, API formatting, mobile app-shell and inherited full-history secret matches keep the overall workflow failed; the [gate review](../evidence/2026-11-07-dashboard-production/ci-gate-review.json) records the limits. The evidence does not claim all repository CI passed.
