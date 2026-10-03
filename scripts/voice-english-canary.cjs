// Operational one-shot harness; application image/code, policy and retries are unchanged.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const {
  semanticChecks,
  completeCanary,
  receiptEvidence,
  saveCanaryResult,
  assertCanaryEvidence,
} = require("./voice-canary-contract.cjs");
let providerCategory;
const { createRequire } = require("node:module");
const root = existsSync("/app/dist/src")
  ? "/app/dist/src"
  : path.resolve(__dirname, "../apps/api/dist/src");
const load = createRequire(path.join(root, "ai/ai.worker.js"));
const { AiWorker } = load(path.join(root, "ai/ai.worker.js"));
const { AiGateway } = load(path.join(root, "ai/ai.gateway.js"));
const { AiRepository } = load(path.join(root, "ai/ai.repository.js"));
const { AiStorage } = load(path.join(root, "ai/ai.storage.js"));
const { PoolService } = load(
  path.join(root, "platform/database/pool.service.js"),
);
const { PlatformConfigService } = load(
  path.join(root, "platform/config/platform-config.service.js"),
);
const { validateEnvironment } = load(
  path.join(root, "platform/config/environment.schema.js"),
);
const { ConfigService } = load("@nestjs/config");
const { VERTEX_VOICE_OUTPUT_SCHEMA } = load(
  path.join(root, "ai/voice-provider-schema.js"),
);
const model = "google/gemini-3.5-flash-lite";
const digest = (v) => createHash("sha256").update(v).digest("hex");
const evidence = {
  at: new Date().toISOString(),
  dispatches: 0,
  automaticPolling: false,
};
function guardedFetcher(audioHash, forward, result = evidence) {
  return async (url, init) => {
    assert.equal(result.dispatches, 0, "SECOND_DISPATCH_BLOCKED");
    assert.equal(String(url), "https://openrouter.ai/api/v1/chat/completions");
    const b = JSON.parse(init.body);
    assert.equal(b.model, model);
    assert.equal(b.temperature, undefined);
    assert.equal(b.stream, false);
    assert.deepEqual(b.provider, {
      only: ["google-vertex/global"],
      allow_fallbacks: false,
      require_parameters: true,
      data_collection: "deny",
      zdr: true,
      max_price: { prompt: 1, completion: 3 },
    });
    assert.equal(b.max_tokens, 1200);
    assert.equal(b.response_format.type, "json_schema");
    assert.equal(
      digest(JSON.stringify(VERTEX_VOICE_OUTPUT_SCHEMA)),
      "1b256ea35d6373934fd2dd340a2dc2b6b62a2fc136fa931dc5fa0e9d17cf85c4",
    );
    assert.deepEqual(
      b.response_format.json_schema.schema,
      VERTEX_VOICE_OUTPUT_SCHEMA,
    );
    assert.equal(b.response_format.json_schema.strict, true);
    const audio = b.messages[1].content.find((x) => x.type === "input_audio");
    assert.equal(audio.input_audio.format, "m4a");
    assert.equal(
      digest(Buffer.from(audio.input_audio.data, "base64")),
      audioHash,
    );
    result.dispatches++;
    result.request = {
      model: b.model,
      provider: b.provider,
      temperatureOmitted: true,
      schemaFingerprint: digest(JSON.stringify(VERTEX_VOICE_OUTPUT_SCHEMA)),
      mediaHashMatches: true,
      format: "m4a",
      maxTokens: b.max_tokens,
    };
    const r = await forward(url, init);
    result.http = r.status;
    // Never persist the response content, transcript, prompt or unrestricted rejection string.
    const clone = r.clone(),
      reader = clone.body?.getReader();
    let size = 0,
      parts = [];
    if (reader)
      try {
        for (;;) {
          const v = await reader.read();
          if (v.done) break;
          size += v.value.length;
          if (size > 262144) {
            result.envelopeRead = "bounded-limit";
            void reader.cancel();
            break;
          }
          parts.push(Buffer.from(v.value));
        }
        if (size <= 262144) {
          const j = JSON.parse(Buffer.concat(parts).toString("utf8"));
          if (r.status === 200) {
            try {
              providerCategory = JSON.parse(
                j.choices?.[0]?.message?.content,
              ).categoryId;
            } catch {
              providerCategory = undefined;
            }
          }
          const safe = (v, pattern) =>
            typeof v === "string" && v.length <= 160 && pattern.test(v)
              ? v
              : null;
          result.envelope = {
            generationId: safe(j.id, /^gen-[A-Za-z0-9-]+$/),
            model: j.model === model ? model : null,
            provider: j.provider === "Google Vertex" ? "Google Vertex" : null,
            finishReason: [
              "stop",
              "length",
              "content_filter",
              "tool_calls",
              "error",
            ].includes(j.choices?.[0]?.finish_reason)
              ? j.choices[0].finish_reason
              : null,
          };
        }
      } catch {
        result.envelopeRead = "unparseable";
      } finally {
        reader.releaseLock();
      }
    return r;
  };
}
async function selfTest() {
  const hash = digest(Buffer.from("fictional"));
  const body = {
    model,
    stream: false,
    max_tokens: 1200,
    provider: {
      only: ["google-vertex/global"],
      allow_fallbacks: false,
      require_parameters: true,
      data_collection: "deny",
      zdr: true,
      max_price: { prompt: 1, completion: 3 },
    },
    response_format: {
      type: "json_schema",
      json_schema: { strict: true, schema: VERTEX_VOICE_OUTPUT_SCHEMA },
    },
    messages: [
      { role: "system", content: "offline" },
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              format: "m4a",
              data: Buffer.from("fictional").toString("base64"),
            },
          },
        ],
      },
    ],
  };
  for (const status of [400, 503]) {
    let actual = 0;
    const state = { dispatches: 0 };
    const run = guardedFetcher(
      hash,
      async () => {
        actual++;
        return new Response("{}", { status });
      },
      state,
    );
    await run("https://openrouter.ai/api/v1/chat/completions", {
      body: JSON.stringify(body),
    });
    await assert.rejects(() =>
      run("https://openrouter.ai/api/v1/chat/completions", {
        body: JSON.stringify(body),
      }),
    );
    assert.equal(actual, 1);
    assert.equal(state.dispatches, 1);
  }
  for (const sample of [
    { body: "not-json", status: 400 },
    {
      body: JSON.stringify({
        id: "gen-offline-test",
        model,
        provider: "Google Vertex",
        choices: [{ finish_reason: "stop" }],
      }),
      status: 200,
    },
  ]) {
    const state = { dispatches: 0 };
    const response = await guardedFetcher(
      hash,
      async () => new Response(sample.body, { status: sample.status }),
      state,
    )("https://openrouter.ai/api/v1/chat/completions", {
      body: JSON.stringify(body),
    });
    assert.equal(await response.text(), sample.body);
    assert.equal(state.dispatches, 1);
    if (sample.status === 400) assert.equal(state.envelopeRead, "unparseable");
    else assert.equal(state.envelope.generationId, "gen-offline-test");
  }
  for (const mutate of [
    (b) => (b.temperature = 0),
    (b) => (b.provider.zdr = false),
    (b) => (b.provider.only = ["google-vertex"]),
    (b) => (b.response_format.json_schema.strict = false),
    (b) => (b.messages[1].content[0].input_audio.format = "mp3"),
  ]) {
    const b = structuredClone(body);
    mutate(b);
    let calls = 0;
    await assert.rejects(() =>
      guardedFetcher(
        hash,
        async () => {
          calls++;
          return new Response("{}", { status: 400 });
        },
        { dispatches: 0 },
      )("https://openrouter.ai/api/v1/chat/completions", {
        body: JSON.stringify(b),
      }),
    );
    assert.equal(calls, 0);
  }
  const context = {
    capture: { referenceLocalDate: "2026-10-02" },
    references: [
      {
        alias: "ACCOUNT-1",
        id: "cash",
        kind: "account",
        version: 1,
        data: { type: "cash", currency: "SAR" },
      },
      {
        alias: "CATEGORY-2",
        id: "04000000-0000-4000-8000-000000000002",
        kind: "category",
        version: 1,
        data: { kind: "expense", labelEn: "Food", labelAr: "الطعام" },
      },
    ],
  };
  const output = {
    transcript: "I spent fifteen Saudi riyals on groceries today using cash",
    language: "en",
    proposal: {
      amountMinor: "1500",
      currency: "SAR",
      type: "transaction.create",
      date: "2026-10-02",
      accountId: "ACCOUNT-1",
      categoryId: "CATEGORY-2",
    },
  };
  assert(
    Object.values(semanticChecks(output, context)).every((x) => x === true),
  );
  for (const patch of [
    { amountMinor: "-1500" },
    { amountMinor: 1500 },
    { type: "expense" },
    { accountId: "ACCOUNT-2" },
    { categoryId: null },
    { date: "2026-10-01" },
  ])
    assert(
      Object.values(
        semanticChecks(
          { ...output, proposal: { ...output.proposal, ...patch } },
          context,
        ),
      ).some((x) => x === false),
    );
  console.log(
    JSON.stringify({
      mode: "offline-self-test",
      inferenceRequests: 0,
      checks: 16,
      secondDispatchBlocked: true,
      invalidContractsBlocked: true,
      canonicalSignAndReferenceChecks: true,
      responsePreserved: true,
    }),
  );
}
async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  assert(
    process.argv.includes("--preflight") ||
      process.argv.includes("--approved-single-english"),
    "EXPLICIT_CANARY_APPROVAL_FLAG_REQUIRED",
  );
  const config = new PlatformConfigService(
    new ConfigService(validateEnvironment(process.env)),
  );
  evidence.harnessFingerprint = digest(readFileSync(__filename));
  evidence.helperFingerprint = digest(
    readFileSync(require.resolve("./voice-canary-contract.cjs")),
  );
  evidence.checkerFingerprint = digest(
    readFileSync(require.resolve("./voice-category-acceptance.cjs")),
  );
  const sha = process.argv.find((x) => x.startsWith("--sha="))?.slice(6);
  assert(/^[0-9a-f]{40}$/.test(sha || ""));
  assert.equal(config.getRequired("MASARIFI_RELEASE_VERSION"), sha);
  evidence.candidate = sha;
  assert.equal(config.getRequired("MASARIFI_PROCESS_KIND"), "worker");
  const pool = new PoolService(config),
    repo = new AiRepository(pool);
  let worker, categoryReferences;
  const originalWorkInput = repo.workInput.bind(repo);
  repo.workInput = async (...args) => {
    const input = await originalWorkInput(...args);
    categoryReferences = input.aliases;
    return input;
  };
  try {
    const route = await repo.getRoute("voice_transcription");
    assert(route);
    assert.equal(route.primary.modelId, model);
    assert.equal(route.primary.provider, "google-vertex");
    assert.deepEqual(route.fallbacks, []);
    assert.equal(route.zdrRequired, true);
    assert.deepEqual(route.providerAllowlist, ["google-vertex"]);
    assert.equal(route.limits.outputTokens, 1200);
    evidence.route = {
      primary: {
        modelId: route.primary.modelId,
        provider: route.primary.provider,
      },
      fallbackCount: route.fallbacks.length,
      limits: route.limits,
      maxPrice: route.maxPrice,
      zdrRequired: route.zdrRequired,
      promptFingerprint: digest(route.prompt.template),
    };
    evidence.runtime = {
      providerEnabled: config.getRequired("MASARIFI_AI_PROVIDER_ENABLED"),
      batchSize: config.getRequired("MASARIFI_AI_JOB_BATCH_SIZE"),
      concurrency: config.getRequired("MASARIFI_AI_MAX_CONCURRENCY"),
    };
    if (process.argv.includes("--preflight")) {
      evidence.mode = "read-only-worker-preflight";
      console.log(JSON.stringify(evidence));
      return;
    }
    const session = process.argv
      .find((x) => x.startsWith("--session="))
      ?.slice(10);
    assert(/^[a-f0-9-]{36}$/.test(session || ""));
    const bytes = readFileSync("/tmp/lite-fictional-en.m4a");
    assert.equal(
      digest(bytes),
      "8e7d2b519d8e6683e043593d4940e2b4ce751b3fa4b315067990b700ebe3b5f3",
    );
    assert.equal(config.getRequired("MASARIFI_AI_PROVIDER_ENABLED"), true);
    assert.equal(config.getRequired("MASARIFI_AI_JOB_BATCH_SIZE"), 1);
    assert.equal(config.getRequired("MASARIFI_AI_MAX_CONCURRENCY"), 1);
    const claim = repo.claimWork.bind(repo);
    repo.claimWork = async (...args) => {
      const rows = await claim(...args);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, session);
      evidence.claimed = 1;
      return rows;
    };
    const completed = repo.completeWork.bind(repo);
    repo.completeWork = async (...args) => {
      const r = await completed(...args);
      evidence.workStatus = args[3];
      evidence.failureCode = args[4] ?? null;
      return r;
    };
    const save = repo.saveVoiceResult.bind(repo);
    repo.saveVoiceResult = (...args) => saveCanaryResult(save, args, evidence);
    const gateway = new AiGateway({
      apiKey: config.getRequired("OPENROUTER_API_KEY"),
      fetcher: guardedFetcher(digest(bytes), fetch),
    });
    const complete = gateway.complete.bind(gateway);
    gateway.complete = async (input) => {
      const originalReceipt = input.onReceipt;
      return completeCanary(
        complete,
        {
          ...input,
          onReceipt: async (r) => {
            await originalReceipt?.(r);
            evidence.receipt = receiptEvidence(r);
          },
        },
        categoryReferences,
        evidence,
        () => providerCategory,
      );
    };
    worker = new AiWorker(repo, new AiStorage(config), gateway, config);
    assert.equal(await worker.runJob("voice.transcribe_extract"), 1);
    assert.equal(worker.timer, undefined);
    assert(evidence.dispatches <= 1);
    assertCanaryEvidence(evidence);
    console.log(JSON.stringify(evidence));
  } finally {
    if (worker) await worker.stop();
    await pool.onModuleDestroy();
  }
}
main().catch((e) => {
  console.error(
    JSON.stringify({
      stage: "one-shot-harness",
      code: [
        "VOICE_CANARY_SEMANTIC_FAILED",
        "VOICE_CANARY_REFERENCE_INVALID",
      ].includes(e.message)
        ? e.message
        : e.name === "AssertionError"
          ? "GATE_ASSERTION_FAILED"
          : "HARNESS_FAILED",
      ...evidence,
    }),
  );
  process.exitCode = 1;
});
