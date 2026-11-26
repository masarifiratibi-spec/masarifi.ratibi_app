# Masarifi project instructions

Use [the maintained project guide](docs/project/README.md) for current architecture, platforms and evidence. Use `codex/voice-promoted-operating-2026-10-13` as the primary source for shared architecture, features, API, Admin, data and agent rules. Use `codex/google-play-release-2026-11-24` for Google Play differences and `iOS` for Apple differences. Check branch and upstream before editing. Review shared changes against the operating source and verify affected release consumers. Keep platform-specific changes on their release line.

Read the app constitution for domain rules. Name the commit and environment when reporting verification. Use live adapters in configured production profiles and fixtures only in their explicit demo/test modes. Enforce owner and staff permissions on the server. Use a disposable database for migration tests.

For old specs, release packets, command templates and runbooks, check the date, source pin and target in [the audit](docs/project/audit.md) first. A recorded production action is evidence for that release. CI or signing changes need their own review against the actual workflow conditions.
