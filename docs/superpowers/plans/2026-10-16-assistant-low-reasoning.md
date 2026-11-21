# DEV assistant reasoning latency and plain answers

The deployed DEV assistant passed the sampled latest-transaction, spending, period-comparison and unrelated-question checks, but leaked Unicode fact identifiers in two answers and rejected a greeting. One late server answer also required manual UI recovery. Provider time dominates the observed response time. Keep the selected model, provider, limits, quota, finance boundary and exact fact grounding. Request low reasoning only for the new assistant agent on the supported GPT-6 Luna candidate. Ordinary assistant and Voice calls retain their existing request bodies; unsupported fallback models receive no reasoning parameter.

- [x] RED: capture actual gateway HTTP bodies for explicit opt-in, absent opt-in, missing current question, other workload, Voice and unsupported model/fallback.
- [x] RED: run the real assistant agent and gateway against a synthetic provider boundary to prove the agent selects low reasoning.
- [x] GREEN: add the narrowly gated internal option and agent opt-in.
- [x] Ask for plain readable answer text without Markdown/decorative brackets; preserve all reference and numeric rules.
- [x] Reproduce the live subscript fact-ID leak, reject unsupported Unicode numeric prose, and repair through the existing bounded model flow without publishing identifiers or fabricated values.
- [x] Run focused tests, API unit/contract checks and typecheck/lint; report limitations.
- [ ] Root: re-evaluate actual DEV provider answer quality, response time and plain formatting before claiming an improvement.

Primary references already checked by the root: [GPT-6 Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna), [OpenRouter reasoning controls](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens). The source tests establish request compatibility, not model quality or speed.

Local evidence is stored privately under `D:/Masarifi-preservation-2026-10-16/reliability/`: `assistant-reasoning-red.json`, `assistant-unicode-red.json`, `assistant-reasoning-unicode-green.json`, and `assistant-latency-api-unit-contract.json`. The unit/contract run passed 249 suites and 1843 tests. The final focused run also covers the strengthened real-gateway correction flow and authoritative Unicode values. No provider requests, remote changes or device actions were made by this source task.

Live baseline also found a standalone greeting incorrectly rejected as outside scope. The prompt now explicitly allows brief greetings/thanks within the financial assistant, preserves the prior financial topic, and keeps accompanying unrelated requests outside scope. This prompt behavior needs greeting/follow-up live acceptance on the candidate; no fixed greeting or financial answer is installed.
