// One-shot Staging shadow probe. Never accepts proposals/batches or invokes financial APIs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const root = "/app/dist/src";
const load = createRequire(path.join(root, "ai/ai.worker.js"));
const sha =
  process.env.MASARIFI_CAPACITY_CANDIDATE_SHA ||
  "397677423b9336722bc9af2405f1a5b1d7b3a623";
assert.match(sha, /^[a-f0-9]{40}$/);
const ownerPin =
  "e8a7dda4e09c741322e4e2ee3d1f4c4cb8d1950749e0f524854e560fc074c2c3";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const directory = "/probe";
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const write = (name, value) => {
  const target = path.join(directory, name),
    temporary = target + "." + randomUUID() + ".tmp";
  const fd = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(value));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temporary, target);
  const folder = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(folder);
  } finally {
    fs.closeSync(folder);
  }
};
const stage = process.argv[2];
const fixture = process.argv[3];
const model = "google/gemini-3.5-flash-lite";
const report = { candidate: sha, stage, fixture, dispatches: 0 };
const compactFields = {
  k: "kind",
  a: "amountMinor",
  c: "currency",
  b: "accountId",
  g: "categoryId",
  d: "date",
  m: "merchant",
  i: "independent",
  q: "confidence",
};
const sourceNames = {
  e: "explicit",
  s: "shared",
  o: "omitted",
  a: "ambiguous",
};
const kindNames = {
  e: "expense",
  i: "income",
  r: "repayment",
  t: "transfer",
  o: "obligation",
  u: "unsupported",
};
function normalizeCompact(event) {
  if (
    !event ||
    typeof event !== "object" ||
    Array.isArray(event) ||
    Object.keys(event).length !== 9 ||
    !Object.keys(compactFields).every((k) => k in event)
  )
    return event;
  const row = { note: "" };
  for (const [key, name] of Object.entries(compactFields)) {
    if (["c", "b", "d"].includes(key)) {
      const match =
        typeof event[key] === "string" && /^([esoa]):(.*)$/.exec(event[key]);
      row[name] = match ? match[2] : null;
      row[name === "accountId" ? "accountSource" : name + "Source"] = match
        ? sourceNames[match[1]]
        : null;
    } else
      row[name] =
        key === "k" ? (kindNames[event[key]] ?? event[key]) : event[key];
  }
  return row;
}
function parseEnvelope(value) {
  assert(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [
    "complete",
    "events",
    "language",
  ]);
  assert(["ar", "en"].includes(value.language));
  assert.equal(typeof value.complete, "boolean");
  assert(Array.isArray(value.events) && value.events.length <= 10);
  assert(Buffer.byteLength(JSON.stringify(value)) <= 16384);
  return value;
}
function guardRequest(url, init, schema, audio, dispatched) {
  assert.equal(dispatched, 0, "SECOND_DISPATCH_BLOCKED");
  assert.equal(String(url), "https://openrouter.ai/api/v1/chat/completions");
  const body = JSON.parse(init.body);
  assert.equal(body.model, model);
  assert.equal(body.max_tokens, 1200);
  assert.equal(body.temperature, undefined);
  assert.equal(body.stream, false);
  assert.deepEqual(body.provider, {
    only: ["google-vertex/global"],
    allow_fallbacks: false,
    require_parameters: true,
    data_collection: "deny",
    zdr: true,
    max_price: { prompt: 1, completion: 3 },
  });
  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.response_format.json_schema.strict, true);
  assert.deepEqual(body.response_format.json_schema.schema, schema);
  assert.equal(body.messages[1].content[1].input_audio.format, "m4a");
  assert.equal(
    hash(Buffer.from(body.messages[1].content[1].input_audio.data, "base64")),
    hash(audio),
  );
}
async function boundedClone(response) {
  const reader = response.clone().body.getReader(),
    parts = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 262144) {
        void reader.cancel();
        throw new Error("ENVELOPE_OVERSIZE");
      }
      parts.push(Buffer.from(next.value));
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}
function selfTest() {
  const schema = { type: "object" },
    audio = Buffer.from("fictional");
  const body = {
    model,
    max_tokens: 1200,
    stream: false,
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
      json_schema: { strict: true, schema },
    },
    messages: [
      {},
      {
        content: [
          {},
          { input_audio: { format: "m4a", data: audio.toString("base64") } },
        ],
      },
    ],
  };
  const call = (b) =>
    guardRequest(
      "https://openrouter.ai/api/v1/chat/completions",
      { body: JSON.stringify(b) },
      schema,
      audio,
      0,
    );
  call(body);
  for (const changed of [
    { ...body, max_tokens: 1800 },
    { ...body, model: "wrong" },
    { ...body, provider: { ...body.provider, zdr: false } },
    { ...body, provider: { ...body.provider, allow_fallbacks: true } },
  ])
    assert.throws(() => call(changed));
  assert.throws(() =>
    guardRequest(
      "https://openrouter.ai/api/v1/chat/completions",
      { body: JSON.stringify(body) },
      schema,
      audio,
      1,
    ),
  );
  const valid = {
    complete: true,
    language: "en",
    events: Array.from({ length: 10 }, () => ({})),
  };
  parseEnvelope(valid);
  for (const bad of [
    { ...valid, events: Array(11).fill({}) },
    { ...valid, language: "xx" },
    { ...valid, reason: "secret" },
    { ...valid, complete: "true" },
  ])
    assert.throws(() => parseEnvelope(bad));
  assert.throws(() =>
    assert.deepEqual({ hash: "changed" }, { hash: "original" }),
  );
  if (process.argv.includes("--fixtures")) {
    const references = read("references.json"),
      expected = read("expected.json")["en-ten"];
    const { decideVoiceBatch } = load(path.join(root, "ai/voice-batch.js"));
    for (const item of expected) {
      const raw = {
        k: item.kind === "expense" ? "e" : "i",
        a: String(item.amountMinor * (item.kind === "expense" ? 1 : -1)),
        c: "e:SAR",
        b: "e:" + references.find((r) => r.id === item.accountId).alias,
        g: references.find((r) => r.id === item.categoryId).alias,
        d: "o:",
        m: "",
        i: true,
        q: 1,
      };
      const result = decideVoiceBatch(
        { complete: true, language: "en", events: [normalizeCompact(raw)] },
        {
          recordedAt: new Date().toISOString(),
          timezoneOffsetMinutes: -180,
          defaultAccountId: references[0].id,
          references,
        },
      )[0];
      assert.equal(result.status, "eligible");
      for (const key of ["kind", "amountMinor", "accountId", "categoryId"])
        assert.equal(result.command[key], item[key]);
    }
  }
  console.log(JSON.stringify({ offlineGuards: "passed", networkCalls: 0 }));
}
async function observer() {
  assert.equal(process.env.MASARIFI_PROCESS_KIND, "migration");
  const { Client } = load("pg");
  const u = new URL(process.env.DATABASE_URL);
  assert(
    u.hostname.includes("supabase") &&
      decodeURIComponent(u.username).includes("qcffvfbpzvpwcwxwjyro"),
  );
  const db = new Client({
    connectionString: u.toString(),
    query_timeout: 5000,
  });
  await db.connect();
  try {
    await db.query("begin read only");
    const enabled = await db.query(
      "select to_regclass('private.voice_automatic_policy')::text as policy",
    );
    if (enabled.rows[0].policy)
      assert.equal(
        (await db.query("select enabled from private.voice_automatic_policy"))
          .rows[0].enabled,
        false,
      );
    const owner = (
      await db.query(
        "select id from public.profiles where status='active' and encode(sha256(convert_to(id,'UTF8')),'hex')=$1",
        [ownerPin],
      )
    ).rows;
    assert.equal(owner.length, 1);
    const ledger = {};
    for (const table of [
      "public.transactions",
      "public.transaction_postings",
      "public.account_balances",
      "audit.transaction_revisions",
    ]) {
      ledger[table] = (
        await db.query(
          `select count(*)::int count, encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text, '' order by to_jsonb(t)::text),''),'UTF8')),'hex') hash from ${table} t`,
        )
      ).rows[0];
    }
    const active = (
      await db.query(
        "select count(*)::int count from public.voice_sessions where status in ('uploaded','processing') and finalized_at is not null and expires_at>clock_timestamp() and deleted_at is null and cancelled_at is null",
      )
    ).rows[0].count;
    assert.equal(active, 0, "UNRELATED_VOICE_WORK_PRESENT");
    if (stage === "before")
      write("control.json", { owner: owner[0].id, ledger });
    else
      assert.deepEqual(
        ledger,
        read("control.json").ledger,
        "FINANCIAL_STATE_CHANGED",
      );
    await db.query("rollback");
    report.automaticPostingDisabled = true;
    report.financialFingerprint = hash(JSON.stringify(ledger));
    report.financialUnchanged = stage === "after";
  } finally {
    await db.end();
  }
}
async function api() {
  assert.equal(process.env.MASARIFI_PROCESS_KIND, "api");
  assert.match(
    fixture,
    /^(en|ar)-(ten|compact|minimal|verified|clear|final|long|eleven|mixed)$/,
  );
  const owner = read("control.json").owner;
  assert.equal(hash(owner), ownerPin);
  const clerk = load("@clerk/backend").createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });
  const sessions = await clerk.sessions.getSessionList({
    userId: owner,
    status: "active",
    limit: 10,
  });
  assert(sessions.data.length > 0, "ACTIVE_TEST_OWNER_AUTH_REQUIRED");
  const token = (await clerk.sessions.getToken(sessions.data[0].id)).jwt;
  const statePath = fixture + "-state.json";
  async function request(method, endpoint, body, audio, key) {
    assert(
      /^\/api\/v1\/voice\/sessions(?:\/[0-9a-f-]{36}\/(?:audio|process|cancel))?$/.test(
        endpoint,
      ),
    );
    assert(["POST", "PUT"].includes(method));
    const response = await fetch("http://127.0.0.1:3000" + endpoint, {
      method,
      signal: AbortSignal.timeout(30000),
      headers: {
        authorization: "Bearer " + token,
        "idempotency-key": key || randomUUID(),
        "x-voice-contract": "2",
        "content-type": audio ? "audio/m4a" : "application/json",
      },
      ...(body ? { body: audio ? body : JSON.stringify(body) } : {}),
    });
    assert(
      response.ok,
      "AUTHENTICATED_VOICE_REQUEST_REJECTED_" + response.status,
    );
    return response.json();
  }
  if (stage === "cancel") {
    const state = read(statePath);
    if (!state.sessionId) {
      assert(state.createBody && state.createKey, "CREATE_IDENTITY_MISSING");
      state.sessionId = (
        await request(
          "POST",
          "/api/v1/voice/sessions",
          state.createBody,
          false,
          state.createKey,
        )
      ).session.id;
      write(statePath, state);
    }
    const cancellation = await request(
      "POST",
      "/api/v1/voice/sessions/" + state.sessionId + "/cancel",
      {},
      false,
      state.cancelKey,
    );
    assert.equal(cancellation.id, state.sessionId);
    assert.equal(cancellation.status, "cancelled");
    assert.equal(cancellation.transactionId, null);
    report.cancelled = true;
    return;
  }
  const durable = {
    createKey: randomUUID(),
    processKey: randomUUID(),
    cancelKey: randomUUID(),
    dispatched: false,
  };
  // Reserve the fixture identity before any network effect; concurrent invocations fail closed.
  assert(
    !fs.existsSync(path.join(directory, statePath)),
    "CAPTURE_ALREADY_SUBMITTED",
  );
  fs.closeSync(
    fs.openSync(path.join(directory, statePath + ".lock"), "wx", 0o600),
  );
  write(statePath, durable);
  const media = read("media.json").find((x) => x.id === fixture);
  assert(media && media.durationMs > 0 && media.durationMs <= 60000);
  const audio = fs.readFileSync(path.join(directory, fixture + ".m4a"));
  assert.equal(hash(audio), media.sha256);
  const recordedAt = new Date().toISOString();
  durable.recordedAt = recordedAt;
  durable.createBody = {
    locale: media.locale,
    durationMs: media.durationMs,
    contentType: "audio/m4a",
    sizeBytes: audio.length,
    contentHash: media.sha256,
    recordedAt,
    timezoneOffsetMinutes: -180,
  };
  write(statePath, durable);
  const created = await request(
    "POST",
    "/api/v1/voice/sessions",
    {
      locale: media.locale,
      durationMs: media.durationMs,
      contentType: "audio/m4a",
      sizeBytes: audio.length,
      contentHash: media.sha256,
      recordedAt,
      timezoneOffsetMinutes: -180,
    },
    false,
    durable.createKey,
  );
  const sessionId = created.session.id;
  durable.sessionId = sessionId;
  write(statePath, durable);
  const uploaded = await request(
    "PUT",
    "/api/v1/voice/sessions/" + sessionId + "/audio",
    audio,
    true,
  );
  await request(
    "POST",
    "/api/v1/voice/sessions/" + sessionId + "/process",
    {
      uploadCompleted: true,
      expectedVersion: uploaded.version,
      contentHash: media.sha256,
    },
    false,
    durable.processKey,
  );
  report.authenticatedSubmission = true;
  report.mediaFingerprint = media.sha256;
}
async function provider() {
  assert.equal(process.env.MASARIFI_PROCESS_KIND, "worker");
  assert.equal(process.env.MASARIFI_RELEASE_VERSION, sha);
  assert(process.argv.includes("--approved-non-posting"));
  const { ConfigService } = load("@nestjs/config");
  const { PlatformConfigService } = load(
    path.join(root, "platform/config/platform-config.service.js"),
  );
  const { validateEnvironment } = load(
    path.join(root, "platform/config/environment.schema.js"),
  );
  const config = new PlatformConfigService(
    new ConfigService(validateEnvironment(process.env)),
  );
  const { PoolService } = load(
    path.join(root, "platform/database/pool.service.js"),
  );
  const { AiRepository } = load(path.join(root, "ai/ai.repository.js"));
  const { AiGateway } = load(path.join(root, "ai/ai.gateway.js"));
  const {
    VOICE_BATCH_OUTPUT_SCHEMA,
    VOICE_BATCH_PROMPT,
    decideVoiceBatch,
    parseVoiceBatchProviderOutput,
  } = load(path.join(root, "ai/voice-batch.js"));
  const pool = new PoolService(config),
    repo = new AiRepository(pool);
  const stateName = fixture + "-state.json",
    state = read(stateName);
  assert.equal(state.dispatched, false, "SECOND_DISPATCH_BLOCKED");
  let claim, input, attemptNo;
  try {
    const route = await repo.getRoute("voice_transcription");
    assert.equal(route.primary.modelId, model);
    assert.equal(route.primary.provider, "google-vertex");
    assert.equal(route.limits.outputTokens, 1200);
    assert.deepEqual(route.fallbacks, []);
    assert.equal(route.zdrRequired, true);
    claim = await pool.withClient(async (client) => {
      await client.query("begin");
      try {
        await client.query("set local role masarifi_worker");
        const claims = (
          await client.query(
            "select * from private.claim_ai_work($1,$2,$3,$4)",
            ["voice.transcribe_extract", "voice-v3-capacity-shadow", 1, 300],
          )
        ).rows;
        assert.equal(claims.length, 1);
        assert.equal(claims[0].id, state.sessionId);
        assert.equal(hash(claims[0].user_id), ownerPin);
        await client.query("commit");
        return claims[0];
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });
    input = await repo.workInput(claim.kind, claim.id, claim.claim_token);
    const audio = fs.readFileSync(path.join(directory, fixture + ".m4a"));
    assert.equal(hash(audio), input.contentHash);
    const references = read("references.json");
    const schema = structuredClone(VOICE_BATCH_OUTPUT_SCHEMA);
    schema.properties.complete.description =
      schema.properties.complete.description.replace("<=5", "<=10");
    let prompt = VOICE_BATCH_PROMPT.replace("0..5", "0..10").replace(
      "more than five",
      "more than ten",
    );
    const candidateContract = process.argv.includes("--candidate-contract");
    const compact = process.argv.includes("--compact");
    report.compact = compact || candidateContract;
    if (compact) {
      const original = schema.properties.events.items.properties;
      schema.properties.events.items.properties = Object.fromEntries(
        Object.entries(compactFields).map(([key, name]) => {
          const field = structuredClone(original[name]);
          if (["c", "b", "d"].includes(key))
            field.description =
              name +
              ": source prefix e: explicit, s: shared, o: omitted, a: ambiguous followed by value; o: and a: have no value.";
          if (key === "k") {
            field.enum = Object.keys(kindNames);
            field.description =
              "e expense, i income, r repayment, t transfer, o obligation, u unsupported. Never downgrade special events.";
          }
          return [key, field];
        }),
      );
      schema.properties.events.items.required = Object.keys(compactFields);
      prompt +=
        " Use compact event keys: " +
        Object.entries(compactFields)
          .map(([k, v]) => k + "=" + v)
          .join(", ") +
        ". k kind values: e expense, i income, r repayment, t transfer, o obligation, u unsupported. Prefix c currency, b account and d date values with e: explicit, s: shared, o: omitted or a: ambiguous. Omitted/ambiguous has no value, e.g. o:; explicit example b=e:ACCOUNT_1. Note is always empty and has no output field. Emit compact JSON without whitespace.";
      if (process.argv.includes("--minor-context"))
        prompt +=
          ' SAR uses 100 minor units per riyal: 25 SAR expense is a="2500", 50 SAR income is a="-5000". Match explicitly named cash/card separately for every occurrence against supplied account names; never default an explicitly stated account.';
    }
    const shadowRoute = {
      ...route,
      prompt: { template: prompt, schemaVersion: 3 },
    };
    report.contractFingerprint = hash(JSON.stringify({ prompt, schema }));
    const captureDate = new Date(Date.parse(state.recordedAt) + 180 * 60000)
      .toISOString()
      .slice(0, 10);
    const gateway = new AiGateway({
      apiKey: config.getRequired("OPENROUTER_API_KEY"),
      fetcher: async (url, init) => {
        guardRequest(url, init, schema, audio, report.dispatches);
        state.dispatched = true;
        write(stateName, state);
        report.dispatches++;
        const response = await fetch(url, init);
        report.httpStatus = response.status;
        // Observe bounded metadata only. Gateway remains responsible for receipts and failures.
        let envelope;
        try {
          envelope = await boundedClone(response);
        } catch {
          report.envelopeRead = "unparseable-or-oversize";
          return response;
        }
        const output = envelope.choices?.[0]?.message?.content;
        report.returnedModelMatches = envelope.model === model;
        report.returnedProviderMatches = envelope.provider === "Google";
        report.returnedProvider =
          typeof envelope.provider === "string" &&
          /^[A-Za-z0-9 /()_-]{1,80}$/.test(envelope.provider)
            ? envelope.provider
            : null;
        report.finishReason = [
          "stop",
          "length",
          "content_filter",
          "error",
        ].includes(envelope.choices?.[0]?.finish_reason)
          ? envelope.choices[0].finish_reason
          : null;
        if (typeof output === "string") {
          report.outputBytes = Buffer.byteLength(output);
          report.outputFingerprint = hash(output);
          report.escapedUnicode = /\\u[0-9a-f]{4}/i.test(output);
          report.newlines = (output.match(/\n/g) || []).length;
          report.observedItemStarts = (
            output.match(
              compact || candidateContract ? /"k"\s*:/g : /"kind"\s*:/g,
            ) || []
          ).length;
          try {
            const decoded = JSON.parse(output);
            report.observedComplete =
              typeof decoded.complete === "boolean" ? decoded.complete : null;
            report.observedEventCount = Array.isArray(decoded.events)
              ? decoded.events.length
              : null;
            report.observedLanguageMatches =
              decoded.language === fixture.slice(0, 2);
          } catch {
            report.observedComplete = null;
          }
        }
        return response;
      },
    });
    const completion = await gateway.complete({
      route: shadowRoute,
      voiceBatch: true,
      requestId: input.operationId,
      schema,
      userContent: [
        {
          type: "text",
          text: JSON.stringify({
            locale: fixture.slice(0, 2),
            capture: {
              recordedAt: state.recordedAt,
              timezoneOffsetMinutes: -180,
              referenceLocalDate: captureDate,
            },
            references: references.map(({ id, ...r }) => r),
            instruction: prompt,
          }),
        },
        {
          type: "input_audio",
          input_audio: { data: audio.toString("base64"), format: "m4a" },
        },
      ],
      beforeDispatch: async (candidate) => {
        const approved = await repo.authorizeVoiceDispatch(
          claim.id,
          claim.claim_token,
          candidate.modelId,
          candidate.provider,
          route,
        );
        assert.equal(approved.operationId, input.operationId);
        attemptNo = approved.attemptNo;
      },
      onReceipt: async (receipt) => {
        report.receipt = {
          ...receipt.usage,
          latencyMs: receipt.latencyMs,
          generationHash: hash(receipt.generationId),
        };
        await repo.recordVoiceAttempt(
          input.operationId,
          attemptNo,
          receipt,
          true,
        );
        report.accountingConfirmed = true;
      },
      onDispatchFailure: (received) =>
        repo.recordVoiceAttempt(input.operationId, attemptNo, null, received),
      parse: candidateContract ? parseVoiceBatchProviderOutput : parseEnvelope,
    });
    report.complete = completion.value.complete;
    report.languageMatches = completion.value.language === fixture.slice(0, 2);
    report.eventCount = completion.value.events.length;
    const expected = read("expected.json")[fixture];
    report.eventChecks = completion.value.events.map((raw, i) => {
      const event = compact ? normalizeCompact(raw) : raw;
      const decision = decideVoiceBatch(
        {
          complete: true,
          language: completion.value.language,
          events: [event],
        },
        {
          recordedAt: state.recordedAt,
          timezoneOffsetMinutes: -180,
          defaultAccountId: references[0].id,
          references,
        },
      )[0];
      const checks =
        decision.status === "eligible" && expected[i]
          ? {
              kind: decision.command.kind === expected[i].kind,
              amount: decision.command.amountMinor === expected[i].amountMinor,
              account: decision.command.accountId === expected[i].accountId,
              category: decision.command.categoryId === expected[i].categoryId,
              currency: decision.command.currency === "SAR",
              date:
                decision.command.occurredAt === captureDate + "T21:00:00.000Z",
            }
          : {};
      // Date is local midnight, hence preceding UTC day at 21:00 for Riyadh.
      if ("date" in checks)
        checks.date =
          decision.command.occurredAt ===
          new Date(
            Date.parse(captureDate + "T00:00:00Z") - 180 * 60000,
          ).toISOString();
      return {
        ordinal: i + 1,
        eligible: decision.status === "eligible",
        checks,
        amountScale:
          decision.status === "eligible" && expected[i]
            ? decision.command.amountMinor / expected[i].amountMinor
            : null,
        matches:
          Object.keys(checks).length === 6 &&
          Object.values(checks).every(Boolean),
      };
    });
    report.allExpected =
      report.complete &&
      report.languageMatches &&
      report.eventCount === expected.length &&
      report.eventChecks.every((x) => x.matches);
  } finally {
    try {
      if (claim) {
        report.terminalCleanupConfirmed = await repo.completeWork(
          claim.kind,
          claim.id,
          claim.claim_token,
          "failed",
          "VOICE_INTENT_UNSUPPORTED_MULTI_TRANSACTION",
        );
        assert.equal(
          report.terminalCleanupConfirmed,
          true,
          "TERMINAL_CLEANUP_UNCONFIRMED",
        );
      }
    } finally {
      await pool.onModuleDestroy();
    }
  }
}
(async () => {
  if (stage === "self-test") {
    selfTest();
    return;
  }
  assert(["before", "after", "submit", "cancel", "provider"].includes(stage));
  if (stage === "before" || stage === "after") await observer();
  else if (stage === "provider") await provider();
  else await api();
  write((fixture || stage) + "-" + stage + "-evidence.json", report);
  console.log(JSON.stringify(report));
})().catch((error) => {
  report.error = /^[A-Z][A-Z0-9_]{1,80}$/.test(error.code || "")
    ? error.code
    : error.name === "AssertionError"
      ? "SHADOW_GATE_FAILED"
      : "SHADOW_PROBE_FAILED";
  try {
    write((fixture || stage) + "-" + stage + "-evidence.json", report);
  } catch {}
  console.error(JSON.stringify(report));
  process.exitCode = 1;
});
