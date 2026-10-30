# Custom monthly report cycle — exact API amendment

The actual same-owner phone test selected month-start day25. Its ordinary report read requested 25 October–24 November, but the running API returned 1–31 October. The client rejected this mismatch. An isolated read of the actual running module reproduced the calendar-only result: its compiled `resolveReportPeriod` predates the already published custom-cycle source. The deployed DTO validates the day and the service passes it correctly; neither needs a change.

The inert candidate replaces only that pure function in `reports.period.js` with the installed TypeScript compilation of the existing source. Every byte outside the function is retained. The resulting whole-file SHA256 equals the earlier qualified API compilation. Reports/PDF delivery and engagement fixes remain in the base image.

- Current image: `sha256:4bcd2e7fbdc31060df6614b41f9ca19a13f48a65b50d1ba9ce34abbd357bf9f9`.
- Candidate: `sha256:32062a69f0a73e9ea684c7954673ecdc484fd4afb55e5c4ad5e2135015939f2e`.
- Patched module: `dc70d6d9abfc1ab94b1d34e868a1e07af4774781466d0e4313e8042574ad393a` → `d4d0cfc6c65bb108d1d4917d81a14ef0ed70a464b72fead734a164f0d18c19e2`.
- Patch manifest: `b13bae4c8a5a0c2bc2a85aba287020b21a271869dea39d885f2c6e48f32fe0c3`.
- Runtime proposal: `8163b198f34f3f172b2d4cddaf9d20e5c99e7f4da32ddd00bce9cc3ac265b0b3`.
- [Exact request packet](2026-10-31-report-cycle-api-addendum.json), SHA256 `03631bbe48db0c15970d0ddf30e6d4bbdfb1486d68e47504b6d99db9ec5a9503`.

Preparation used no network or application startup. The old image reproduced the cycle25 defect; the candidate passed ten cycle-boundary/invalid-input cases and four unchanged calendar cases. Syntax and exact image-config checks passed. All36 existing Docker services retained their images, configurations, start identities and restart counts. Admin3038 remained active at its original PID; Nginx and database CA hashes were read again without changes. The candidate is built and **has not been activated**.

Approve one API-only handover to this exact candidate. Require fresh host resources, unchanged original phone financial/draft projections and native producers, unchanged Admin/Nginx/CA, and zero queued/processing assistant jobs observed within15seconds after pausing the API. Use the existing120-second deadline, begin rollback by70seconds on uncertainty, graceful stop only and retained current/prior APIs. Verify created/running configuration hashes and the previously reviewed Docker `null → false → null` OOM representation; preserve the other35 services exactly. After health passes, inspect ordinary Reports cycle1/25 and existing account scopes, then restore the original preferences.

This amendment permits no new PDF request/download, ZIP, consumer window or renewal, provider call, feedback/ticket message, financial command, role/permission change, migration/grant, APK build/install, Metro restart, Admin/Nginx deployment, Production or T20–T22 work. The earlier API approval pinned a different image, so it cannot authorize this replacement. The user’s same-device/account continuation remains in effect; no substitute identity is required for these read checks.
