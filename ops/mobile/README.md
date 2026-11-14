# Android source and device acceptance

The latest installed build is Android146, versionName1.0.1. See `docs/operations/2026-11-14-security-settings-mobile-updates.md` and `android146-security-physical-acceptance-2026-11-14.json` for its scoped acceptance and artifact SHA256. APKs, signing inputs and private device/report evidence remain outside Git.

The dated build/qualification/install procedures preserve the history of locally pinned baseline-plus-overlay builds139–146. They are machine-specific, guarded procedures rather than commands to replay against a new source tree. A future build should use the published source checkpoint and qualified native/signing inputs. The installed app must be updated in place, preserving data; a new handoff alone is not a reason to rebuild or reinstall.

Device UI acceptance does not imply store readiness, live SMS/notification capture, full voice acceptance or a complete authenticated report-delivery cycle. Read the current operational handoff for those boundaries.
