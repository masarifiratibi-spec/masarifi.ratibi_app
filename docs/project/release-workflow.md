# Main and release workflow

## Source roles

`main` is the intended permanent shared source after the single-main candidate passes qualification and merges. During review, use `codex/unify-platforms-on-main`; its presence does not mean its code is in production. Old operating, Google Play and iOS heads remain recoverable source references, not branches for new feature work. Do not delete their dirty worktrees.

Android and iOS live in `apps/mobile` with platform resolution (`.ios.ts`, `.ios.tsx`, native modules) and separate EAS profiles. Keep Apple text-assistant consent Apple-only, including its future-review comment. Android retains its existing flow and production Firebase configuration. Use the shared Zod 3 dependency; a future validation-major upgrade is a separate change with stored-data/API compatibility evidence.

## Daily work

1. Fetch `ratibi/main`; create a temporary `codex/<task>` branch from the latest qualified main.
2. Implement and test against local disposable services. Keep unfinished behavior off behind explicit feature flags; never point an experiment at production data.
3. Open a PR into main. Review behavior, ownership/privacy, native-platform effects and migration compatibility; require applicable CI checks.
4. Merge the reviewed candidate after all checks pass. Remove only that temporary branch when no work remains.
5. Select the resulting full commit SHA for staging and build immutable artifacts. Run staging/device acceptance using isolated accounts and services.
6. Publish/deploy only by a separate explicit release decision. Promote the SAME tested artifact, not a rebuild from whatever main points to later.

Staging and production are environments, not long-lived source branches. A backend, Admin, Android and iOS release may happen at different times and use different qualified commits.

## Release controls

- Git push/PR/main CI qualifies code; it must not deploy services, apply production migrations, issue OTA updates or submit to stores.
- iOS unsigned compilation runs on macOS for PR/main. Signed Ad Hoc and App Store exports require manual dispatch from main, exact expected source SHA, signing environment and explicit build inputs. Signing/export is not Store submission.
- Backend image registry publication is a separate manual workflow action and is not server activation. Review release-tag behavior before creating tags; archive backups must not use `backend-v*`.
- Current source has no expo-updates dependency and no EAS update/submit workflow command. Recheck external integrations and shipped-artifact configuration before making any claim about all historical app versions.
- Before remote changes, confirm GitHub webhooks/apps and external deploy integrations still do not activate releases automatically.
- Recommended main protection: PRs, successful applicable Backend Foundation/iOS checks, review, no force-push or deletion. At initial inspection, API credentials were not Admin and repository rulesets were empty; protections are NOT claimed configured.

## Rollback and evidence

Maintain one receipt per service/store artifact in `deployed-versions.md`: full source SHA, image digest/build number, environment, validation date and rollback target. Unknown means unverified.
Before merge, abandon only the isolated candidate if necessary. After merge, use a reviewed revert PR. Production stays on its old artifact until separately deployed. After a future deployment, check database compatibility before rollback; a Git reset cannot undo data changes.
