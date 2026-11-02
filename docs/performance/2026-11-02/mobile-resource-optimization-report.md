# Mobile resource corrections — 2 November 2026

Two narrow source changes reduce unnecessary local work. They preserve authentication, owner isolation, remote-data freshness and the existing SQLite schema/encryption lifecycle. No startup speedup or production readiness is claimed before comparing the signed candidate on the same phone.

The unchanged Release [baseline](authenticated-mobile-baseline-report.md) contains 40 authenticated process-cold launches and 360 successful GET responses. Every launch recorded three successful preference writes. The current empty-account startup p95 still exceeds three seconds in both languages.

## Unchanged automatic preferences

Previously, successful restoration assigned the authoritative currency and resolved time zone even when both already equaled the hydrated preferences. Each setter persisted the entire preference record to SecureStore and notified store subscribers.

Equality guards now sit only at those two automatic bootstrap call sites. Tests establish:

- Unchanged authoritative currency: one automatic write becomes zero.
- Unchanged resolved time zone: one write per profile snapshot becomes zero, including a later profile revision with the same zone.
- Changed currency/time zone: each still updates state and persists once.
- Explicit same-value setter calls still persist, preserving manual retry/repair behavior.

Profile persistence and its `updated_at` freshness contract remain intact. This change occurs after authoritative validation and does not explain or claim to eliminate the measured pre-HTTP startup interval.

## Bounded category persistence

`persistCategories` previously awaited one native `runAsync` upsert per eligible category. Expo performs a prepare/execute/finalize cycle for each invocation. The method now uses parameterized multirow upserts of at most 100 categories and 600 bindings, inside the same existing exclusive transaction.

The real SQLite regression fixture applies all current source migrations, including schema 16. It verifies ordered duplicate updates, forward parent and merge references, preservation of pending/sending/conflict rows and their favorites, failure in a later chunk, and deferred foreign-key failure at commit. All chunks roll back together. A boundary adapter used by category-service tests was updated to consume every bound six-column tuple; actual SQL execution is separately tested against `node:sqlite`.

With 207 ordered inputs and 205 distinct final rows, native upsert calls decrease from **207 to 3**, with at most 600 bindings per statement. This is a deterministic work-count reduction; the fixture does not measure Android milliseconds or SQLCipher CPU savings. Returned remote categories remain freshly mapped even when protected pending local rows are retained.

No category network pooling or completed-result cache was added. A separate trial coalescer was removed after it reused a held pre-invalidation result where a fresh Query read required a new request. The category service implementation and existing freshness rules remain unchanged.

## Validation and rollout boundary

The preference-guard snapshot passed all 4,661 mobile tests across 597 suites. After the storage change, a fresh coordinator run passed 162 tests across restoration, Foundation providers, preferences, real SQLite delta/persistence and live category-service suites. TypeScript, scoped ESLint, frontend-quality boundaries and diff checks passed. The combined source `2236b1bb` subsequently passed all required configured checks in [Foundation run 41420035868](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/41420035868), including all 4,668 mobile tests across 597 suites, database, Android, all five Admin browser projects and image/security checks. Production signing was skipped because this is not a tagged production release.

The original APK remains the measured baseline. The signed candidate comparison described below is complete; retain both artifacts and all scenario results. Any later source correction requires a distinct result destination and the same cold definition without clearing data. A smaller loading duration, a successful build or fewer SQL calls alone is not evidence that the startup latency target has passed.

Backend/worker cutover remains blocked by [hosted schema compatibility](hosted-schema-compatibility-report.md), independently of these local changes. Production decision: **NOT READY**.

The [signed-device comparison](mobile-resource-comparison-report.md) confirms 3→1 preference writes in every unchanged-owner launch, with all 360 candidate GETs successful. Startup improvement was not demonstrated: Arabic/English candidate HomeReady p95 is 4557.1/4061.0 ms. A later original-APK reference also slowed; the full A/B/A evidence is retained. The latest independent Benchmark candidate was restored after the reversible reference control for further read-only profiling. Both original applications and Metro remain preserved. [Qualification evidence](mobile-resource-qualification-evidence.json).
