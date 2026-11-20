# Redmi cold start with a returning account

## Why Welcome could appear

The handset had a completed server profile and a valid signed-in Clerk session. Its local first-launch completion flag was false. When an initial token rejection expired the shell session, the router consulted that flag and selected the new-installation route.

A transport-and-routing regression test exercises a specific instance of this problem. The service returns HTTP 401 with `AUTH_TOKEN_INVALID` for the cached credential on the first profile read. In the control revision `62e558f2`, the session controller expires the shell session, and the router selects `/welcome` despite the availability of a replacement credential. The test uses the real profile client, session restoration and entry-route resolver with a simulated server and Clerk session.

With the correction, a failed profile GET can fetch a fresh credential for the same Clerk user and session and repeat the read once. Profile restoration and the usual access checks then complete before Home opens. A repeated rejection requires sign-in. A session change prevents the replay. A returning owner with an expired session goes to sign-in even when the installation lacks the local welcome flag. Android production bundles also defer JavaScript module initialization.

The original unexpected Welcome screen had no request-level trace. The controlled replay establishes one cause. On the diagnostic build, the device reached Home on 45 consecutive process restarts, 18 restarts interleaved with background returns, and nine restarts using the earlier screen-recording sequence. The historical trigger remains unconfirmed.

## Handset comparison

The reference is the previously installed signed release built from `012463a1dd6d`. Both treatments use the same Redmi, signed-in account, package, Android user, live API and launcher path. The timer runs from launcher dispatch until the balance glyphs on Home settle. Each measured arrival is checked against the known reference balance. Android's COLD and WARM classifications are reported separately.

The timed comparison alternates reference, candidate, reference, candidate. A separate 90-second force-stop on each release tests reopening after an idle interval. The two candidate builds (`b71a6095` and `4ddb64ad`) produced byte-identical APKs with SHA-256 `e886b51f386a47b341a2e136445c05ba941abf3424384ad5ca39d8d22497d39c`. Both test builds excluded the diagnostic probes. An exploratory control run before the comparison had one unreadable Android UI snapshot. That run is excluded from the timed comparison.

| Launcher to visible balance | Reference | Corrected release |
| --- | ---: | ---: |
| First pair, COLD median | 3,809.5 ms (10) | 3,508.5 ms (14) |
| Second pair, COLD median | 3,872 ms (7) | 3,555 ms (9) |
| Combined COLD median | 3,844 ms (17) | 3,509 ms (23) |
| Combined COLD range | 3,655–4,536 ms | 3,404–4,211 ms |
| Combined WARM median | 3,530 ms (3) | 3,460 ms (9) |
| After a 90-second stop, COLD | 4,777 ms (1) | 3,569 ms (1) |

The combined cold median fell by 335 ms (8.7%). All 33 candidate launcher attempts reached Home with the reference balance, including the separate idle launch. All 21 matched reference attempts also reached Home. The idle observation is reported individually. The comparison covers one handset and account.

The corrected APK remained installed. Final checks verified the signed-in balance, the existing manual-entry draft, Reports, and Assistant navigation before returning to Home. Seven automated suites passed all 224 tests, and the mobile TypeScript check passed.
