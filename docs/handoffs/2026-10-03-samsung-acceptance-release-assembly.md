# Samsung acceptance release assembly

This is a Staging acceptance assembly, not final branch integration or a new AI repair.

- Frozen AI/reference implementation: `7e3595dfeafa97927db98f70e0986616bb3d8e94`; its exact-SHA CI run `37118784279` succeeded, and English/Arabic synthetic proposal/Cancel acceptance passed.
- Carry forward only the existing accepted onboarding and owner-quota files from `a4d648ff642e77238a4c18c47fd9b84e2d9ea336`: identity service/repository, Mobile auth service and tests, new-owner regression, onboarding/quota migrations, checksum manifest, migration inventory and quota regression/helper. Their committed Git blobs must equal that accepted source; Windows checkout line endings do not alter migration checksum semantics.
- No AI production module, model, provider-facing schema, canonical schema, prompt, route, M4A adapter, retry/fallback, privacy or financial execution change.
- Existing Staging API `5113fb7` cannot simply be replaced with the original AI image: that image omits newer onboarding and the applied quota migration. This assembly preserves both, including migration history compatibility.
- Installed Samsung APK was pulled read-only on October 3. SHA-256 `f6d3fcdb050f07914c536003830ee89c9f90ba9d96d03cad607eeecfbf4ee9a8` matches the exact `5113fb7` onboarding release receipt; installed update timestamp remains October 2 18:19:52 Riyadh. Assembly Mobile source/package files equal `5113fb7`; no rebuild/install is necessary.
- Re-run relevant local offline checks, independent composition review and one exact-SHA CI before deployment. Deployment must use the resulting immutable image digest, preserve admin/environment checksums, verify migrations, then enable the normal Worker only after proving no eligible stale Voice/Assistant/evaluation dispatches and unknown-hold protection.
- Pre-recording readiness must verify owner active, SAR cash/Food references, quota 30 with historical events retained, global/key $2 limits, no fallback and unchanged four unknown-cost holds totalling $0.5264.
- Physical sequence is one English recording, inspect proposal, Cancel and prove zero mutation; only then one Arabic equivalent. Stop before financial confirmation, extra recordings or final integration. No physical acceptance is claimed by this document.

Local Docker is unavailable; live database/migration and restricted-role regressions must pass in the isolated exact-SHA CI job before deployment. Staging preflight is read-only; it must never manufacture financial reference state.

Local assembly verification passed: API typecheck, lint, build, 1,154 unit tests, 233 contract tests, migration checksums; targeted API security tests passed 139 (eight live-only cases skipped locally); Mobile typecheck and authentication/recorder tests passed 45. All 12 carried-forward Git blobs match `a4d648f`. AI/reference production diff against `7e3595d` and Mobile production/package diff against `5113fb7` are empty. Live database checks remain a mandatory CI gate.
