# Redmi Home account picker

The Home account picker displays active accounts. It previously subscribed to the archived-inclusive balance query. For example, when an archived account exists, the full-set seed cannot be satisfied by Home's active accounts. Row names can appear while the picker waits for a separate balance read. A release recording captured the names and controls in their final positions while the balance column was still changing. The picker now observes Home's owner-scoped active balance query. It can render its current projection immediately and updates on refresh. The manual-entry picker keeps its existing query.

## Timing

Signed production-mode APKs, same Redmi 23076RN8DY, same installation, profile and dataset. Each trial force-stopped and relaunched the app, waited for a readable Home balance, and tapped the Accounts quick action. No account was selected and no transaction was posted. The endpoint was the first device frame from which the visible balance column continuously matched the final column. The 540 × 1230 video was decoded at its native frame timestamps. The balance-column comparison used the same mean grayscale difference limit (1.1 on a 0–255 scale) in both arms. Each final column had to correlate above 0.96 with the private reference from the same session. The start was the device uptime immediately before issuing the input tap, so these values include input dispatch. This endpoint measures visible balances. Fresh server confirmation has a separate timing boundary.

| Release and method | Trials | Median (ms) | p95 (ms) |
| --- | ---: | ---: | ---: |
| Current release before the change | 30 | 1534.5 | 2543 |
| Release with the picker fix | 30 | 484 | 665 |
| Historical build preceding the Reports change | 12 | 1265.5 | 2005 |
| Before, screenshot polling | 10 | 1188.5 | 2178 |
| After, screenshot polling | 10 | 1189 | 1335 |

The primary comparison used 20 control trials, 15 candidate trials, 10 more control trials and 15 more candidate trials. The historical build and screenshot checks were separate. Video frames and input used the same device timebase. The screenshot method includes USB transfer and capture overhead. All p95 values are nearest rank. With 10 observations the reported p95 is the maximum.

The original screenshot samples reported 1,606 and 2,194 ms at p95. The historical version also exhibits the slow path. Those two small samples cannot establish a causal regression in Reports or identify the exact duration of its slowest balance request.

## Verification and rollback

The focused mobile suite passed 193 tests on the Android/shared branch and 198 on the iOS branch. Device timings here are for Android only. The component regression checks the initially displayed amount, the subsequent authoritative update, active-only balance reads, currency mismatches and authoritative denial. The device check verifies the original balance and manual draft without logging their values. Both APKs use the same version code for in-place crossover and rollback. The control APK can be reapplied using a same-signer package update.

In the primary comparison, 23 of 30 control trials and 1 of 30 candidate trials took more than one second. A USB transport interruption during a secondary screenshot check occurred before the tap. The interrupted trial was retried.

- Control source `00e515bb2d53d7edb3509b87c83a25f5580b6679`, APK SHA-256 `276a21ecb8f65c5833b86092df87d9af2d1228465a35ea5be1a4602e27a0d132`.
- Candidate source `55a975ea5c3e884aec45f28fac020d1f420b86a8`, APK SHA-256 `704a1c32b688c693be264afa058bda6315b19c7b5df83ac2c194dd873bcb8179`.

## Frame samples in collection order (ms)

- Control — 2053, 455, 2046, 1129, 2741, 1316, 983, 1993, 487, 1685, 2064, 1480, 455, 1996, 961, 2308, 1598, 1413, 1336, 793, 1516, 1783, 512, 2543, 2382, 1104, 1214, 1613, 2118, 1553.
- Candidate — 451, 483, 510, 495, 451, 436, 448, 427, 467, 480, 619, 445, 665, 1788, 465, 478, 441, 485, 487, 516, 460, 651, 563, 492, 447, 474, 487, 491, 486, 521.
- Pre-Reports control — 2005, 459, 475, 1962, 1453, 487, 1239, 1260, 1540, 1404, 1271, 1109.
