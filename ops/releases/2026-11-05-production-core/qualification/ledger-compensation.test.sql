begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_function('private','post_transaction',array['text','jsonb'],'income/expense command exists');
select has_function('private','transfer_funds',array['text','jsonb'],'transfer command exists');
select has_function('private','revise_transaction',array['text','uuid','bigint','jsonb','text'],'revision command exists');
select has_function('private','refund_transaction',array['text','uuid','bigint','bigint','uuid','timestamp with time zone','text'],'refund command exists');
select has_function('private','reverse_transaction',array['text','uuid','bigint','timestamp with time zone','text'],'reversal command exists');
select has_function('private','soft_delete_transaction',array['text','uuid','bigint','text'],'delete command exists');
select has_function('private','restore_transaction',array['text','uuid','bigint'],'restore command exists');
select has_function('private','post_opening_transaction',array['text','uuid','bigint','text','timestamp with time zone','text'],'opening command exists');
select has_function('private','reconcile_account_balance',array['uuid','integer'],'reconciliation command exists');

grant masarifi_migration,masarifi_api,masarifi_worker to current_user with inherit true,set true;
grant usage on schema extensions to masarifi_api,masarifi_worker;
set local role masarifi_migration;
insert into public.profiles(id,status) values ('readiness_20261105_ledger_a','active'),('readiness_20261105_ledger_b','active');
insert into public.accounts(id,user_id,name,type,currency_code) values
 ('c6110610-0000-4000-8000-000000000001','readiness_20261105_ledger_a','A','cash','SAR'),
 ('c6110610-0000-4000-8000-000000000002','readiness_20261105_ledger_a','B','bank','SAR'),
 ('c6110610-0000-4000-8000-000000000003','readiness_20261105_ledger_a','USD','bank','USD'),
 ('c6110610-0000-4000-8000-000000000004','readiness_20261105_ledger_b','Other','cash','SAR');
reset role;
select set_config('request.jwt.claims','{"sub":"readiness_20261105_ledger_a","role":"authenticated"}',true);
set local role masarifi_api;
create temporary table command_results(name text primary key,result jsonb) on commit drop;

insert into command_results values ('income',private.post_transaction('readiness_20261105_ledger_a',jsonb_build_object(
  'kind','income','amountMinor',1000,'currency','SAR','accountId','c6110610-0000-4000-8000-000000000001',
  'categoryId','04000000-0000-4000-8000-000000000016','title','Salary','occurredAt','2026-08-01T00:00:00Z')));
select is((select count(*)::integer from public.transactions where user_id='readiness_20261105_ledger_a' and kind='income'),1,'income header inserted');
select is((select count(*)::integer from public.transaction_postings where transaction_id=((select result->>'transactionId' from command_results where name='income'))::uuid),1,'income has one posting');
select is((select confirmed_minor from public.account_balances where account_id='c6110610-0000-4000-8000-000000000001'),1000::bigint,'income updates projection');
select is((select count(*)::integer from audit.transaction_revisions where transaction_id=((select result->>'transactionId' from command_results where name='income'))::uuid),1,'income has opening revision');

insert into command_results values ('expense',private.post_transaction('readiness_20261105_ledger_a',jsonb_build_object(
  'kind','expense','amountMinor',250,'currency','SAR','accountId','c6110610-0000-4000-8000-000000000001',
  'categoryId','04000000-0000-4000-8000-000000000002','title','Food','occurredAt','2026-08-02T00:00:00Z')));
select is((select confirmed_minor from public.account_balances where account_id='c6110610-0000-4000-8000-000000000001'),750::bigint,'expense subtracts projection');

insert into command_results values ('transfer',private.transfer_funds('readiness_20261105_ledger_a',jsonb_build_object(
  'sourceAccountId','c6110610-0000-4000-8000-000000000001','destinationAccountId','c6110610-0000-4000-8000-000000000002',
  'amountMinor',100,'currency','SAR','feeMinor',10,'title','Move','occurredAt','2026-08-03T00:00:00Z')));
select is((select confirmed_minor from public.account_balances where account_id='c6110610-0000-4000-8000-000000000001'),640::bigint,'transfer source and fee subtract');
select is((select confirmed_minor from public.account_balances where account_id='c6110610-0000-4000-8000-000000000002'),100::bigint,'transfer destination adds');
select is((select count(*)::integer from public.transaction_postings where transaction_id=((select result->>'transactionId' from command_results where name='transfer'))::uuid),3,'fee transfer has three postings');

select throws_ok($$select private.transfer_funds('readiness_20261105_ledger_a',jsonb_build_object(
  'sourceAccountId','c6110610-0000-4000-8000-000000000001','destinationAccountId','c6110610-0000-4000-8000-000000000003',
  'amountMinor',1,'currency','SAR','title','Bad','occurredAt','2026-08-03T00:00:00Z'))$$,
  'P0001','CURRENCY_MISMATCH','cross-currency transfer is atomic rejection');
select is((select count(*)::integer from public.transactions where user_id='readiness_20261105_ledger_a'),3,'failed transfer leaves no header');

update command_results set result=private.revise_transaction('readiness_20261105_ledger_a',(result->>'transactionId')::uuid,1,'{"amountMinor":1200}'::jsonb,'correct amount') where name='income';
select is((select version from public.transactions where id=((select result->>'transactionId' from command_results where name='income'))::uuid),2::bigint,'revision advances exact version');
select is((select confirmed_minor from public.account_balances where account_id='c6110610-0000-4000-8000-000000000001'),840::bigint,'revision appends net delta');
select throws_ok($$select private.revise_transaction('readiness_20261105_ledger_a',
  (select (result->>'transactionId')::uuid from command_results where name='income'),1,'{"title":"stale"}'::jsonb,'stale change')$$,
  'P0001','VERSION_CONFLICT','stale revision is rejected');

insert into command_results values ('refund',private.refund_transaction('readiness_20261105_ledger_a',
  (select (result->>'transactionId')::uuid from command_results where name='expense'),1,100,null,'2026-08-04T00:00:00Z','partial refund'));
select is((select confirmed_minor from public.account_balances where account_id='c6110610-0000-4000-8000-000000000001'),940::bigint,'refund credits projection');
select throws_ok($$select private.refund_transaction('readiness_20261105_ledger_a',
  (select (result->>'transactionId')::uuid from command_results where name='expense'),2,151,null,'2026-08-04T00:00:00Z','too much refund')$$,
  'P0001','REFUND_EXCEEDS_AVAILABLE','refund cap is enforced');

insert into command_results values ('reversal',private.reverse_transaction('readiness_20261105_ledger_a',
  (select (result->>'transactionId')::uuid from command_results where name='transfer'),1,'2026-08-05T00:00:00Z','reverse transfer'));
select is((select status from public.transactions where id=((select result->>'transactionId' from command_results where name='transfer'))::uuid),'reversed','original is reversed');
select throws_ok($$select private.reverse_transaction('readiness_20261105_ledger_a',
  (select (result->>'transactionId')::uuid from command_results where name='transfer'),2,'2026-08-05T00:00:00Z','duplicate reversal')$$,
  'P0001','REVERSAL_EXISTS','second reversal is rejected');

update command_results set result=private.soft_delete_transaction('readiness_20261105_ledger_a',(result->>'transactionId')::uuid,2,'remove mistake') where name='income';
select is((select status from public.transactions where id=((select result->>'transactionId' from command_results where name='income'))::uuid),'deleted','soft delete sets state');
select is((select confirmed_minor from public.account_balances where account_id='c6110610-0000-4000-8000-000000000001'),-150::bigint,'delete appends exact compensation');
update command_results set result=private.restore_transaction('readiness_20261105_ledger_a',(result->>'transactionId')::uuid,3) where name='income';
select is((select status from public.transactions where id=((select result->>'transactionId' from command_results where name='income'))::uuid),'confirmed','restore returns state');
select is((select confirmed_minor from public.account_balances where account_id='c6110610-0000-4000-8000-000000000001'),1050::bigint,'restore appends exact prior effect');

insert into command_results values ('opening',private.post_opening_transaction('readiness_20261105_ledger_a','c6110610-0000-4000-8000-000000000003',500,'Open','2026-08-01T00:00:00Z','manual'));
select is((select confirmed_minor from public.account_balances where account_id='c6110610-0000-4000-8000-000000000003'),500::bigint,'opening projects signed amount');

reset role;
set local role masarifi_worker;
select is((select count(*)::integer from private.reconcile_account_balance(null,500)
  where matches and account_id in(
    'c6110610-0000-4000-8000-000000000001','c6110610-0000-4000-8000-000000000002',
    'c6110610-0000-4000-8000-000000000003')),3,'bounded reconciliation matches all owner accounts');
reset role;
set local role masarifi_migration;
select throws_ok($$update public.transaction_postings set amount_minor=1 where transaction_id in (select id from public.transactions where user_id='readiness_20261105_ledger_a')$$,'42501','LEDGER_EVIDENCE_IMMUTABLE','postings cannot update');
select throws_ok($$delete from audit.transaction_revisions where transaction_id in (select id from public.transactions where user_id='readiness_20261105_ledger_a')$$,'42501','LEDGER_EVIDENCE_IMMUTABLE','revisions cannot delete');

reset role;

select set_config('request.jwt.claims','{"sub":"readiness_20261105_ledger_a","role":"authenticated"}',true);
set local role masarifi_api;
insert into command_results values ('capture-original',private.post_transaction('readiness_20261105_ledger_a',jsonb_build_object(
 'kind','expense','amountMinor',250,'currency','SAR','accountId','c6110610-0000-4000-8000-000000000002',
 'categoryId','04000000-0000-4000-8000-000000000002','title','Synthetic compensation origin','occurredAt',clock_timestamp()-interval '10 minutes')));
reset role;
grant select on command_results to masarifi_migration;
set local role masarifi_migration;
update public.accounts set automatic_tracking_enabled=true,last_four='4242' where id='c6110610-0000-4000-8000-000000000002' and user_id='readiness_20261105_ledger_a';
insert into public.tracking_preferences(user_id,enabled,review_required) values('readiness_20261105_ledger_a',true,false);
insert into public.user_sender_rules(user_id,sender_pattern,display_label,trusted,enabled) values('readiness_20261105_ledger_a','SyntheticCompensation','Synthetic source',true,true);
insert into private.tracking_automatic_cohorts(user_id,device_id,release_id,engine_version,enabled,expires_at,reason)
 select 'readiness_20261105_ledger_a','synthetic-compensation-device',r.id,r.engine_version,true,clock_timestamp()+interval '1 hour','Synthetic compensation qualification'
 from public.tracking_rule_channels c join public.tracking_rule_releases r on r.id=c.release_id where c.environment='default' and c.market='global' and c.channel='all' and r.status='published';
insert into public.import_sessions(id,user_id,source_type,request_hash,schema_version,status,item_count)
 values('c6110611-0000-4000-8000-000000000001','readiness_20261105_ledger_a','sms',repeat('c',64),2,'received',2);
insert into public.import_items(id,user_id,session_id,source_item_key,normalized_hash,source_hash,canonical_identity_hash,amount_minor,currency_code,occurred_at,normalized_payload,status,transaction_id)
 select ('c6110612-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'readiness_20261105_ledger_a','c6110611-0000-4000-8000-000000000001',
 'synthetic-compensation-'||n,repeat('d',64),repeat('e',64),repeat(case when n=1 then 'a' else 'b' end,64),
 case when n=1 then -250 else 100 end,'SAR',clock_timestamp()-case when n=1 then interval '10 minutes' else interval '0 seconds' end,
 jsonb_build_object('sender','SyntheticCompensation','kind',case when n=1 then 'expense' else 'refund' end,
 'accountId','c6110610-0000-4000-8000-000000000002','receivedAt',clock_timestamp(),
 'providerReferenceDigest',case when n=1 then repeat('e',64) else repeat('f',64) end,
 'originalProviderReferenceDigest',case when n=2 then repeat('e',64) end,
 'classification',jsonb_build_object('status','completed','subtype',case when n=1 then 'card_purchase' else 'refund' end,
 'direction',case when n=1 then 'outgoing' else 'incoming' end,'amountMinor',case when n=1 then 250 else 100 end,'currency','SAR',
 'disposition','capture_candidate','reasonCodes','[]'::jsonb,'instruments','[{"role":"card","suffix":"4242"}]'::jsonb,
 'engineVersion',r.engine_version,'releaseId',r.snapshot->>'releaseId'),
 'transport',jsonb_build_object('deviceId','synthetic-compensation-device','channel','android_sms'),
 'metadata',jsonb_build_object('referenceScheme','plain-v2','ruleConfigurationRevision',private.tracking_configuration_revision('readiness_20261105_ledger_a'))),
 case when n=1 then 'accepted' else 'parsed' end,
 case when n=1 then (select (result->>'transactionId')::uuid from command_results where name='capture-original') else null end
 from generate_series(1,2)n cross join public.tracking_rule_channels c join public.tracking_rule_releases r on r.id=c.release_id
 where c.environment='default' and c.market='global' and c.channel='all';
reset role;
select ok((private.tracking_capture_source_state('c6110612-0000-4000-8000-000000000002')->>'trusted')::boolean,'compensation source uses an actual explicit synthetic trust rule');
select ok(private.tracking_capture_auto_enabled('c6110612-0000-4000-8000-000000000002'),'only explicit synthetic cohort authorizes the compensation fixture');
select is(private.tracking_capture_exception('c6110612-0000-4000-8000-000000000002'),null::text,'all existing compensation guards accept valid synthetic evidence');
set local role masarifi_api;
insert into command_results values ('tracking-refund',private.create_tracking_compensation('readiness_20261105_ledger_a',jsonb_build_object(
 'trackingCaptureId','c6110612-0000-4000-8000-000000000002','trackingCaptureKey','tracking:'||repeat('b',64),
 'transactionId',(select result->>'transactionId' from command_results where name='capture-original'),'expectedVersion',1,
 'trackingOperation','refundTransaction','amountMinor',100,'accountId','c6110610-0000-4000-8000-000000000002','occurredAt',clock_timestamp(),'reason','Synthetic guarded compensation')));
insert into command_results values ('remaining-refund',private.refund_transaction('readiness_20261105_ledger_a',
 (select (result->>'transactionId')::uuid from command_results where name='capture-original'),2,150,null,clock_timestamp(),'Synthetic remaining refund'));
reset role;
select is(private.tracking_original_compensation_fresh('c6110612-0000-4000-8000-000000000002'),null::jsonb,'exhausted original cannot authorize another fresh refund');
select is(private.tracking_committed_capture('c6110612-0000-4000-8000-000000000002')->>'transactionId',(select result->>'transactionId' from command_results where name='tracking-refund'),'committed capture resolves exact guarded refund');
select is(private.tracking_original_compensation('c6110612-0000-4000-8000-000000000002')->>'originalTransactionId',(select result->>'transactionId' from command_results where name='capture-original'),'committed compensation resolves original by exact UUID');
select is((private.tracking_original_compensation('c6110612-0000-4000-8000-000000000002')->>'originalTransactionVersion')::bigint,3::bigint,'recovery reads current original version after both real refunds');
select is(private.tracking_original_compensation('c6110612-0000-4000-8000-000000000099'),null::jsonb,'missing capture has no compensation authority');
select is((select confirmed_minor from public.account_balances where account_id='c6110610-0000-4000-8000-000000000002'),0::bigint,'lookup retries add no ledger effect after exact refund cap');

select * from finish();
rollback;
