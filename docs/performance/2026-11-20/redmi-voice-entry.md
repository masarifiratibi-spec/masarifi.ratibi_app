# Redmi voice entry

One live transaction per build used the same Redmi (23076RN8DY), account, Arabic phrase and 17 SAR cash income. The participant spoke and pressed Stop in both trials. The participant opened recording in the first trial. The operator opened it in the second. An earlier attempt on the candidate never opened the microphone and produced no transaction.

| Interval | Before, 55a975ea | After, 012463a1 |
| --- | ---: | ---: |
| End of speech to Stop | 2.812 s | 2.390 s |
| End of speech to visible transaction | 12.682 s | 9.962 s |
| End of speech to visible updated Home balance | 13.623 s | 10.474 s |
| Stop to visible updated Home balance | 10.811 s | 8.084 s |

The speech endpoint was estimated from 20 ms microphone-level samples on a nearby computer. Android screen frame timestamps identified the first settled frames showing the new transaction row and balance. The best clock calibration round trips were 59 ms and 64 ms. These figures describe what appeared on screen. Persistence was checked separately by reopening the app.

Both builds displayed one new synchronized voice income on the cash account and the expected 17 SAR increase after reopening. Each trial's new row was then deleted by its unique identifier. The original balance, prior visible rows and existing manual-entry draft were verified after cleanup.

The mobile change uses the upload slot in the first successful create response. It omits one status request before upload and reuses the bytes already hashed. A resumed operation still checks authoritative state and verifies any reread audio against the journaled hash. In a controlled transport run with a fixed 150 ms delay per request, five fresh submissions per build took a median of 773 ms before and 618 ms after, with five and four network requests respectively. Both implementations reached the same terminal receipt. Provider, network and human timing also affect the two live observations, which do not establish a percentile or isolate the cause of the full difference.
