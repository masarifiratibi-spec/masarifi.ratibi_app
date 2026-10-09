'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {defaultSnapshot,evidenceCorpus}=require('./index');
test('new database migration carries the exact governed bilingual Egypt rule asset',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261009232000_tracking_financial_request_precedence.sql'),'utf8');
  const payload=source.match(/\$tracking_pack\$([\s\S]*?)\$tracking_pack\$::jsonb/);
  assert.ok(payload,'seed must embed one reviewable rule snapshot');
  assert.deepEqual(JSON.parse(payload[1]),defaultSnapshot);
  assert.ok(source.includes(`"caseCount":${evidenceCorpus.length}`));
  assert.ok(source.includes('private.seed_default_keyword_rules'));
  assert.ok(source.includes('on conflict'));
});
