# Vertex Voice schema — single English canary evidence

Date: 2026-10-03. Status: **provider transport passed; full English acceptance failed; STOP**.

## Decision

Exactly one approved fictional English M4A was submitted through ordinary authenticated Staging create/upload/process and the real exact-image Worker. OpenRouter/Google returned HTTP200, accepted audio and structured output, and the repaired normalizer plus unchanged canonical validator accepted the response. The additional canary semantic predicate failed **only categoryCorrect**. The harness rejected the result before persistence; therefore no reviewable proposal was established. Do not classify this as a repeat Vertex400, canonical schema rejection, or complete T08/Master acceptance.

No Arabic, Samsung, fallback, second dispatch, financial confirmation or further model/schema experiment followed. No unknown-cost hold was released. No production source was edited in this continuation.

## Provenance and admission

- Exact candidate: `5912c388583a0c032f919d809bb4fca2542ee9c6`.
- Exact CI: [37069178332](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/37069178332), freshly re-read completed/success with that head SHA. No new CI dispatch.
- Immutable Worker image: `ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:1897cc2feea3ca4e48dbe04363779040897b79a9709ab4beb3de88a3d1aaa9de`.
- Accepted onboarding API remained healthy on image `sha256:3ed2ad83dbbfbb572a70593ea24828907f265ba3a7229e24c015fd6e7af257f4` / historical SHA5113fb7. It was not replaced by the AI-only candidate. Ordinary polling Worker remained Created/stopped.
- Browser Clerk identity fingerprint matched the approved customer; authenticated GET/me returned the same mapped active profile. No email/token/credential exported. Samsung owner provenance remains historical; no fresh physical phone identity inspection was made.
- Existing active SAR cash account and category references were reused. No financial reference or profile created/modified.
- Input: existing fictional `lite-fictional-en.m4a`,50528bytes,3969ms, SHA256 `8e7d2b519d8e6683e043593d4940e2b4ce751b3fa4b315067990b700ebe3b5f3`; current capture context, Riyadh offset-180.
- Owner quota before admission4/5; eligible inference jobs0; four unknown-cost holds$0.52640000.

## Correlated path

Session `d40166f0-53ad-4795-9ec7-eebd0dc49f2a`.
PROCESS identity `2c5e85ce-dc4a-402a-bbb7-a1336dcb81b2`.
Generation `gen-1791009433-22bRq5H35MiCDRqbNFw0`.

| Boundary | Actual evidence |
| --- | --- |
| Create | HTTP201; created06:35:57.541Z |
| Authenticated upload | HTTP200; uploaded06:35:58.361Z; hash verified; M4A50528bytes |
| Process | HTTP202 queued; finalized06:36:25.344Z |
| Admission | One reservation$0.13160000; one eligible job; no prior attempt for this session |
| Worker | Exact candidate, one claim, one dispatch, batch1/concurrency1, no automatic polling |
| Storage/media | Normal download, magic/size/hash gate passed; exact fixture bytes forwarded |
| Governed request | Modelgoogle/gemini-3.5-flash-lite; onlygoogle-vertex/global; fallbackfalse; require_parameterstrue; data_collectiondeny; zdrtrue; max_tokens1200; temperaturenotpresent |
| Provider schema | json_schema/stricttrue; fingerprint1b256ea35d6373934fd2dd340a2dc2b6b62a2fc136fa931dc5fa0e9d17cf85c4 |
| Provider response | HTTP200; requested model returned; providerGoogle; finishstop; gateway latency3817ms |
| Normalization/canonical | Passed unchanged canonical parse |
| English semantics | transcript present/correct, languageen, amount1500positive expense, currencySAR, datecorrect, cashaccountcorrect; categoryCorrectfalse |
| Persistence | Semantic harness assertion before save; Worker terminalfailed/AI_SCHEMA_INVALID; no transcript or proposal persisted |
| Recovery | Authenticated read returnedfailed; test UI stoppedNOT_REVIEWABLE |
| Cancel | HTTP200 acknowledged; cancelled06:38:53.512Z; failure_codeVOICE_CANCELLED; no requeue |
| Cleanup | Normal due-media purge only, no usage rollup/inference; final target media0/referencecleared |
| Finance | Transactions0; confirmed_minor0 throughout |

Times are UTC; add3hours for Riyadh. The synthetic test has no recording/Stop/native Samsung evidence.

## Category finding and its limits

The failed predicate is:

`context.references.some(x => x.alias === output.proposal.categoryId && x.kind === 'category' && x.data.kind === 'expense' && /grocer|بقال|تسوق/i.test(JSON.stringify(x.data)))`.

Source review confirms real context uses category data `{kind,labelAr,labelEn}`, matching the checker and its offline fixture. A fresh read-only query found16active expense categories, **one matching that same acceptance pattern**. Thus the target pattern is not absent from all available references.

However, the safe one-shot receipt intentionally retained neither the output category value nor finer category predicates. The raw response was not stored. It is not possible to distinguish null/missing selection, another supplied alias, an unknown alias, or another mismatch from this receipt. Do not claim an exact model selection or root cause not evidenced. No provider response content was fetched to reconstruct it.

`AI_SCHEMA_INVALID` here results from the **additional operational semantic assertion**, which the existing Worker error path classified. It is not proof that the production canonical parser rejected this provider output. The normal production Worker would have continued alias resolution and result persistence without this extra predicate; that continuation was deliberately not exercised after the stop condition. An editable null/wrong category may have been representable in review, but no evidence supports retroactively declaring acceptance.

Future offline investigation should make acceptance receipts distinguish category-present, alias-known, category-kind and expected-category match using booleans only, and test those predicates against actual context shapes. No new paid attempt is authorized by this report. Do not change provider/model/audio/privacy/schema based solely on categoryCorrectfalse.

## Provider and accounting evidence

An immediate generation metadata lookup returned404; one later read-only lookup at06:40:14.755Z returned200. These were metadata reads, not inference retries.

- Generation model revision: `google/gemini-3.5-flash-lite-20260721` under requested aliasgoogle/gemini-3.5-flash-lite.
- Provider nameGoogle, data_regionglobal, native finishSTOP, cancelledfalse, BYOKfalse.
- num_input_audio_prompt1; native tokens1434input/141output; reasoning0.
- **Actual cost$0.00078270**, matching response usage, provider generation receipt, durable attempt and reconciled reservation exactly.
- One durable provider attempt, completed; reservation completed/estimated_cost$0.00078270. Initial$0.13160000 estimate is not a charge.
- Final owner quota **5/5**; Cancel does not erase a completed billed processing event.
- Four pre-existing unknown-cost holds remain **reserved$0.52640000**, billednull. No rollup or manual release in cleanup.
- Key metadata after attempt: limit$2; remaining$1.99772955; usage$0.00227045; monthlyusage$0.00159720. Globalbudget$2 unchanged.

The outgoing provider pin and privacy fields were asserted before forwarding. Generation metadata independently confirmsGoogle/global; it does not independently disclose internal endpoint slug or prove retention implementation. No unexpected provider or privacy configuration change was observed.

## Cleanup and preservation

Normal Cancel was submitted through the authenticated API. A target-only purge guard initially rejected a claim before Storage deletion because older due media preceded the target; the target remained unclaimed. The normal due-media purge path then ran once, claimed4due records, and completed target cleanup. It executed no provider work or usage rollup. Final database target receipt at06:44:55.971Z: cancelled, attempt1, media0, transcript0, proposal0, transactions0, balance0, eligible0.

Temporary single-path test page removed with the reviewed hash-fenced remover; Nginx restored exactly:

- Nginx `79b7595b0c660d930fead77a1b091e83a2fa8c6d3c6e51df92860b156d8210a9`.
- API env `abdb3bec68ec0489a06e3f5eaac682bf76679f6c1730210a7c7b49cde7085bef`.
- Worker env `968bd7f73bd3936cdd40aad8c099479df8bb40c668d27cc148d6f6bb244afb29`.

Routeversion5, approved promptversion1, provider/safety/unrelated-route fingerprints match preflight. No Production access/change, credentials, budgets, model route, migrations, APK, branch integration or financial confirmation. Approved SSH replacement remains in place; VPS page retained for the user.

Proof screenshot: ignored operational artifact `.superpowers/sdd/2026-10-02-final-ai-voice-integration-plan/vertex-schema-canary-cancelled.jpg`; shows content-free ordinary-auth test receipt and Cancel acknowledgement.

## Next boundary

The previous complex-schema400 was not reproduced with the repaired transport. **Full English acceptance remains failed at the category predicate before proposal persistence.** T08/Master remains open. Only offline evidence review is appropriate now; no additional canary, Arabic, Samsung or confirmation has been authorized by this stop report.
