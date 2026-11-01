# Deployment inventory — 1 November 2026

Read-only evidence captured 2026-11-01T14:14:22.656808+00:00. No objects were stopped, deleted, reloaded, pruned or migrated. No server files were written.

## Outcome

Inventoried 246 containers (37 running), 89 images, 198 loaded system services (13 application services), 15 timers, 16 existing cron files, 47 listening sockets and 257 measured deployment folders. Separate `du` calls measured 67 release children and 14 Admin release children without parent/child deduplication.

Mapped 24 of 24 public proxy locations to observed services; recorded 9 local-response locations and 6 conditional upstream variables. Public routes below are configuration observations; no authenticated requests or mutation/delivery tests were issued.

## Public route ownership

| Host | Location | Upstream / observed service |
| --- | --- | --- |
| api.staging.masarifiratibi.com | location ~ "^/api/v1/accounts/[0-9a-fA-F-]{36}/summary$" { | http://127.0.0.1:3026 → masarifi-account-voice-api-7a18a547 |
| api.staging.masarifiratibi.com | location = /api/v1/transactions { | http://127.0.0.1:3026 → masarifi-account-voice-api-7a18a547 |
| api.staging.masarifiratibi.com | location ^~ /api/v1/transactions/ { | http://127.0.0.1:3026 → masarifi-account-voice-api-7a18a547 |
| api.staging.masarifiratibi.com | location ^~ /api/v1/voice/ { | http://127.0.0.1:3026 → masarifi-account-voice-api-7a18a547 |
| api.staging.masarifiratibi.com | location = /api/v1/meta/social-media { | http://127.0.0.1:3024 → masarifi-social-media-staging-api-bb0f2fe7 |
| api.staging.masarifiratibi.com | location = /api/v1/admin/settings/mobile.social_links { | http://127.0.0.1:3024 → masarifi-social-media-staging-api-bb0f2fe7 |
| api.staging.masarifiratibi.com | location ^~ /api/v1/tracking/device/ { | http://127.0.0.1:3023 → masarifi-permanent-dev-api-20261021 |
| api.staging.masarifiratibi.com | location ~* ^/api/v1/sync/(?:bootstrap\|delta)/?$ { | http://127.0.0.1:3020 → masarifi-dev-sync-readiness-20261019-t04-r18-8937ba09 |
| api.staging.masarifiratibi.com | location ~* ^/api/v1/voice/sessions/?$ { | http://127.0.0.1:3001 → masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09; http://127.0.0.1:3004 → masarifi-dev-voice-repair-api-d7fa3054-5e79-4668-a72d-522950777dff  SHADOWED by the matching ^~ prefix; effective service: account/voice API on 3026 |
| api.staging.masarifiratibi.com | location ~* ^/api/v1/assistant(?:/\|$) { | http://127.0.0.1:3001 → masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09 |
| api.staging.masarifiratibi.com | location = /account-deletion/api/v1/me/deletion-requests { | http://127.0.0.1:3027/api/v1/me/deletion-requests → masarifi-dev-immediate-delete-2764f849 |
| api.staging.masarifiratibi.com | location ^~ /account-deletion/api/v1/privacy/deletion-completions/ { | http://127.0.0.1:3027/api/v1/privacy/deletion-completions/ → masarifi-dev-immediate-delete-2764f849 |
| api.staging.masarifiratibi.com | location = /account-deletion { return 404; } | local response |
| api.staging.masarifiratibi.com | location ^~ /account-deletion/ { return 404; } | local response |
| api.staging.masarifiratibi.com | location = /dev-account-deletion/api/v1/me/deletion-requests { | http://127.0.0.1:3027/api/v1/me/deletion-requests → masarifi-dev-immediate-delete-2764f849 |
| api.staging.masarifiratibi.com | location ^~ /dev-account-deletion/api/v1/privacy/deletion-completions/ { | http://127.0.0.1:3027/api/v1/privacy/deletion-completions/ → masarifi-dev-immediate-delete-2764f849 |
| api.staging.masarifiratibi.com | location = /dev-account-deletion { return 404; } | local response |
| api.staging.masarifiratibi.com | location ^~ /dev-account-deletion/ { return 404; } | local response |
| api.staging.masarifiratibi.com | location ^~ /dev-privacy/ { | http://127.0.0.1:3016/ → masarifi-immediate-storage-runtime-upgrade-2026-10-16-api |
| api.staging.masarifiratibi.com | location = /health/ready { | local response |
| api.staging.masarifiratibi.com | location ~ "^/api/v1/transactions/[0-9a-fA-F-]{36}$" { | http://127.0.0.1:3001 → masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09; http://127.0.0.1:3019 → masarifi-staging-p0-finance-2026-10-18; http://127.0.0.1:3021 → masarifi-dev-planning-scope-20261019  SHADOWED by the matching ^~ prefix; effective service: account/voice API on 3026 |
| api.staging.masarifiratibi.com | location ~ "^/api/v1/obligations/[0-9a-fA-F-]{36}/payments$" { | http://127.0.0.1:3001 → masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09; http://127.0.0.1:3017 → masarifi-staging-payment-history-f65be899; http://127.0.0.1:3018 → masarifi-staging-planning-review-9f650fa5; http://127.0.0.1:3021 → masarifi-dev-planning-scope-20261019 |
| api.staging.masarifiratibi.com | location ~ "^/api/v1/obligations/[0-9a-fA-F-]{36}/payments/[0-9a-fA-F-]{36}/reverse$" { | http://127.0.0.1:3001 → masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09; http://127.0.0.1:3021 → masarifi-dev-planning-scope-20261019 |
| api.staging.masarifiratibi.com | location = /api/v1/planning/summary { | http://127.0.0.1:3018 → masarifi-staging-planning-review-9f650fa5 |
| api.staging.masarifiratibi.com | location / { | http://127.0.0.1:3001 → masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09 |
| staging.masarifiratibi.com | location / { | http://[::1]:3039 → masarifi-admin-ui-8678c586-01.service |
| staging.masarifiratibi.com | (server context) | local response 301 |
| staging.masarifiratibi.com | (server context) | local response 404 |
| api.staging.masarifiratibi.com | (server context) | local response 301 |
| api.staging.masarifiratibi.com | (server context) | local response 404 |
| api.staging.masarifiratibi.com (included snippet) | location ^~ /api/v1/admin/ { | http://127.0.0.1:3033 → masarifi-admin-recovery-api-7e3bbef0 |
| api.staging.masarifiratibi.com (included snippet) | location ^~ /api/v1/support/ { | http://127.0.0.1:3033 → masarifi-admin-recovery-api-7e3bbef0 |
| api.staging.masarifiratibi.com (included snippet) | location = /api/v1/me/mobile-activity { | http://127.0.0.1:3033 → masarifi-admin-recovery-api-7e3bbef0 |

From the observed configuration and [Nginx location precedence](https://nginx.org/en/docs/http/ngx_http_core_module.html#location), two configured regex blocks appear dormant for their matching paths: the transaction-ID regex is shadowed by `^~ /api/v1/transactions/`, and the voice-session regex is shadowed by `^~ /api/v1/voice/`. Their effective HTTP service is the account/voice API on 3026. The table retains configured alternatives for reconciliation and conservatively protects their artifacts. Configuration mapping is not an authenticated request trace.

Nginx conditional selector values are hashed in the JSON. The JSON groups `set`/conditional `set` assignments by variable; these are not observed Nginx `map` directives. Each group retains its variable, hashed rule identity and all observed target services. A route with several targets must retain every applicable revision until routing conditions are reconciled. Included Admin/support/mobile-activity routes inherit the API host.

## Active container and background roles

| Identity | Role / entrypoint | Image content ID | Source revision |
| --- | --- | --- | --- |
| masarifi-assistant-reports-worker-20261023 | assistant agent/report worker; `dist/src/assistant-agent-worker.js` | `sha256:72ae3ed54343c00ab5ab731e969a98a34e21ff9f880729cd7c2c05cb5bf69cb0` | c430442b292eaa245a3bfd6dca957e0edda041e2 |
| masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09 | HTTP API process; `dist/src/main.js` | `sha256:4b70927fcbf19bf015f80fce0110173152b94a21d5c1146c67133c0b9854f95f` | 139be49655177e5748382b6c46731095c7d71e45 |
| masarifi-dev-voice-repair-worker-d7fa3054-5e79-4668-a72d-522950777dff | voice repair/background worker; `dist/src/staging-voice-worker.js` | `sha256:14ac05c7a6ab010f4e143868415988fb9d78d26738ae6ccf6d417e8b620ce395` | d02f03df7ab49260c57800d7576f1cd2c2a1ca24 |
| masarifi-staging-analysis-worker-1 | background worker; queue scope requires reconciliation; `dist/src/worker.js` | `sha256:fb25127724ec75ba42ddba05cbc88154803fb24b19991f3a8f645aedd93f9f69` | ac7bc92ab2e6e6c2e50a969de6c69463688febae |
| masarifi-staging-worker-1 | background worker; queue scope requires reconciliation; `dist/src/worker.js` | `sha256:f1ea1557383d70cd3e78e361c18412171bb0ae002ea53314eefaddbd20495bf4` | e7ad90e8b91c118e6365f57cc6cc542f94873595 |
| masarifi-requested-pdf-email-20261031-01 | requested report/PDF email worker; delivery not tested; `dist/src/reports-email-worker.js` | `sha256:6cfb97248a949f0278304b358e584006657b60612d0a141a97eea477f9794b4e` | c430442b292eaa245a3bfd6dca957e0edda041e2 |
| masarifi-dev-sync-readiness-20261019-t04-r18-8937ba09 | HTTP API process; `dist/src/main.js` | `sha256:6569dd9087ab58bed5a3c8dc7ca1d65fcd6354547642f63786af0438939351e0` | e72a99b172424973eaa2c5a2dedfcc8be308d015 |
| masarifi-admin-recovery-customer-worker-7e3bbef0 | Admin customer recovery/background worker; `reflect-metadata, ./dist/src/platform/config/platform-config.module, ./dist/src/identity/identity.module, ./dist/src/identity/customer-session-revoker` | `sha256:274f4e7dca0add015e834c9b0af9a8371fac4b78bfabf18833d2467500c424f1` | 7e3bbef0cdccc2ee5509dd332f4e32236af01b90 |
| masarifi-admin-recovery-api-7e3bbef0 | HTTP API process; `dist/src/main.js` | `sha256:274f4e7dca0add015e834c9b0af9a8371fac4b78bfabf18833d2467500c424f1` | 7e3bbef0cdccc2ee5509dd332f4e32236af01b90 |
| masarifi-qa-assistant-routing-20261022 | HTTP API process; `dist/src/main.js` | `sha256:69e6bcb561255c151ddda7c3dec51b628b93d882d7cf4124edde7215e2be1f6a` | c430442b292eaa245a3bfd6dca957e0edda041e2 |
| masarifi-qa-assistant-persistence-20261022 | background worker; queue scope requires reconciliation; `dist/src/worker.js` | `sha256:fabc278b525e54a08ba24a06071c466cc46af564b01719c9bb2cebde3e3daa71` | ac7bc92ab2e6e6c2e50a969de6c69463688febae |
| masarifi-dev-immediate-delete-2764f849 | HTTP API process; `dist/src/main.js` | `sha256:abb6e9137a52c309e78e0069895a1a855e6af78c48ceb05364808816b8037576` | unproven |
| masarifi-account-voice-api-7a18a547 | HTTP API process; `dist/src/main.js` | `sha256:feb275e498a0c2a9298993655917f4db4d9d099f3b2524ab39a72fc9b647fa8f` | unproven |
| masarifi-social-media-staging-api-bb0f2fe7 | HTTP API process; `dist/src/main.js` | `sha256:915a8c35b9ca82518859e3000d994e8955c71ccc4027a6380515bfc8bd669ea8` | unproven |
| masarifi-dev-reminders-20261021 | development reminder scheduler; `dist/src/dev-reminders.js` | `sha256:41fb00ac178e96fd82a8bb20a279ce1c9464ec073368a40a6ec060087592f75b` | unproven |
| masarifi-permanent-dev-api-20261021 | HTTP API process; `dist/src/main.js` | `sha256:41fb00ac178e96fd82a8bb20a279ce1c9464ec073368a40a6ec060087592f75b` | unproven |
| masarifi-dev-account-deletion-contract-20261020 | HTTP API process; `dist/src/main.js` | `sha256:8fa16063cb13fe7b482c981fd0641c2d9c35a4dcc9c41b2e6d8bd819cd32de3e` | e72a99b172424973eaa2c5a2dedfcc8be308d015 |
| masarifi-dev-assistant-parts-20261019 | assistant agent/report worker; `dist/src/assistant-agent-worker.js` | `sha256:2028e0f31e3caa29dc606cb3974267ad57e8ea5e6b159f4e06cdf4302f4e526a` | c430442b292eaa245a3bfd6dca957e0edda041e2 |
| masarifi-dev-planning-scope-20261019 | HTTP API process; `dist/src/main.js` | `sha256:bafbc3986eb88e5b8f79473cb142816801b5f5df5323be68706bf72572b6c9bc` | e72a99b172424973eaa2c5a2dedfcc8be308d015 |
| masarifi-dev-voice-repair-api-d7fa3054-5e79-4668-a72d-522950777dff | HTTP API process; `dist/src/main.js` | `sha256:14ac05c7a6ab010f4e143868415988fb9d78d26738ae6ccf6d417e8b620ce395` | d02f03df7ab49260c57800d7576f1cd2c2a1ca24 |
| masarifi-staging-p0-finance-2026-10-18 | HTTP API process; `dist/src/main.js` | `sha256:8cc1aaee453d3c72f7726ff0af4f49c809b75b6638a0a0b1b7a14e3f2e83f632` | 139be49655177e5748382b6c46731095c7d71e45 |
| masarifi-staging-planning-review-9f650fa5 | HTTP API process; `dist/src/main.js` | `sha256:2acb8a59eec92fd14a7f0f9e2c73da3f20880e33c5d82d1822d5014f7e23944e` | 139be49655177e5748382b6c46731095c7d71e45 |
| masarifi-staging-payment-history-f65be899 | HTTP API process; `dist/src/main.js` | `sha256:f2a739ff394a44ecaaf6f7d1ae779111bafaba7f6c1d8e0e835f406199a9e5e5` | 139be49655177e5748382b6c46731095c7d71e45 |
| masarifi-immediate-storage-runtime-upgrade-2026-10-16-worker | privacy/storage background worker; `dist/src/staging-privacy-worker.js` | `sha256:7ed39b790ac1c3975147b3d9a7215b7b96f0be227ba968cf4bf22699c79c17bc` | 577defc5084b420130422db0a373444a365695d7 |
| masarifi-immediate-storage-runtime-upgrade-2026-10-16-api | HTTP API process; `dist/src/main.js` | `sha256:7ed39b790ac1c3975147b3d9a7215b7b96f0be227ba968cf4bf22699c79c17bc` | 577defc5084b420130422db0a373444a365695d7 |
| masarifi-immediate-dev-privacy-api-2b3d1061-41c9-4b63-8436-dfdf11aef07c | HTTP API process; `dist/src/main.js` | `sha256:7c6ff3b9f5a6d7ce39796aba1677fb49190869ff88707a59836c4e19d5242d1e` | d6cb730c576e44bcd2bbdec2d16a289b64c76c06 |
| masarifi-native-dev-privacy-api-75422a63-ccd4-48d9-a79a-42f8082c7822 | HTTP API process; `dist/src/main.js` | `sha256:42d90d33691e1078321bfd44ddf679aae4be7f04085ac7fcab7f5ebed1fffc5b` | c430442b292eaa245a3bfd6dca957e0edda041e2 |
| masarifi-dev-assistant-reliability-v4-api-b81cbf9c-15d8-4eae-9420-55d2426fdca9 | HTTP API process; `dist/src/main.js` | `sha256:36c89e561578126f65665139b254b7c8ad71c776846529dfec0a49aae20a3907` | 29c73f2c8943eb9a3cc77eed7e13413eb869b90f |
| masarifi-dev-assistant-reliability-v3-api-fff643c2-442f-434c-82c6-ec363b978477 | HTTP API process; `dist/src/main.js` | `sha256:8571e39b294d7952e674265a558eebf6670c3bd2a60a55dbed00a6c1f0db4276` | 5f6518ebd8bcf66718fba3c4f50d565aab9a366b |
| masarifi-dev-assistant-reliability-api-2fc911f4-ac5f-48e0-a1f9-4ab3cf76146d | HTTP API process; `dist/src/main.js` | `sha256:047aac33fec27d56c4f3fcf1c5c9682940d0a7cf5c575bb43d842da6f6db5463` | 0254a5ac1c0b89b3f5fbde79d1bb8cb139925371 |
| masarifi-dev-assistant-specialization-api-3e68fa2f-1e4e-402d-871a-ef324fb45d16 | HTTP API process; `dist/src/main.js` | `sha256:2f6dc5be22ce995dc1eeeb479a7d2d26e89a3acfc5d9ee639bdcf6ac3e425a9d` | c35ab714ef8b09c78d07196321a4c52949d3936b |
| masarifi-dev-assistant-performance-api-9b100867-4bfb-44e2-b6f1-0ca2d4a62a43 | HTTP API process; `dist/src/main.js` | `sha256:9f615f89cc53623edc4630080ee0cc2edc3e839e28f953f25e3939cbec65bde4` | d7a4d8942fa7d8502d82ea5f2390063ebd802976 |
| masarifi-dev-assistant-upgrade-api-a9973ab2-892e-4dbb-9d3f-dea435da3f2d | HTTP API process; `dist/src/main.js` | `sha256:262d7bf93de2dad3684a44aa25a274f3183fc443bd213545f3a2476f80b75604` | d6242b77dc980daa1bc55ef5a377aa96f1e5fe65 |
| masarifi-dev-assistant-api-1d25d705-dd09-4adb-a6e1-add2360af337 | HTTP API process; `dist/src/main.js` | `sha256:ed8b92f9b7723bf8077b777da6766a6ff901c56dc958d11ecac80a407722dbc7` | 204bfcb6d5ed41e426b60a3f471225f76b8bd713 |
| masarifi-staging-tracking-maintenance-e079e570-eab5-43f0-a6ed-ac98e3fc10bd | tracking maintenance/background acceptance process; `/app/tracking-acceptance.cjs` | `sha256:03f699578d0d3e0b92cc1db5944e82d41fe575cc03273d1b23679f37ed22c957` | 79cd3a758a8cb305d863542895c9e1ca3373ee25 |
| masarifi-staging-api-1 | HTTP API process; `dist/src/main.js` | `sha256:a4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383` | ac7bc92ab2e6e6c2e50a969de6c69463688febae |
| masarifi-staging-clamav-1 | malware scanner dependency; `entrypoint unresolved` | `sha256:e8388295191bff0893fb889d9415ae975491201c989b205e30c9057b1985d36a` | unproven |

Every container record in [the machine-readable inventory](deployment-inventory.json) includes identity, role, image digest, available OCI revision, incoming references, mounts, writable/root filesystem usage and disposition. Inline entrypoint hashes identify evaluated worker code without exposing source or command arguments. Active mounted files have SHA-256 hashes, including the tracking maintenance script and recovery-gate artifact. Host service package/build metadata and service definitions have recorded hashes; these do not establish complete source-tree integrity. Image IDs are content identities; date/SHA fragments in names and tags do not prove source provenance. Generic worker queue/claim scopes still need source/config reconciliation.

## Host services, schedules and listeners

| Service | State | Working directory | Entrypoint files |
| --- | --- | --- | --- |
| masarifi-admin-feedback-a7d21c42-01.service | active / running | /opt/masarifi/admin-releases/t19a-feedback-a7d21c42-01/apps/admin-web |  |
| masarifi-admin-feedback-route-97662218-01.service | active / running | /opt/masarifi/admin-releases/t19a-feedback-route-97662218-01/apps/admin-web |  |
| masarifi-admin-recovery-7e3bbef0.service | failed / failed | /opt/masarifi/admin-releases/recovery-7e3bbef0-20261024/apps/admin-web |  |
| masarifi-admin-recovery-ui-01ae6311.service | active / running | /opt/masarifi/admin-releases/recovery-ui-01ae6311/apps/admin-web |  |
| masarifi-admin-recovery-ui-99499ac5.service | failed / failed | /opt/masarifi/admin-releases/recovery-ui-99499ac5/apps/admin-web |  |
| masarifi-admin-recovery-ui-daeb1ef1.service | active / running | /opt/masarifi/admin-releases/recovery-ui-daeb1ef1/apps/admin-web |  |
| masarifi-admin-t19a-build-a7d21c42-01.service | failed / failed | /opt/masarifi/admin-releases/t19a-feedback-a7d21c42-01/apps/admin-web | node_modules/vitest/vitest.mjs |
| masarifi-admin-t19a-build-a7d21c42-02.service | failed / failed | /opt/masarifi/admin-releases/t19a-feedback-a7d21c42-01/apps/admin-web | node_modules/vitest/vitest.mjs |
| masarifi-admin-t19a-build-a7d21c42-03.service | failed / failed | /opt/masarifi/admin-releases/t19a-feedback-a7d21c42-01/apps/admin-web |  |
| masarifi-admin-ui-8678c586-01.service | active / running | /opt/masarifi/admin-releases/ui-8678c586-20261031-01/apps/admin-web |  |
| masarifi-admin.service | active / running | /opt/masarifi/admin-releases/ai-usage-refinement-4d87a02fcea4/apps/admin-web |  |
| masarifi-social-media-admin-bb0f2fe7.service | active / running | /opt/masarifi/admin-social-reauth-9b5a4a10/source/apps/admin-web |  |
| masarifi-voice-canary-ingress.service | active / running |  | /opt/masarifi/voice-canary/ingress.cjs |

Existing `/etc/cron.d/docker-builder-prune` (03:03 Wednesday) and `/etc/cron.d/docker-image-prune` (05:36 daily) were discovered and left unchanged. Their automatic cleanup behavior must be reconciled with rollback retention before production qualification. Times are cron fields in the server timezone; timezone has not been independently verified.

Timers, cron schedules, safe entrypoint filenames, hashed schedule lines, listening addresses, socket process identities and configured references are recorded in the JSON. Cron file content, environments, credentials and raw process command lines are excluded. Failed/disabled services retain deployment references and are protected until rollback policy is resolved.

## Exact cleanup candidate ledger

The filesystem snapshot reports 86% used and 14,638,952,448 bytes available (about 14.64 GB); the 25 GB free-space target is not met.

[The exact candidate CSV](cleanup-candidates.csv) lists 174 folders and 0 images with bytes and incoming-reference counts. These have **no discovered incoming references within the declared scan scope**; they are **protected provisional candidates, not verified removable objects**. Verified removable objects: **0**. No deletion or cutover is authorized.

Each folder in the JSON records incoming checks from configuration paths, all container mounts and Compose metadata (including stopped containers), loaded service directories/entrypoints, process working directories and scoped symlinks. Exact full-length OCI revision labels matching release-directory names are also protected as source-artifact associations. It retains the precise reference sources, target paths, mounted state and allocated bytes. Folder records include aggregates; do not sum a parent with its children. GNU du deduplicates hardlinks within each traversal, so separately measured trees can report different totals and allocated bytes do not establish exclusive reclaimable space. Image size is logical and shared across layers; no additive reclaimed-space estimate is justified. Docker internal paths are never manual cleanup targets.

Full off-host DB, Storage, configuration, secrets and artifact restore proof is still absent. N-1 release selection, the required observation period and off-host retention must be established before approving exact removals. Backups, application state, certificate mounts, the ClamAV database and any unresolved artifact remain protected.

## Evidence limits and blockers

The 37 running containers comprise 25 HTTP API processes, 11 background process roles and one ClamAV dependency. 31 running containers have OCI revision labels; six do not. No complete source-to-build attestation has been independently verified. Admin service package/build metadata hashes identify deployed artifacts, but all inspected host deployment directories lacked a readable Git HEAD.

- 83 of 89 images have a usable OCI source revision label. Content digests are recorded, but canonical source/build manifests are incomplete.
- No complete isolated restore/reconciliation proof; cleanup and cutover remain gated.
- External/off-host references, all open file descriptors and all application source/artifact references are outside this metadata scan. No-discovered-reference status is insufficient for deletion.
- Worker queue/consumer ownership and schedule effects require source/config reconciliation; no worker was started/stopped or executed for validation.
- Observations are sequential; recheck exact identities and references immediately before any separately authorized cleanup.
- This report does not establish production readiness, public exposure approval, route correctness under authenticated traffic, or performance targets.

Collector errors: 1. The optional `/etc/anacrontab` is absent and was attempted by the broad collector; existing cron directories and `/etc/crontab` were read. See the JSON for command categories and exit/timeout metadata.

Private evidence remains under `.superpowers/sdd/2026-11-01-performance-production-readiness/`; the published artifacts contain infrastructure metadata only.

## Later resource and pool-configuration snapshot

At21:25 Riyadh strict SSH was restored through the specifically approved source-only UFW rule; no application routing changed. The original37 containers remained protected, plus the owned restore fixture. OS available disk was13,143,601,152 bytes (88% used), memory available1,791,483,904 of8,321,167,360 bytes. A subsequent pinned Storage restore-tool image adds disk use; this is not reclaimed capacity.

Current numeric main-pool settings total218 across25 API containers and87 across11 worker containers, all session-pooler URLs on5432. Four APIs configure privacy endpoints and one worker configures a command endpoint. URLs/roles/passwords were not exported; opaque connection groups establish only equality. Configured budgets are not actual process counts, open connections or a causal incident attribution. Two workers were unhealthy and the Voice repair worker was repeatedly restarting; none was altered. See the current incident report.
