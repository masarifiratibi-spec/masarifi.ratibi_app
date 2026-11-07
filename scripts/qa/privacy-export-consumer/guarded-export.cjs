const { createHash } = require("node:crypto");
const { Transform } = require("node:stream");
const MANIFEST = Object.freeze([
  "ai@1",
  "engagement@1",
  "identity@1",
  "tracking@1",
]);
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_ENTRIES = 100;
const RETENTION_HOURS = 24;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (sql) =>
  typeof sql === "string" ? sql.replace(/\s+/g, " ").trim() : "";
const ORIGINAL_CLAIM =
  normalize(`with selected as (select id from private.privacy_export_requests where (status='verified' or (status='processing' and updated_at<=clock_timestamp()-interval '15 minutes'))
  and exists(select 1 from public.profiles p where p.id=privacy_export_requests.user_id and p.status='active')
  order by requested_at,id for update skip locked limit 1)
  update private.privacy_export_requests r set status='processing',error_code=null from selected where r.id=selected.id
  returning r.id,r.user_id,r.scope`);
const SCOPED_CLAIM = `with selected as (select id from private.privacy_export_requests
  where id=$1::uuid and encode(sha256(convert_to(user_id,'UTF8')),'hex')=$2
  and status='verified' and requested_at >= $3::timestamptz and requested_at <= $4::timestamptz
  and requested_at <= clock_timestamp() and scope=$5::jsonb
  and exists(select 1 from public.profiles p where p.id=privacy_export_requests.user_id and p.status='active')
  for update skip locked limit 1)
  update private.privacy_export_requests r set status='processing',error_code=null from selected where r.id=selected.id
  returning r.id,r.user_id,r.scope`;
const READY =
  normalize(`update private.privacy_export_requests set status='ready',storage_ref=$2,completed_at=clock_timestamp(),
  expires_at=clock_timestamp()+make_interval(hours=>$3) where id=$1 and status='processing'`);
const FAILED =
  "update private.privacy_export_requests set status='failed',error_code='EXPORT_GENERATION_FAILED' where id=$1 and status='processing'";
const EVENT =
  "select private.enqueue_outbox_event('privacy.export_ready','privacy_export',$1,$2)";
const CLAIMS = "select set_config('request.jwt.claims',$1,true)";
const IDENTITY = new Set([
  "select id,primary_email,phone_e164,display_name,locale,timezone,status,created_at,updated_at,version from public.profiles where id=$1",
  "select default_currency,language,theme,calendar,week_start,privacy_settings,version from public.user_preferences where user_id=$1",
  "select step,completed_steps,completed_at,version from public.onboarding_progress where user_id=$1",
  "select id,platform,app_version,device_name,trusted_at,last_seen_at,revoked_at,created_at,version from public.user_devices where user_id=$1 order by created_at,id limit 1000",
]);
const RESOURCES = new Map([
  [
    "select private.export_tracking_batch($1,$2,$3::uuid,500) value",
    [
      "preferences",
      "keyword-rules",
      "sender-rules",
      "sessions",
      "items",
      "reviews",
      "duplicates",
      "history",
      "feedback",
    ],
  ],
  [
    "select private.export_engagement_batch($1,$2,$3::uuid,500) value",
    [
      "notifications",
      "preferences",
      "tickets",
      "messages",
      "attachments",
      "feedback",
      "abuse_reports",
    ],
  ],
  [
    "select value from private.export_ai_batch($1,$2,$3::timestamptz,$4::uuid,500)",
    [
      "voice_sessions",
      "voice_transcripts",
      "voice_proposals",
      "voice_proposal_fields",
      "voice_category_preferences",
      "assistant_consents",
      "conversations",
      "messages",
      "assistant_snapshots",
      "assistant_previews",
      "assistant_feedback",
      "response_reports",
    ],
  ],
]);
function requireCondition(value, code) {
  if (!value) throw Error(code);
}
function createGuardedExportContext(policy, reserve, now = () => new Date()) {
  const start = Date.parse(policy.notBefore),
    end = Date.parse(policy.deadline);
  requireCondition(
    /^[a-f0-9]{64}$/.test(policy.ownerSha256) &&
      UUID.test(policy.requestId) &&
      policy.maximumJobs === 1 &&
      Number.isFinite(start) &&
      end - start === 600000,
    "EXPORT_QA_POLICY",
  );
  const state = {
    consumed: false,
    claim: null,
    status: null,
    event: false,
    reads: 0,
    uploadAttempted: false,
    created: false,
    uploaded: false,
    bytes: 0,
    head: false,
    deleted: false,
  };
  const key = `exports/${policy.requestId}/privacy.zip`;
  function within(grace = 0) {
    requireCondition(
      now().getTime() >= start && now().getTime() <= end + grace,
      "EXPORT_QA_DEADLINE",
    );
  }
  function queryGuard(client) {
    let began = false,
      role = false;
    return {
      query: async (sql, values = []) => {
        const text = normalize(sql);
        if (text === "rollback") {
          requireCondition(began, "EXPORT_QA_TRANSACTION");
          began = false;
          role = false;
          return client.query(sql, values);
        }
        if (text === "begin") {
          within(120000);
          requireCondition(
            !began && values.length === 0,
            "EXPORT_QA_TRANSACTION",
          );
          began = true;
          return client.query(sql, values);
        }
        requireCondition(began, "EXPORT_QA_TRANSACTION");
        if (text === "set local role masarifi_worker") {
          requireCondition(values.length === 0, "EXPORT_QA_ROLE");
          role = true;
          return client.query(sql, values);
        }
        if (text === CLAIMS) {
          requireCondition(
            values.length === 1 && values[0] === '{"role":"worker"}',
            "EXPORT_QA_ROLE",
          );
          return client.query(sql, values);
        }
        if (text === "commit") {
          within(120000);
          requireCondition(
            role && values.length === 0,
            "EXPORT_QA_TRANSACTION",
          );
          const result = await client.query(sql, values);
          began = false;
          role = false;
          return result;
        }
        requireCondition(role, "EXPORT_QA_ROLE");
        if (text === ORIGINAL_CLAIM) {
          within();
          requireCondition(
            !state.consumed && values.length === 0,
            "EXPORT_QA_ALREADY_CONSUMED",
          );
          reserve(policy.requestId);
          state.consumed = true;
          const result = await client.query(SCOPED_CLAIM, [
            policy.requestId,
            policy.ownerSha256,
            policy.notBefore,
            policy.deadline,
            JSON.stringify(MANIFEST),
          ]);
          requireCondition(result.rows.length <= 1, "EXPORT_QA_CLAIM");
          const claim = result.rows[0];
          if (claim) {
            requireCondition(
              claim.id === policy.requestId &&
                typeof claim.user_id === "string" &&
                hash(claim.user_id) === policy.ownerSha256 &&
                JSON.stringify(claim.scope) === JSON.stringify(MANIFEST),
              "EXPORT_QA_CLAIM",
            );
            state.claim = claim;
            state.status = "processing";
          }
          return result;
        }
        requireCondition(state.claim, "EXPORT_QA_CLAIM_REQUIRED");
        if (IDENTITY.has(text) || RESOURCES.has(text)) {
          within();
          requireCondition(
            state.status === "processing" &&
              values[0] === state.claim.user_id &&
              ++state.reads <= 128,
            "EXPORT_QA_READ_SCOPE",
          );
          if (IDENTITY.has(text))
            requireCondition(values.length === 1, "EXPORT_QA_READ_SCOPE");
          else {
            requireCondition(
              RESOURCES.get(text).includes(values[1]) &&
                values.length === (text.includes("export_ai_batch") ? 4 : 3),
              "EXPORT_QA_READ_SCOPE",
            );
            for (const cursor of values.slice(2))
              requireCondition(
                cursor === null ||
                  (typeof cursor === "string" &&
                    cursor.length <= 40 &&
                    (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(
                      cursor,
                    ) ||
                      Number.isFinite(Date.parse(cursor)))),
                "EXPORT_QA_CURSOR",
              );
          }
          const result = await client.query(sql, values);
          requireCondition(
            result.rows.length <=
              (text.includes("user_devices")
                ? 1000
                : RESOURCES.has(text)
                  ? 500
                  : 1),
            "EXPORT_QA_READ_BOUND",
          );
          return result;
        }
        if (text === READY) {
          within(120000);
          requireCondition(
            state.status === "processing" &&
              state.uploaded &&
              state.head &&
              values.length === 3 &&
              values[0] === policy.requestId &&
              values[1] === key &&
              values[2] === RETENTION_HOURS,
            "EXPORT_QA_READY",
          );
          const result = await client.query(sql, values);
          requireCondition(result.rowCount === 1, "EXPORT_QA_READY_UNCERTAIN");
          state.status = "ready";
          return result;
        }
        if (text === FAILED) {
          within(120000);
          requireCondition(
            state.status === "processing" &&
              values.length === 1 &&
              values[0] === policy.requestId,
            "EXPORT_QA_FAILURE_SCOPE",
          );
          const result = await client.query(sql, values);
          state.status = "failed";
          return result;
        }
        if (text === EVENT) {
          within(120000);
          const value = JSON.parse(values[1]);
          requireCondition(
            state.status === "ready" &&
              !state.event &&
              values.length === 2 &&
              values[0] === policy.requestId &&
              Object.keys(value).sort().join(",") ===
                "expiresAt,occurredAt,requestId,schemaVersion,userId" &&
              value.schemaVersion === 1 &&
              value.requestId === policy.requestId &&
              value.userId === state.claim.user_id &&
              Number.isFinite(Date.parse(value.expiresAt)) &&
              Number.isFinite(Date.parse(value.occurredAt)),
            "EXPORT_QA_EVENT_SCOPE",
          );
          state.event = true;
          return client.query(sql, values);
        }
        throw Error("EXPORT_QA_SQL_FORBIDDEN");
      },
    };
  }
  return {
    pool: (raw) => ({
      withClient: (action) =>
        raw.withClient((client) => action(queryGuard(client))),
    }),
    fetch: (fetcher) => async (target, input) => {
      within(120000);
      requireCondition(
        state.claim && ["processing", "failed"].includes(state.status),
        "EXPORT_QA_STORAGE_STATE",
      );
      const url = new URL(target),
        headers = new Headers(input.headers);
      requireCondition(
        url.origin === "https://qcffvfbpzvpwcwxwjyro.supabase.co" &&
          url.pathname === "/storage/v1/object/report-exports/" + key &&
          !url.search &&
          !url.hash &&
          !url.username &&
          !url.password,
        "EXPORT_QA_STORAGE_SCOPE",
      );
      if (input.method === "PUT") {
        within();
        requireCondition(
          !state.uploadAttempted &&
            state.status === "processing" &&
            headers.get("x-upsert") === "false" &&
            headers.get("content-type") === "application/zip" &&
            input.body?.pipe,
          "EXPORT_QA_UPLOAD_SCOPE",
        );
        state.uploadAttempted = true;
        let ended = false;
        const original = input.body;
        const counter = new Transform({
          transform(chunk, encoding, done) {
            state.bytes += chunk.length;
            if (state.bytes > MAX_BYTES) done(Error("EXPORT_QA_BYTE_BOUND"));
            else done(null, chunk);
          },
        });
        counter.once("end", () => {
          ended = true;
        });
        counter.on("error", (error) => original.destroy(error));
        original.on("error", (error) => counter.destroy(error));
        original.pipe(counter);
        try {
          const response = await fetcher(url, {
            ...input,
            body: counter,
            redirect: "error",
          });
          state.created = response.ok;
          requireCondition(
            response.ok && ended && state.bytes > 0,
            "EXPORT_QA_UPLOAD_INCOMPLETE",
          );
          state.uploaded = true;
          return response;
        } catch (error) {
          original.destroy();
          counter.destroy();
          throw error;
        }
      }
      if (input.method === "HEAD") {
        requireCondition(
          state.uploaded &&
            !state.head &&
            state.status === "processing" &&
            input.body === undefined,
          "EXPORT_QA_HEAD_SCOPE",
        );
        const response = await fetcher(url, { ...input, redirect: "error" });
        requireCondition(
          response.ok &&
            /^[0-9]+$/.test(response.headers.get("content-length") || "") &&
            Number(response.headers.get("content-length")) === state.bytes,
          "EXPORT_QA_STORAGE_INTEGRITY",
        );
        state.head = true;
        return response;
      }
      if (input.method === "DELETE") {
        requireCondition(
          state.created &&
            !state.deleted &&
            state.status === "failed" &&
            input.body === undefined,
          "EXPORT_QA_COMPENSATION_SCOPE",
        );
        state.deleted = true;
        return fetcher(url, { ...input, redirect: "error" });
      }
      throw Error("EXPORT_QA_STORAGE_FORBIDDEN");
    },
    get progress() {
      return {
        consumed: state.consumed,
        admitted: Boolean(state.claim),
        status: state.status,
        event: state.event,
        reads: state.reads,
        bytes: state.bytes,
        uploaded: state.uploaded,
        head: state.head,
        deleted: state.deleted,
      };
    },
  };
}
module.exports = {
  createGuardedExportContext,
  MANIFEST,
  MAX_BYTES,
  MAX_ENTRIES,
  RETENTION_HOURS,
  ORIGINAL_CLAIM,
};
