# Measured performance — serving state and coverage

Read-only snapshot: 2026-11-02T13:55:25.036299+00:00. Source control: d3789ca0; initial documentation HEAD8b8ae412. Production NOT READY.

The snapshot records24 proxy declarations and27 running containers. Configuration candidates are not authenticated request traces. Conditional alternatives and Nginx precedence remain explicit; revision labels are absent unless recorded. No server mutation, authenticated mutation or provider call was performed. Raw Nginx configuration and container environment were not retained.

| Location | Configured upstream | Candidate service(s) |
| --- | --- | --- |
| `~ ^/api/v1/accounts/[0-9a-fA-F-]{36}/summary$` | `http://127.0.0.1:3026` | masarifi-account-voice-api-7a18a547 |
| `= /api/v1/transactions` | `http://127.0.0.1:3026` | masarifi-account-voice-api-7a18a547 |
| `^~ /api/v1/transactions/` | `http://127.0.0.1:3026` | masarifi-account-voice-api-7a18a547 |
| `^~ /api/v1/voice/` | `http://127.0.0.1:3026` | masarifi-account-voice-api-7a18a547 |
| `= /api/v1/meta/social-media` | `http://127.0.0.1:3024` | masarifi-social-media-staging-api-bb0f2fe7 |
| `= /api/v1/admin/settings/mobile.social_links` | `http://127.0.0.1:3024` | masarifi-social-media-staging-api-bb0f2fe7 |
| `^~ /api/v1/tracking/device/` | `http://127.0.0.1:3023` | masarifi-permanent-dev-api-20261021 |
| `~* ^/api/v1/sync/(?:bootstrap\|delta)/?$` | `http://127.0.0.1:3020; http://127.0.0.1:3020` | masarifi-dev-sync-readiness-20261019-t04-r18-8937ba09, masarifi-dev-sync-readiness-20261019-t04-r18-8937ba09 |
| `~* ^/api/v1/voice/sessions/?$` | `http://127.0.0.1:3001; http://127.0.0.1:3004` | masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09, masarifi-dev-voice-repair-api-d7fa3054-5e79-4668-a72d-522950777dff |
| `~* ^/api/v1/assistant(?:/\|$)` | `http://127.0.0.1:3001; http://127.0.0.1:3001` | masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09, masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09 |
| `= /account-deletion/api/v1/me/deletion-requests` | `http://127.0.0.1:3027/api/v1/me/deletion-requests` | masarifi-dev-immediate-delete-2764f849 |
| `^~ /account-deletion/api/v1/privacy/deletion-completions/` | `http://127.0.0.1:3027/api/v1/privacy/deletion-completions/` | masarifi-dev-immediate-delete-2764f849 |
| `= /dev-account-deletion/api/v1/me/deletion-requests` | `http://127.0.0.1:3027/api/v1/me/deletion-requests` | masarifi-dev-immediate-delete-2764f849 |
| `^~ /dev-account-deletion/api/v1/privacy/deletion-completions/` | `http://127.0.0.1:3027/api/v1/privacy/deletion-completions/` | masarifi-dev-immediate-delete-2764f849 |
| `^~ /dev-privacy/` | `http://127.0.0.1:3016/` | masarifi-immediate-storage-runtime-upgrade-2026-10-16-api |
| `~ ^/api/v1/transactions/[0-9a-fA-F-]{36}$` | `http://127.0.0.1:3001; http://127.0.0.1:3019; http://127.0.0.1:3021` | masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09, masarifi-staging-p0-finance-2026-10-18, masarifi-dev-planning-scope-20261019 |
| `~ ^/api/v1/obligations/[0-9a-fA-F-]{36}/payments$` | `http://127.0.0.1:3001; http://127.0.0.1:3017; http://127.0.0.1:3018; http://127.0.0.1:3021` | masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09, masarifi-staging-payment-history-f65be899, masarifi-staging-planning-review-9f650fa5, masarifi-dev-planning-scope-20261019 |
| `~ ^/api/v1/obligations/[0-9a-fA-F-]{36}/payments/[0-9a-fA-F-]{36}/reverse$` | `http://127.0.0.1:3001; http://127.0.0.1:3021` | masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09, masarifi-dev-planning-scope-20261019 |
| `= /api/v1/planning/summary` | `http://127.0.0.1:3018` | masarifi-staging-planning-review-9f650fa5 |
| `/` | `http://127.0.0.1:3001` | masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09 |
| `/` | `http://127.0.0.1:3040` | masarifi-admin-canonical-721a943b-20261101-01 |
| `^~ /api/v1/admin/` | `http://127.0.0.1:3033` | masarifi-admin-recovery-api-7e3bbef0 |
| `^~ /api/v1/support/` | `http://127.0.0.1:3033` | masarifi-admin-recovery-api-7e3bbef0 |
| `= /api/v1/me/mobile-activity` | `http://127.0.0.1:3033` | masarifi-admin-recovery-api-7e3bbef0 |

The voice-session regex and transaction-detail regex remain shadowed for matching paths by the corresponding `^~` prefixes. The default API is3001; voice/transaction prefixes route to3026. Do not retire conditional alternatives from configuration evidence alone.

| Service | Module(s) | Image | Source revision label |
| --- | --- | --- | --- |
| masarifi-admin-canonical-721a943b-20261101-01 | /nodejs/bin/node | `sha256:53a7a4530dfa0fb9b296d0c5bca3c330bf308fa7160fd7966cea681d092ca2c5` | 721a943b72837d3f43a4e4b61bc3ab4cd83738d8 |
| masarifi-assistant-reports-worker-20261023 | dist/src/assistant-agent-worker.js | `sha256:72ae3ed54343c00ab5ab731e969a98a34e21ff9f880729cd7c2c05cb5bf69cb0` | c430442b292eaa245a3bfd6dca957e0edda041e2 |
| masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09 | dist/src/main.js | `sha256:4b70927fcbf19bf015f80fce0110173152b94a21d5c1146c67133c0b9854f95f` | 139be49655177e5748382b6c46731095c7d71e45 |
| masarifi-dev-voice-repair-worker-d7fa3054-5e79-4668-a72d-522950777dff | dist/src/staging-voice-worker.js | `sha256:14ac05c7a6ab010f4e143868415988fb9d78d26738ae6ccf6d417e8b620ce395` | d02f03df7ab49260c57800d7576f1cd2c2a1ca24 |
| masarifi-staging-analysis-worker-1 | dist/src/worker.js | `sha256:fb25127724ec75ba42ddba05cbc88154803fb24b19991f3a8f645aedd93f9f69` | ac7bc92ab2e6e6c2e50a969de6c69463688febae |
| masarifi-staging-worker-1 | dist/src/worker.js | `sha256:f1ea1557383d70cd3e78e361c18412171bb0ae002ea53314eefaddbd20495bf4` | e7ad90e8b91c118e6365f57cc6cc542f94873595 |
| masarifi-requested-pdf-email-20261031-01 | dist/src/reports-email-worker.js | `sha256:6cfb97248a949f0278304b358e584006657b60612d0a141a97eea477f9794b4e` | c430442b292eaa245a3bfd6dca957e0edda041e2 |
| masarifi-dev-sync-readiness-20261019-t04-r18-8937ba09 | dist/src/main.js | `sha256:6569dd9087ab58bed5a3c8dc7ca1d65fcd6354547642f63786af0438939351e0` | e72a99b172424973eaa2c5a2dedfcc8be308d015 |
| masarifi-admin-recovery-customer-worker-7e3bbef0 | /nodejs/bin/node | `sha256:274f4e7dca0add015e834c9b0af9a8371fac4b78bfabf18833d2467500c424f1` | 7e3bbef0cdccc2ee5509dd332f4e32236af01b90 |
| masarifi-admin-recovery-api-7e3bbef0 | dist/src/main.js | `sha256:274f4e7dca0add015e834c9b0af9a8371fac4b78bfabf18833d2467500c424f1` | 7e3bbef0cdccc2ee5509dd332f4e32236af01b90 |
| masarifi-qa-assistant-persistence-20261022 | dist/src/worker.js | `sha256:fabc278b525e54a08ba24a06071c466cc46af564b01719c9bb2cebde3e3daa71` | ac7bc92ab2e6e6c2e50a969de6c69463688febae |
| masarifi-dev-immediate-delete-2764f849 | dist/src/main.js | `sha256:abb6e9137a52c309e78e0069895a1a855e6af78c48ceb05364808816b8037576` | unknown; no inferred checkout identity |
| masarifi-account-voice-api-7a18a547 | dist/src/main.js | `sha256:feb275e498a0c2a9298993655917f4db4d9d099f3b2524ab39a72fc9b647fa8f` | unknown; no inferred checkout identity |
| masarifi-social-media-staging-api-bb0f2fe7 | dist/src/main.js | `sha256:915a8c35b9ca82518859e3000d994e8955c71ccc4027a6380515bfc8bd669ea8` | unknown; no inferred checkout identity |
| masarifi-dev-reminders-20261021 | dist/src/dev-reminders.js | `sha256:41fb00ac178e96fd82a8bb20a279ce1c9464ec073368a40a6ec060087592f75b` | unknown; no inferred checkout identity |
| masarifi-permanent-dev-api-20261021 | dist/src/main.js | `sha256:41fb00ac178e96fd82a8bb20a279ce1c9464ec073368a40a6ec060087592f75b` | unknown; no inferred checkout identity |
| masarifi-dev-assistant-parts-20261019 | dist/src/assistant-agent-worker.js | `sha256:2028e0f31e3caa29dc606cb3974267ad57e8ea5e6b159f4e06cdf4302f4e526a` | c430442b292eaa245a3bfd6dca957e0edda041e2 |
| masarifi-dev-planning-scope-20261019 | dist/src/main.js | `sha256:bafbc3986eb88e5b8f79473cb142816801b5f5df5323be68706bf72572b6c9bc` | e72a99b172424973eaa2c5a2dedfcc8be308d015 |
| masarifi-dev-voice-repair-api-d7fa3054-5e79-4668-a72d-522950777dff | dist/src/main.js | `sha256:14ac05c7a6ab010f4e143868415988fb9d78d26738ae6ccf6d417e8b620ce395` | d02f03df7ab49260c57800d7576f1cd2c2a1ca24 |
| masarifi-staging-p0-finance-2026-10-18 | dist/src/main.js | `sha256:8cc1aaee453d3c72f7726ff0af4f49c809b75b6638a0a0b1b7a14e3f2e83f632` | 139be49655177e5748382b6c46731095c7d71e45 |
| masarifi-staging-planning-review-9f650fa5 | dist/src/main.js | `sha256:2acb8a59eec92fd14a7f0f9e2c73da3f20880e33c5d82d1822d5014f7e23944e` | 139be49655177e5748382b6c46731095c7d71e45 |
| masarifi-staging-payment-history-f65be899 | dist/src/main.js | `sha256:f2a739ff394a44ecaaf6f7d1ae779111bafaba7f6c1d8e0e835f406199a9e5e5` | 139be49655177e5748382b6c46731095c7d71e45 |
| masarifi-immediate-storage-runtime-upgrade-2026-10-16-worker | dist/src/staging-privacy-worker.js | `sha256:7ed39b790ac1c3975147b3d9a7215b7b96f0be227ba968cf4bf22699c79c17bc` | 577defc5084b420130422db0a373444a365695d7 |
| masarifi-immediate-storage-runtime-upgrade-2026-10-16-api | dist/src/main.js | `sha256:7ed39b790ac1c3975147b3d9a7215b7b96f0be227ba968cf4bf22699c79c17bc` | 577defc5084b420130422db0a373444a365695d7 |
| masarifi-staging-tracking-maintenance-e079e570-eab5-43f0-a6ed-ac98e3fc10bd | /nodejs/bin/node | `sha256:03f699578d0d3e0b92cc1db5944e82d41fe575cc03273d1b23679f37ed22c957` | 79cd3a758a8cb305d863542895c9e1ca3373ee25 |
| masarifi-staging-api-1 | dist/src/main.js | `sha256:a4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383` | ac7bc92ab2e6e6c2e50a969de6c69463688febae |
| masarifi-staging-clamav-1 | /init | `sha256:e8388295191bff0893fb889d9415ae975491201c989b205e30c9057b1985d36a` | unknown; no inferred checkout identity |

The owned compatibility clone is stopped (exit0). Restart counts are cumulative and do not establish an active failure loop. The most recent qualified backend image remains undeployed. Existing Admin source/artifact qualification and all protected legacy services remain separate from this source change.

## Boolean feature admission flags

Only literal boolean values under MASARIFI names ending ENABLED/ONLY were selected; no general Env dump or credentials retained. These95 flags belong to the observed serving images, not an inferred current-source deployment.

| Service | Selected flags |
| --- | --- |
| masarifi-assistant-reports-worker-20261023 | `MASARIFI_AI_ASSISTANT_ONLY=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_ASSISTANT_AGENT_ENABLED=false`; `MASARIFI_ASSISTANT_AGENT_PUBLIC_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=false` |
| masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09 | `MASARIFI_ADMIN_ROUTES_ENABLED=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_ASSISTANT_AGENT_ENABLED=false`; `MASARIFI_ASSISTANT_AGENT_PUBLIC_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=true` |
| masarifi-dev-voice-repair-worker-d7fa3054-5e79-4668-a72d-522950777dff | `MASARIFI_AI_ASSISTANT_ONLY=false`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=false` |
| masarifi-staging-analysis-worker-1 | `MASARIFI_AI_ASSISTANT_ONLY=false`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=true` |
| masarifi-staging-worker-1 | `MASARIFI_AI_PROVIDER_ENABLED=true` |
| masarifi-requested-pdf-email-20261031-01 | `MASARIFI_AI_ASSISTANT_ONLY=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_ASSISTANT_AGENT_ENABLED=false`; `MASARIFI_ASSISTANT_AGENT_PUBLIC_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=false` |
| masarifi-dev-sync-readiness-20261019-t04-r18-8937ba09 | `MASARIFI_ADMIN_ROUTES_ENABLED=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=true` |
| masarifi-admin-recovery-customer-worker-7e3bbef0 | `MASARIFI_AI_PROVIDER_ENABLED=false` |
| masarifi-admin-recovery-api-7e3bbef0 | `MASARIFI_ADMIN_ROUTES_ENABLED=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_ASSISTANT_AGENT_ENABLED=false`; `MASARIFI_ASSISTANT_AGENT_PUBLIC_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=true` |
| masarifi-qa-assistant-persistence-20261022 | `MASARIFI_AI_ASSISTANT_ONLY=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=false` |
| masarifi-dev-immediate-delete-2764f849 | `MASARIFI_ADMIN_ROUTES_ENABLED=false`; `MASARIFI_AI_ASSISTANT_ONLY=false`; `MASARIFI_AI_PROVIDER_ENABLED=false`; `MASARIFI_ASSISTANT_AGENT_ENABLED=false`; `MASARIFI_FINANCE_DIAGNOSTICS_ENABLED=false`; `MASARIFI_STAGING_SELF_DELETION_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=false` |
| masarifi-account-voice-api-7a18a547 | `MASARIFI_ADMIN_ROUTES_ENABLED=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_MOBILE_AUTOMATION_ENABLED=true`; `MASARIFI_RETURN_REMINDERS_ENABLED=false`; `MASARIFI_VOICE_ANALYSIS_ONLY=false` |
| masarifi-social-media-staging-api-bb0f2fe7 | `MASARIFI_ADMIN_ROUTES_ENABLED=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_MOBILE_AUTOMATION_ENABLED=true`; `MASARIFI_RETURN_REMINDERS_ENABLED=false`; `MASARIFI_VOICE_ANALYSIS_ONLY=true` |
| masarifi-dev-reminders-20261021 | `MASARIFI_AI_ASSISTANT_ONLY=false`; `MASARIFI_AI_PROVIDER_ENABLED=false`; `MASARIFI_MOBILE_AUTOMATION_ENABLED=false`; `MASARIFI_RETURN_REMINDERS_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=false` |
| masarifi-permanent-dev-api-20261021 | `MASARIFI_ADMIN_ROUTES_ENABLED=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_MOBILE_AUTOMATION_ENABLED=true`; `MASARIFI_RETURN_REMINDERS_ENABLED=false`; `MASARIFI_VOICE_ANALYSIS_ONLY=true` |
| masarifi-dev-assistant-parts-20261019 | `MASARIFI_AI_ASSISTANT_ONLY=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_ASSISTANT_AGENT_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=false` |
| masarifi-dev-planning-scope-20261019 | `MASARIFI_ADMIN_ROUTES_ENABLED=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=true` |
| masarifi-dev-voice-repair-api-d7fa3054-5e79-4668-a72d-522950777dff | `MASARIFI_ADMIN_ROUTES_ENABLED=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=true` |
| masarifi-staging-p0-finance-2026-10-18 | `MASARIFI_ADMIN_ROUTES_ENABLED=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=true` |
| masarifi-staging-planning-review-9f650fa5 | `MASARIFI_ADMIN_ROUTES_ENABLED=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=true` |
| masarifi-staging-payment-history-f65be899 | `MASARIFI_ADMIN_ROUTES_ENABLED=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=true` |
| masarifi-immediate-storage-runtime-upgrade-2026-10-16-worker | `MASARIFI_AI_ASSISTANT_ONLY=false`; `MASARIFI_AI_PROVIDER_ENABLED=false`; `MASARIFI_ASSISTANT_AGENT_ENABLED=false`; `MASARIFI_FINANCE_DIAGNOSTICS_ENABLED=false`; `MASARIFI_VOICE_ANALYSIS_ONLY=false` |
| masarifi-immediate-storage-runtime-upgrade-2026-10-16-api | `MASARIFI_ADMIN_ROUTES_ENABLED=false`; `MASARIFI_AI_ASSISTANT_ONLY=false`; `MASARIFI_AI_PROVIDER_ENABLED=false`; `MASARIFI_ASSISTANT_AGENT_ENABLED=false`; `MASARIFI_FINANCE_DIAGNOSTICS_ENABLED=false`; `MASARIFI_VOICE_ANALYSIS_ONLY=false` |
| masarifi-staging-tracking-maintenance-e079e570-eab5-43f0-a6ed-ac98e3fc10bd | `MASARIFI_AI_PROVIDER_ENABLED=true` |
| masarifi-staging-api-1 | `MASARIFI_ADMIN_ROUTES_ENABLED=true`; `MASARIFI_AI_PROVIDER_ENABLED=true`; `MASARIFI_VOICE_ANALYSIS_ONLY=true` |
