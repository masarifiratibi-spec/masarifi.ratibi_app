# Voice T08 continuation and release evidence

Baseline: `facd77ca37372459204ae88bedd62c7fcac1e36a`. Date: 2026-10-02.

**Release blocked: the historical Vertex HTTP 400 has not been resolved. No successful physical inference is established.** The subsequent user request authorizes the Master Plan's coordinated Staging release and bounded Samsung acceptance, including controlled fictional confirmations. Production, credentials, routing, privacy and existing $2 limits remain unchanged.

## T08 implementation already present

The actual Worker constructs multimodal base64 M4A input and capture timestamp, local reference date and timezone context. The gateway requests governed JSON Schema output. Offline integration checks use the real request constructor, API serialization, Mobile parser, database and ledger, with a fake upstream. Bounded privacy-safe diagnostics classify allowlisted rejection codes, paths and schema keywords. Refusal/truncation and malformed envelopes are rejected; usage is accounted before output parsing. HTTP 400 does not trigger fallback.

These are useful prerequisites, not a demonstrated correction of the historical request rejection. The error fixtures are synthetic and do not identify Vertex's rejected field.

## Exact governed envelope inspection

An offline harness invoked the actual Worker and gateway with fabricated media/context and intercepted fetch; zero network requests were made. It replayed the retained governed route values, rather than claiming a fresh Staging configuration snapshot. No prompt, audio, base64, credentials or customer references are retained here.

- Endpoint: OpenRouter `/api/v1/chat/completions`, non-streaming.
- Model: `google/gemini-2.5-flash`.
- User content: text context plus `input_audio: {data: <base64>, format: "m4a"}`.
- Output: `response_format.type = json_schema`, `strict = true`, name `voice_transcription_v1`, actual `VOICE_OUTPUT_SCHEMA`.
- `max_tokens = 1200`, `temperature = 0`, `stream = false`.
- Provider: `only = ["google-vertex"]`, `allow_fallbacks = false`, `require_parameters = true`, `data_collection = deny`, `zdr = true`; retained governed price caps prompt 1/completion 3 per million tokens.
- Schema SHA-256: `c716fc1a49dc2aa0689963a12a53f53f68857a4c3b3e407ae54800a03e50501a`.

The installed JSON Schema validator accepts the schema. It contains `const`, root `oneOf`, nullable type arrays, branch-specific requirements and some enums without explicit types. This is valid JSON Schema; validity does not prove compatibility with OpenRouter's Vertex translation.

## Official contract comparison

[OpenRouter audio](https://openrouter.ai/docs/guides/overview/multimodal/audio) documents base64 input_audio and provider-dependent M4A support. [Google audio](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/audio-understanding) lists M4A for Gemini 2.5 Flash. Preserve the physically proven format repair.

[OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs) documents strict JSON Schema and parameter-capable routing. The public documentation does not establish the precise schema transformation used for this route/audio combination.

Google exposes distinct schema surfaces: [Vertex Schema](https://cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1/Schema) is an OpenAPI-style subset; [Google's official SDK configuration](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html) also documents richer `responseJsonSchema`, including oneOf interpreted as anyOf. [Structured output guidance](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output) warns that schema complexity can produce HTTP 400. Neither identifies the rejected field in the retained receipt. Removing const/oneOf or converting nullable fields would therefore be speculative.

Unpaid current endpoint metadata lists structured-output parameters for Vertex regional/global endpoints. It does not prove successful combined audio/schema processing or justify changing the provider tag. No provider/model, schema validation, security or format change has been made from these hypotheses.

## Exact-SHA CI failure and smallest corrections

Baseline run [36989207178](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/36989207178) tested exact facd77c and exposed two reproducible verification defects:

1. API application/database jobs installed only API dependencies, but the integrated journey imports the actual Mobile Zod parser. CI failed module resolution/typecheck. Both jobs now install the existing locked Mobile dependencies. The real parser remains under test; no duplicate schema or new dependency is introduced.
2. One Mobile retry test expected Riyadh's offset on a UTC runner. It now explicitly mocks that offset. Production timezone handling is unchanged.

Verification: API typecheck passes; gateway/workflow-pin tests 37/37 pass; Mobile hook suite under UTC 31/31 passes. On a fresh disposable PostgreSQL 18.6 database with all current migrations, the actual integrated fake-provider Voice journey passes 3/3. An older local scratch database had a stale four-argument dispatch function; fresh bootstrap resolved that fixture mismatch without a production change.

## Remaining release gates

Commit the verification corrections, run exact-SHA CI, obtain its immutable backend image, verify fresh Staging configuration/quota/privacy, apply reviewed forward migrations, deploy the matching backend and build/install the matching APK without clearing device data. Then perform lifecycle-only acceptance and one bounded fictional provider canary. Successful inference must include transcript, extraction, persisted proposal and visible review.

An opaque repeat HTTP 400 stops paid tests and requires a content-free provider trace/support investigation. Do not guess a schema fix, repeat probes, switch providers/models, raise budgets or claim completion. After successful T08, finish the planned Arabic/English Cancel/no-mutation and controlled exactly-once confirmation/restart checks.

No deployment, APK build/install, new recording or paid inference has occurred as of this report's initial commit. Subsequent receipts must distinguish offline tests, Staging checks and physical evidence.
