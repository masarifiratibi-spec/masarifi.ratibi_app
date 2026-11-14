# Android update announcements — preparation and activation handoff

Prepared on 12 November 2026. The user chose both an optional in-app notice and an external push. This preparation does not build a binary or container, deploy configuration, publish to Play, create a campaign, send a real push or establish Google approval. Existing installed binaries need a release containing the new client behavior before they can display that behavior.

## Publication policy

The additive public endpoint is `GET /api/v1/meta/mobile-update`. The existing authenticated `/api/v1/meta` response remains unchanged. The new response has exactly these keys:

```json
{
  "schemaVersion": 1,
  "enabled": false,
  "release": null,
  "storeUrl": "https://play.google.com/store/apps/details?id=com.masarifi.mobile"
}
```

The Play URL is pinned to `com.masarifi.mobile`; campaign or push data cannot supply a different destination. Disabled or incomplete runtime policy exposes no release. Startup configuration rejects an explicitly published release unless both a valid stable `X.Y.Z` version name and an integer Android versionCode from 1 through 2,100,000,000 are supplied.

| Configuration | Prepared default | Later activation requirement |
| --- | --- | --- |
| `MASARIFI_ANDROID_UPDATE_PUBLISHED` | `false` | Set `true` only after verifying public Play availability for the intended audience. |
| `MASARIFI_ANDROID_LATEST_VERSION` | unset | Exact Play version name, stable `X.Y.Z`. |
| `MASARIFI_ANDROID_LATEST_VERSION_CODE` | unset | Exact Play versionCode, as an integer. |

These settings must agree across every API and engagement worker replica. They are process configuration, not a live database toggle; later configuration changes require the normal authorized rollout/restart procedure. None were activated here. Do not reuse the backend's `MASARIFI_RELEASE_VERSION` as an Android versionCode.

## Eligibility and campaign governance

External notices reuse the existing authenticated Admin notification campaign, approval and provider pipeline. There is no second sender, new permission, database migration or RLS expansion. The optional audience field is:

```text
{
  platforms: ['android'],
  locales: ['ar', 'en'],
  activity: 'all',
  segmentKeys: [],
  appUpdate: { version: <verified Play X.Y.Z>, versionCode: <verified integer> }
}
```

`appUpdate` accepts only `version` and `versionCode`; it requires exactly `platforms: ['android']`. Arbitrary URLs and additional release keys are rejected. Preview, creation, approval, scheduling, send-now and resume require the same currently published release. Pause and cancellation remain available after withdrawal. Creation requires a published push template visible to the operator's existing template-management permission; do not grant new privileges merely to bypass a failed check.

Use the existing routes with their current authorization, recent Clerk verification, idempotency keys, preview freshness and creator/approver separation:

- `POST /api/v1/admin/notifications/audience-preview`
- `POST /api/v1/admin/notifications/campaigns`
- `POST /api/v1/admin/notifications/campaigns/:campaignId/actions`

The aggregate preview is an **upper bound**, not a count of final version-eligible push recipients. The existing database preview cannot inspect customers' app versions under the API role's RLS. Actual installed versions, device/token state, preferences and prior release announcements are checked later by the authorized worker. Do not describe the preview count as guaranteed sends or bypass RLS to refine it.

Campaign expansion checks the published version/code again and cancels a stale, malformed or non-push update campaign. Deliveries persist `rendered_data: { route: 'app_update', appUpdate: { version, versionCode } }`. Expansion uses the existing keyset and unique-campaign guards plus a transaction advisory lock for the exact release and a prior-delivery check for the same owner/release across **all** campaigns. Creating another campaign cannot silently announce that release twice to the same owner.

Installed metadata such as `1.0.1+139` carries the true build code within the existing 32-character registration field. Build codes decide eligibility when present, including the same version name with a newer build. Older plain `X.Y.Z` registrations use semantic-version comparison; malformed or already current/newer versions are excluded. Expansion requires an active owner's unrevoked older Android device. At every dispatch/retry, the worker independently selects the most recently updated eligible unrevoked Android push token bound to that same owner/device. A newer iOS token, a current Android install, a revoked token/device, an inactive owner or a paused/cancelled campaign cannot substitute for it.

Disabled push preferences remain effective. The matching template's quiet hours defer delivery using the existing policy. If a custom update template has no preference row, the latest enabled shared owner push quiet-hours setting is used; creating a new template key does not bypass the owner's quiet hours. Deferral does not consume a provider attempt. Normal notifications keep their existing selection and delivery behavior. The push payload carries the update route and a notification UUID; the client fetches the current policy when opened instead of trusting an old payload's release or URL.

## Later activation sequence

1. Verify the intended release is actually available from Play for the target countries, tracks and devices, using the store versionCode and installed version. Finish the separately required binary, signing, review and rollout acceptance work. A draft, under-review or partially available rollout is not a reason to publish a general announcement.
2. Rehearse with a disposable database and test provider configuration first. Confirm the tests below under real database roles. Use synthetic accounts/tokens only. A disabled provider still records suppressed delivery decisions; rehearsing against customer rows can consume the per-release announcement slot.
3. With operator authorization for that later action, configure the exact same published release on API and workers and verify the public endpoint. Confirm live provider credentials, monitored delivery/error metrics, existing push permissions and the independently approved template. No credentials belong in campaign text or public policy.
4. Preview the exact audience, review the upper-bound limitation, create a draft through the existing API, and obtain the required campaign approval/separation. Preserve the preview identity/freshness and normal idempotency handling. The ordinary Admin form may not yet expose `appUpdate`; use the existing governed API rather than inventing an unrestricted sender.
5. Only after explicit campaign authorization, schedule or send through the existing pipeline. Review actual delivery/suppression counts and client navigation. This handoff contains no evidence that those actions have occurred.

## Withdrawal, retries and duplicate semantics

Pause/cancel the relevant campaigns promptly through the approved Admin action, then withdraw the policy on **all** API/worker replicas using the normal authorized configuration rollout. Verify `enabled: false` and `release: null` from the public endpoint and confirm every old worker has stopped. A still-running worker with old configuration can retain an obsolete view until restarted. Provider-accepted pushes cannot be recalled, but a tap fetches the current disabled policy and does not offer an unavailable update.

Queued and retried update deliveries recheck the same release and the current campaign, owner, preferences and device/token state before reaching a provider. A valid paused campaign defers its original delivery for a later eligibility check without consuming a provider attempt; resume can use that same delivery and release slot. Replacement, withdrawal or cancellation suppresses delivery; stale campaign expansion is cancelled. Existing max attempts, backoff, token invalidation and ambiguous-provider handling are retained.

The per-owner/release deduplication counts previous queued, sending, delivered, failed **and suppressed** push deliveries. A retryable failure stays on its original delivery/idempotency history and may retry only through the existing bounded pipeline while still eligible. An ambiguous provider result is terminal and is not resent. A missing/revoked/up-to-date token or other terminal suppression does not earn a new delivery by creating another campaign for the same release; the optional in-app notice can still inform a later eligible install. Do not edit database statuses or create a duplicate campaign to circumvent suppression. This is not a claim of exactly-once delivery across every provider/process-crash boundary.

## Verification without a build or real send

From `apps/api`, use the direct Jest executable in PowerShell so argument forwarding is preserved:

```text
node node_modules/jest/bin/jest.js --selectProjects unit --runInBand
node node_modules/jest/bin/jest.js --selectProjects unit contract integration security --runInBand --runTestsByPath test/unit/platform/android-update-policy.spec.ts test/unit/engagement/android-update-campaign.spec.ts test/unit/engagement/campaign-audience.spec.ts test/unit/config/environment.schema.spec.ts test/contract/meta.contract-spec.ts test/contract/openapi-drift.contract-spec.ts test/contract/engagement/engagement-openapi-instance.contract-spec.ts test/integration/engagement/campaign-worker.integration.spec.ts test/integration/engagement/reminder-delivery-revalidation.integration.spec.ts test/integration/engagement/android-update-announcements.integration.spec.ts test/security/engagement/engagement-dto.security.spec.ts
npm run typecheck
npm run lint
```

The new actual-PostgreSQL suite uses the existing `describeLiveDatabase`/`createLivePool` harness and is gated by `MASARIFI_LIVE_DATABASE_TESTS=1`. It exercises genuine worker roles and SQL for version/token filtering, cross-campaign deduplication, device changes and publication withdrawal inside rollback fixtures. The local historical disposable target was stopped, so those database cases were **skipped locally**. Run them later in the normal CI disposable-database job; a skipped test is not proof of SQL/runtime behavior. Do not start a new database, use an unknown default target, reset data, build an image or send a real notification to complete this source-only preparation.
