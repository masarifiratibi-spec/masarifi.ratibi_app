// Run against a disposable, fully migrated local QA database after building apps/api.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createStorageServer } from "./storage/service.mjs";

const api = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const { PoolService } = api("./dist/src/platform/database/pool.service");
const { ReportsStorage } = api("./dist/src/reports/reports.storage");
const { FinancialResetService } = api(
  "./dist/src/security/financial-reset.service",
);
const { FinancialResetWorker } = api(
  "./dist/src/security/financial-reset.worker",
);
const { OwnerDataErasureService } = api(
  "./dist/src/security/owner-data-erasure.service",
);
const { SecurityRepository } = api("./dist/src/security/security.repository");

async function objectStore(t) {
  const root = await mkdtemp(join(tmpdir(), "report-cleanup-"));
  const secret = randomBytes(32).toString("hex");
  const server = createStorageServer({
    root,
    secret,
    publicOrigin: "https://files.example.test",
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = "http://127.0.0.1:" + server.address().port;
  const headers = {
    apikey: secret,
    authorization: "Bearer " + secret,
    "content-type": "application/pdf",
  };
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  });
  return {
    origin,
    secret,
    request: (key, method, body) =>
      fetch(origin + "/storage/v1/object/report-exports/" + key, {
        method,
        headers,
        body,
      }),
  };
}

test("reset and account erasure retry only the QA object store", async (t) => {
  const url = new URL(process.env.QA_CLEANUP_TEST_DATABASE_URL);
  assert.equal(url.hostname, "127.0.0.1");
  const pool = new PoolService({
    get: (k) => ({ DATABASE_URL: url.href, MASARIFI_DATABASE_POOL_MAX: 3 })[k],
  });
  t.after(() => pool.onModuleDestroy());
  const previousScope = process.env.MASARIFI_ISOLATED_REPORT_QA;
  process.env.MASARIFI_ISOLATED_REPORT_QA = "1";
  t.after(() => {
    if (previousScope === undefined)
      delete process.env.MASARIFI_ISOLATED_REPORT_QA;
    else process.env.MASARIFI_ISOLATED_REPORT_QA = previousScope;
  });
  const qa = await objectStore(t);
  const control = await objectStore(t);
  const repo = new SecurityRepository(pool);
  for (const workflow of ["reset", "account erasure"]) {
    await t.test(workflow, async () => {
      let unavailable = true;
      const config = {
        MASARIFI_STORAGE_PROVIDER: "filesystem",
        MASARIFI_STORAGE_URL: "https://files.example.test",
        MASARIFI_STORAGE_SERVICE_KEY: qa.secret,
        NODE_ENV: "test",
      };
      const storage = new ReportsStorage(
        { getRequired: (k) => config[k] },
        (url, init) => {
          assert.equal(
            new URL(url).origin,
            "http://masarifi-qa-report-storage:8080",
          );
          if (unavailable && init.method === "DELETE")
            return Promise.resolve(new Response(null, { status: 503 }));
          return fetch(new URL(url.pathname, qa.origin), init);
        },
      );
      const owner = "user_fixture_" + randomUUID().replaceAll("-", "");
      const id = randomUUID(),
        requestId = randomUUID();
      const key = storage.key(id, owner, "pdf");
      const controlBody = "%PDF-production-control";
      assert.equal((await control.request(key, "GET")).status, 404);
      assert.equal(
        (await qa.request(key, "PUT", "%PDF-qa-target")).status,
        200,
      );
      // A wrong-store missing acknowledgement would strand the file.
      assert.equal((await control.request(key, "DELETE")).status, 404);
      assert.equal((await qa.request(key, "GET")).status, 200);
      assert.equal(
        (await control.request(key, "PUT", controlBody)).status,
        200,
      );
      await pool.query(
        "insert into public.profiles(id,status) values($1,'active')",
        [owner],
      );
      await pool.query(
        `insert into private.report_output_attempts
        (id,user_id,report_type,period_start,period_end,ledger_version,snapshot,storage_ref,expires_at)
        values($1,$2,'financial_summary',current_date,current_date,0,$3::jsonb,$4,now()+interval '1 day')`,
        [
          id,
          owner,
          JSON.stringify({ format: "pdf", delivery: "download" }),
          key,
        ],
      );
      let cleanup, pending;
      if (workflow === "reset") {
        const svc = new FinancialResetService(repo);
        const principal = {
          userId: owner,
          sessionId: "session-fixture",
          factorAgeSeconds: 0,
        };
        await svc.reset(principal, requestId);
        const worker = new FinancialResetWorker(
          repo,
          undefined,
          storage,
          undefined,
          undefined,
        );
        cleanup = () => worker.run(owner);
        pending = async () =>
          (await svc.receipt(principal, requestId)).status === "processing";
      } else {
        await pool.query(
          `insert into private.account_deletion_requests
          (id,user_id,status,requested_at,verified_at,cooling_off_ends_at)
          values($1,$2,'processing',now()-interval '2 days',now()-interval '1 day',now())`,
          [requestId, owner],
        );
        await repo.withWorkerTransaction((client) =>
          client.query("select private.freeze_account_deletion_owner($1,$2)", [
            requestId,
            owner,
          ]),
        );
        const service = new OwnerDataErasureService(
          pool,
          storage,
          undefined,
          undefined,
        );
        const evidence = { requestId, userId: owner };
        await service.prepare(evidence);
        cleanup = () => service.erase(evidence);
        pending = async () =>
          (
            await pool.query(
              "select id from private.report_output_attempts where id=$1",
              [id],
            )
          ).rowCount === 1;
      }
      await assert.rejects(cleanup, /STORAGE_UNAVAILABLE|CLEANUP_UNAVAILABLE/);
      assert.equal(await pending(), true);
      assert.equal((await qa.request(key, "GET")).status, 200);
      if (workflow === "reset") {
        // Advance the retry deadline in the disposable database after the failed lease.
        await pool.query(
          "update private.financial_reset_objects set next_attempt_at=now() where owner_id=$1 and request_id=$2",
          [owner, requestId],
        );
      }
      unavailable = false;
      await cleanup();
      assert.equal(await pending(), false);
      assert.equal((await qa.request(key, "GET")).status, 404);
      assert.equal(
        await (await control.request(key, "GET")).text(),
        controlBody,
      );
    });
  }
});
