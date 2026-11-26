# Opening Masarifi and asking the assistant on Redmi

Measured on November 20, 2026 on one physical Redmi with an existing signed-in account, Arabic Home, a signed Android release and the live API. The reference APK came from `012463a1dd6d`. Timings below are milliseconds.

## What the user sees

| Reference path | Observations | Median | Range |
| --- | ---: | ---: | ---: |
| Cold launcher start to the visible Home balance | 13 | 3,863 | 3,577–4,938 |
| Background return to the visible Home balance | 16 | 542.5 | 490–748 |
| Home assistant button to visible question cards | 4 | 597.5 | 576–608 |
| Tap the monthly spending suggestion to a visible answer | 1 | 1,711 | — |
| Send the typed spending summary question to a visible answer | 3 | 3,753 | 3,645–3,890 |

Home timing starts immediately before dispatch of the normal Android launcher intent. The endpoint is the screen-recording frame in which the balance glyphs settle. The UI tree verifies the displayed balance. Results are grouped by Android's reported launch state. Three reference launches classified as WARM (3,471, 3,513 and 3,643 ms) are separate from COLD and HOT. A painted balance can precede a network refresh.

The assistant landing and suggestion timings start at the recorded Android touch event. The typed-question timer starts on the device immediately before injecting the Send tap. Each ends at the relevant visible frame. The suggested Arabic spending-total question and the typed English summary request are different tasks. The typed comparison used “Summarize my spending this month in one sentence” in a new conversation each time, with one reference run before and two after the experiment. These small samples describe this handset and session. They do not support a p95 or an iPhone estimate.

## Experiments

| Change under test | Reference median | Trial median | Decision |
| --- | ---: | ---: | --- |
| Start the profile request alongside the local profile read, cold Home | 3,863 | 4,008 (6) | Reverted |
| Same change, background return | 510 | 630 (6) | Reverted |
| Wait for completion of the first pending assistant message before refreshing history, typed question | 3,753 | 4,040 (3) | Reverted |
| Defer module initialization in the Android release, cold Home | 3,872 (6) | 3,577.5 (8 successful COLD launches) | Reverted after a launch reached Welcome |
| Same change, background return | 544 (7) | 509 (9) | Reverted with the cold-start change |
| Same change, assistant opening | 597.5 (4) | 587 (3) | Reverted with the cold-start change |

The Android module-loading trial used two alternating reference/trial pairs. The cold medians by pair were 3,601 → 3,539 ms and 3,937 → 3,671 ms. After three successful cold launches in the second trial arm, the next launcher start opened the first-launch Welcome screen on the existing account. The UI still showed Welcome when checked afterward. That launch had no time to Home, and its planned background return was skipped. Timing summaries above count successful arrivals only. The underlying cause of the unexpected route is unresolved.

The final device build was restored to the reference APK and its installed hash verified. A functional check confirmed the original Home balance and manual draft, opened Reports and Assistant, and returned to Home. The trials used seven read-only assistant questions in fresh conversations. No financial transaction was submitted. The published change is this measurement report.

A reference native trace contained 169 ms in application binding and 155 ms initializing the React instance. These spans alone do not explain the full launch. The assistant measurements include network and server work. They do not isolate model execution time.

## iPhone coverage

Source inspection of the iOS branch at `b030a82b` found the same entry-route and Home-readiness logic, with Apple sign-in and saved authentication-method handling in the identity provider. The assistant has iOS-specific keyboard events and suggested-card layout. An iPhone was unavailable for device timing.
