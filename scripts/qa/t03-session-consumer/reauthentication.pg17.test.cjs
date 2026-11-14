const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const test = require('node:test');
const { productSchema, splitStatements } = require('./product-schema.cjs');

const root = path.resolve(__dirname, '../../..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const { Client } = apiRequire('pg');
const hash = value => createHash('sha256').update(value).digest('hex');
const head = sql => sql.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '').trim().toLowerCase();
const files = [
  'supabase/migrations/20261023232159_report_closure_sync_reauthentication.sql',
  'supabase/migrations/20261024110500_report_closure_planning_sync_receipts.sql'
];

test('two-source recent-authentication contract on the original owned PG17 fixture', {
  skip: !process.env.T04_FIXTURE_RECEIPT_PATH,
  timeout: 120_000
}, async () => {
  const receipt = JSON.parse(fs.readFileSync(process.env.T04_FIXTURE_RECEIPT_PATH, 'utf8'));
  const original = JSON.parse(fs.readFileSync(path.join(root, '.superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/runner-prep/pg17/owned-process.json'), 'utf8'));
  assert.equal(receipt.status, 'verified');
  assert.equal(receipt.systemIdentifier, '7700634956601963652');
  assert.equal(receipt.systemIdentifier, original.systemIdentifier);
  assert.equal(receipt.binary, original.binary);
  assert.equal(receipt.dataDirectory, original.dataDirectory);
  assert.equal(receipt.port, 55473); assert.equal(receipt.listen, '127.0.0.1');
  const evidence = path.resolve(process.env.T04_REAUTH_EVIDENCE_PATH);
  assert.ok(evidence.startsWith(path.join(root, '.superpowers/sdd/2026-10-25-astra-readiness-remediation/T04') + path.sep));
  const write = (name, value) => fs.writeFileSync(path.join(evidence, name), JSON.stringify(value, null, 2), { flag: 'wx' });
  const connect = async database => {
    const client = new Client({ host: receipt.listen, port: receipt.port, database, user: 't03_owner', ssl: false, connectionTimeoutMillis: 1000, query_timeout: 8000 });
    await client.connect();
    await client.query('set statement_timeout=5000; set lock_timeout=1000');
    return client;
  };
  const control = await connect('postgres');
  let admin;
  const database = `t04_reauth_synthetic_${randomUUID().replaceAll('-', '')}`;
  const memberships = async client => (await client.query('select coalesce(jsonb_agg(to_jsonb(m) order by roleid,member,grantor),\'[]\'::jsonb) value from pg_auth_members m')).rows[0].value;
  const beforeMemberships = await memberships(control);
  try {
    const identity = (await control.query("select current_setting('data_directory') data,(pg_control_system()).system_identifier::text system,inet_server_port() port,pg_postmaster_start_time() started")).rows[0];
    assert.equal(path.resolve(identity.data), path.resolve(receipt.dataDirectory));
    assert.equal(identity.system, receipt.systemIdentifier); assert.equal(identity.port, receipt.port);
    assert.ok(Math.abs(identity.started.getTime() - Date.parse(receipt.start)) < 2000);
    assert.equal((await control.query('select 1 from pg_database where datname=$1', [database])).rowCount, 0);
    write('source-sql-database-allocation.json', { database, identity, beforeMemberships, noReset: true, noDrop: true });
    await control.query(`create database ${database}`);
    admin = await connect(database);
    await admin.query('create schema extensions');
    const schema = productSchema();
    const baseline = schema.applied.filter(statement => statement.file !== files[0]);
    for (const file of schema.files.filter(file => file.path !== files[0])) {
      assert.equal(hash(fs.readFileSync(path.join(root, file.path))), file.sha256);
      await admin.query('begin');
      try {
        let role = 'admin';
        for (const statement of baseline.filter(statement => statement.file === file.path)) {
          assert.ok(!/^(?:create|alter|drop) role\b|^grant masarifi_|^revoke masarifi_/.test(head(statement.sql)), 'no global membership modification');
          if (statement.executionRole !== role) {
            await admin.query(statement.executionRole === 'migration' ? 'set local role masarifi_migration' : 'reset role');
            role = statement.executionRole;
          }
          await admin.query(statement.sql);
        }
        await admin.query('commit');
      } catch (error) { await admin.query('rollback'); throw error; }
    }
    const planningFile = 'supabase/migrations/20260831120000_phase07_planning_tables.sql';
    const planningBytes = fs.readFileSync(path.join(root, planningFile));
    const planningConstraints = splitStatements(planningBytes.toString('utf8')).flatMap((sql, index) =>
      /^alter table public\.client_mutations (?:drop|add) constraint client_mutations_(?:domain|resource_type)_check\b/.test(head(sql))
        ? [{ statement: index + 1, sha256: hash(sql), bytes: Buffer.byteLength(sql), sql }] : []);
    assert.equal(planningConstraints.length, 4);
    await admin.query('begin; set local role masarifi_migration');
    try {
      for (const statement of planningConstraints) await admin.query(statement.sql);
      await admin.query('commit');
    } catch (error) { await admin.query('rollback'); throw error; }
    const raw = fs.readFileSync(path.join(root, '.superpowers/sdd/2026-10-25-astra-readiness-remediation/T04/root-hosted-baseline-definition-readonly.json'));
    const result = JSON.parse(JSON.parse(raw).result.content[0].text).result;
    const matched = result.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    assert.ok(matched, 'bounded deployed function array');
    const deployed = JSON.parse(matched[1]);
    assert.deepEqual(deployed.map(item => item.proname).sort(), ['claim_client_mutations', 'guard_client_mutation', 'receive_client_mutation']);
    await admin.query('begin');
    try {
      await admin.query('set local role masarifi_migration');
      for (const item of deployed) {
        assert.ok(item.definition.startsWith(`CREATE OR REPLACE FUNCTION private.${item.proname}(`));
        await admin.query(item.definition);
      }
      await admin.query('commit');
    } catch (error) { await admin.query('rollback'); throw error; }
    const metadata = async () => (await admin.query("select proname,pg_get_userbyid(proowner) owner,proacl::text acl,proconfig,prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and proname=any($1) order by proname", [deployed.map(item => item.proname)])).rows;
    assert.deepEqual(await metadata(), deployed.map(({ proname, owner, acl, proconfig, prosecdef }) => ({ proname, owner, acl, proconfig, prosecdef })).sort((a, b) => a.proname.localeCompare(b.proname)));
    assert.equal((await admin.query("select 1 from information_schema.columns where table_schema='public' and table_name='client_mutations' and column_name='authenticated_at'")).rowCount, 0);
    const selected = files.map(file => {
      const bytes = fs.readFileSync(path.join(root, file));
      const statements = splitStatements(bytes.toString('utf8'));
      const wrapperIndices = [0, 1, statements.length - 2, statements.length - 1];
      assert.match(head(statements[0]), /^grant masarifi_migration to current_user with set true,\s*inherit false;$/);
      assert.equal(head(statements[1]), 'set local role masarifi_migration;');
      assert.equal(head(statements.at(-2)), 'reset role;');
      assert.equal(head(statements.at(-1)), 'revoke masarifi_migration from current_user granted by current_user;');
      const body = statements.flatMap((sql, index) => wrapperIndices.includes(index) ? [] : [{ statement: index + 1, sha256: hash(sql), bytes: Buffer.byteLength(sql), sql }]);
      return { file, originalSha256: hash(bytes), omittedWrappers: wrapperIndices.map(index => ({ statement: index + 1, sha256: hash(statements[index]) })), bodySha256: hash(body.map(item => item.sql).join('')), body };
    });
    write('source-sql-selected-group.json', { baseline: { files: schema.files.filter(file => file.path !== files[0]), statements: baseline.length, planningConstraintDelta: { file: planningFile, sourceSha256: hash(planningBytes), statements: planningConstraints }, deployedDefinitionEvidenceSha256: hash(raw), metadata: await metadata() }, selected });
    const owner = `t04_fixture_${randomUUID()}`;
    const other = `t04_fixture_${randomUUID()}`;
    const device = randomUUID(), secondDevice = randomUUID();
    const mutation = randomUUID();
    const payload = { amountMinor: 100 };
    const payloadHash = `sha256:${hash(JSON.stringify(payload))}`;
    const proofs = {};
    await admin.query('begin');
    const api = async (operationId, factor = 600, changes = {}) => {
      await admin.query('reset role');
      await admin.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: changes.owner ?? owner, sid: changes.device === secondDevice ? 't04-second-session' : 't04-session', role: 'authenticated' })]);
      await admin.query('set local role masarifi_api');
      return (await admin.query('select * from private.receive_client_mutation($1,$2,$3,$4,$5,$6,1,$7,$8,$9,$10,$11,$12)', [changes.owner ?? owner, changes.device ?? device, factor, operationId, changes.domain ?? 'transactions', changes.resourceType ?? 'transaction', changes.dependsOn ?? [], 'update', changes.resourceId ?? 't04-local-resource', changes.baseVersion ?? 1, payloadHash, changes.payload ?? payload])).rows[0];
    };
    const migration = async (sql, parameters = []) => { await admin.query('reset role; set local role masarifi_migration'); return admin.query(sql, parameters); };
    const claim = async () => { await admin.query('reset role; set local role masarifi_worker'); return (await admin.query("select * from private.claim_client_mutations('t04-fixture-worker',100,60)")).rows; };
    const complete = async (item, status, error) => { await admin.query('reset role; set local role masarifi_worker'); await admin.query('select private.complete_client_mutation($1,$2,$3,$4,$5)', [item.id, item.lease_token, status, status === 'applied' ? { fixtureQueueOnly: true } : null, error]); };
    const denied = async action => {
      await admin.query('savepoint expected_denial');
      let failure;
      try { await action(); } catch (error) { failure = error; await admin.query('rollback to savepoint expected_denial'); }
      await admin.query('release savepoint expected_denial');
      assert.ok(failure, 'operation must be denied'); return failure.code;
    };
    try {
      await migration("insert into public.profiles(id,status) values($1,'active'),($2,'active')", [owner, other]);
      await migration("insert into public.user_devices(id,user_id,device_fingerprint,clerk_session_id,platform,app_version) values($1,$3,$4,'t04-session','android','1.0.0'),($2,$3,$5,'t04-second-session','android','1.0.0')", [device, secondDevice, owner, `h1:${'a'.repeat(64)}`, `h1:${'b'.repeat(64)}`]);
      const legacy = await api(mutation);
      const [legacyClaim] = await claim();
      await complete(legacyClaim, 'rejected', { code: 'RECENT_AUTH_REQUIRED' });
      assert.equal((await api(mutation, 0)).status, 'rejected');
      proofs.deployedBaselineFreshReplayRemainsRejected = true;
      await migration('select 1');
      for (const statement of selected[0].body) await admin.query(statement.sql);
      assert.equal(await denied(() => api(randomUUID(), 0, { domain: 'planning', resourceType: 'budget' })), '22023');
      proofs.reauthAloneRegressesPlanning = true;
      await migration('select 1');
      for (const statement of selected[1].body) await admin.query(statement.sql);
      assert.equal((await api(mutation, 0)).mutation_id, legacy.mutation_id);
      const [legacyReclaim] = await claim(); await complete(legacyReclaim, 'applied', null);
      const current = randomUUID();
      await api(current, 600);
      const row = (await migration('select * from public.client_mutations where operation_id=$1', [current])).rows[0];
      assert.ok(Date.now() - row.authenticated_at.getTime() >= 599_000);
      const immutable = value => Object.fromEntries(['id','user_id','device_id','operation_id','domain','resource_type','schema_version','depends_on','operation','resource_id','base_version','payload_hash','payload','created_at'].map(key => [key, value[key]]));
      const [stale] = await claim(); await complete(stale, 'rejected', { code: 'RECENT_AUTH_REQUIRED' });
      assert.equal((await api(current, 600)).status, 'rejected');
      assert.equal((await api(current, 0, { payload: { amountMinor: 101 } })).outcome, 'hash_mismatch');
      assert.equal((await api(current, 0, { device: secondDevice })).status, 'rejected');
      await denied(() => api(current, 0, { owner: other }));
      const fresh = await api(current, 0); assert.equal(fresh.status, 'received'); assert.equal(fresh.mutation_id, row.id);
      const refreshed = (await migration('select * from public.client_mutations where id=$1', [row.id])).rows[0];
      assert.deepEqual(immutable(refreshed), immutable(row)); assert.ok(refreshed.authenticated_at > row.authenticated_at);
      const [freshClaim] = await claim(); assert.ok(Date.now() - freshClaim.authenticated_at.getTime() < 5000);
      await complete(freshClaim, 'applied', null);
      assert.equal((await api(current, 0)).status, 'applied'); assert.equal((await claim()).length, 0);
      const parent = randomUUID(), child = randomUUID();
      await api(parent); await api(child, 600, { dependsOn: [parent], baseVersion: 2 });
      const [parentClaim] = await claim(); assert.equal(parentClaim.operation_id, parent);
      await complete(parentClaim, 'rejected', { code: 'RECENT_AUTH_REQUIRED' }); assert.equal((await claim()).length, 0);
      await api(parent, 0); const [parentFresh] = await claim(); await complete(parentFresh, 'applied', null);
      const [childClaim] = await claim(); assert.equal(childClaim.operation_id, child); assert.deepEqual(childClaim.depends_on, [parent]);
      await complete(childClaim, 'applied', null);
      const planning = ['salary-profile','salary-receipt','budget','budget-category','obligation','obligation-schedule','obligation-payment','payment-match','savings-goal','savings-movement'];
      for (const resourceType of planning) assert.equal((await api(randomUUID(), 0, { domain: 'planning', resourceType })).status, 'received');
      const counts = (await migration('select (select count(*) from public.transactions)::int transactions,(select count(*) from public.transaction_postings)::int postings,(select count(*) from public.client_mutations where operation_id=$1)::int operation_rows', [current])).rows[0];
      assert.deepEqual(counts, { transactions: 0, postings: 0, operation_rows: 1 });
      await admin.query('reset role');
      assert.deepEqual(await memberships(admin), beforeMemberships);
      assert.deepEqual(await metadata(), deployed.map(({ proname, owner, acl, proconfig, prosecdef }) => ({ proname, owner, acl, proconfig, prosecdef })).sort((a, b) => a.proname.localeCompare(b.proname)));
      Object.assign(proofs, { originalAuthenticationInstant: true, staleRetryRejected: true, freshSameIdentityOnly: true, changedPayloadDeviceOwnerDenied: true, appliedCannotReclaim: true, childWaits: true, planningResources: planning, membershipsIncludingOidsUnchanged: true, functionOwnerAclSearchPathUnchanged: true, counts, financialExactlyOnce: 'NOT_PROVEN_QUEUE_ONLY' });
    } finally { await admin.query('rollback'); }
    assert.deepEqual(await memberships(control), beforeMemberships);
    assert.equal((await admin.query("select 1 from information_schema.columns where table_schema='public' and table_name='client_mutations' and column_name='authenticated_at'")).rowCount, 0);
    write('source-sql-qualified.json', { database, rolledBack: true, existingDatabasesPreserved: true, newSyntheticDatabaseRetained: true, proofs, group: selected.map(({ body, ...item }) => ({ ...item, body: body.map(({ sql, ...entry }) => entry) })) });
  } finally {
    if (admin) await admin.end();
    await control.end();
  }
});
