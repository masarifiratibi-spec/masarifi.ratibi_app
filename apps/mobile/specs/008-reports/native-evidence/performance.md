# Performance Evidence

Date: 2026-08-10

Status: AUTOMATED PASS; 10,000-RECORD DEVICE MEASUREMENT OPEN

Automated evidence:

- `src/features/reports/reports-performance.test.ts` builds a real 10,000-record report and checks
  a non-empty exact result under the 2,000 ms threshold.
- The fresh complete Jest run passed 262 suites and 600 tests, including this performance check.
- The report aggregation remains one-pass O(n), and report drill-down uses the existing virtualized
  transaction list.

Native evidence:

- The physical Android development build renders and switches its normal 500-record report fixture.
- The installed build has no supported UI/deep-link selector for the 10,000-record fixture, so a
  device measurement would require changing runtime product data or adding a test-only production
  control. Neither was treated as release evidence.

T082 remains open until a supported benchmark build or instrumentation path supplies the 10,000
records on Android/iOS and records at least 20 warm selections so the 95th-percentile target can be
calculated honestly.
